// Package slack is the Slack Integration Hub (spec §6): an extensible,
// event-driven layer that routes portal and external-system events to the
// correct Slack channels. New systems publish Events to the Hub without any core
// change — the routing rules and transport are the only things that know Slack.
//
// Transport is pluggable (log by default; real bot/webhook behind config), so
// the Hub is testable and degrades gracefully, and delivery has bounded retry.
package slack

import (
	"context"
	"log"
	"strings"
	"time"
)

// Channels (spec §6.2).
const (
	ChIT            = "#it-requests"
	ChHR            = "#hr-requests"
	ChApprovals     = "#approvals"
	ChAnnouncements = "#announcements"
	ChFacilities    = "#facilities"
	ChAssets        = "#assets"
	ChKitchen       = "#kitchen"
	ChSystemAlerts  = "#system-alerts"
)

// AllChannels is the fixed set the Hub knows about.
var AllChannels = []string{ChIT, ChHR, ChApprovals, ChAnnouncements, ChFacilities, ChAssets, ChKitchen, ChSystemAlerts}

// Action is an interactive button carried on an outbound message — the outbound
// half of bidirectional integration (spec §6.2).
type Action struct {
	Label  string `json:"label"`
	Action string `json:"action"` // e.g. "approve", "forward"
	Value  string `json:"value"`  // e.g. the job reference
}

// Event is the schema every publisher uses (spec §6.2).
type Event struct {
	Source   string   `json:"source"`            // "portal", "system-a", …
	Kind     string   `json:"kind"`              // "jobcard.forwarded_zte", "announcement", …
	Category string   `json:"category,omitempty"` // routing hint, e.g. "IT", "HR", "Facility"
	Channel  string   `json:"channel,omitempty"`  // explicit override; else routed
	Title    string   `json:"title"`
	Text     string   `json:"text"`
	Ref      string   `json:"ref,omitempty"`
	Actions  []Action `json:"actions,omitempty"`
}

// Route decides the destination channel for an event (spec §6.2 routing rules).
// An explicit Channel wins; otherwise category then kind decide.
func Route(e Event) string {
	if e.Channel != "" {
		return e.Channel
	}
	k := strings.ToLower(e.Kind)
	switch {
	case strings.Contains(k, "announcement"):
		return ChAnnouncements
	case strings.Contains(k, "approval") || strings.Contains(k, "pending_approval"):
		return ChApprovals
	case strings.Contains(k, "incident") || strings.Contains(k, "breach") || strings.Contains(k, "error") || strings.Contains(k, "alert"):
		return ChSystemAlerts
	}
	switch strings.ToLower(e.Category) {
	case "hr", "human resources":
		return ChHR
	case "facility", "facilities":
		return ChFacilities
	case "assets management", "assets":
		return ChAssets
	case "kitchen", "canteen":
		return ChKitchen
	case "it support", "email accounts", "it", "websites & applications development":
		return ChIT
	}
	// IT is the default: most requests are IT-gated through LGH IT → ZTE.
	return ChIT
}

// Transport delivers a rendered event to a channel.
type Transport interface {
	Name() string
	Send(ctx context.Context, channel string, e Event) error
}

// Hub is the event bus. Publish routes then delivers with bounded retry.
type Hub struct {
	transport  Transport
	maxRetries int
}

func NewHub(t Transport) *Hub { return &Hub{transport: t, maxRetries: 3} }

func (h *Hub) Transport() string { return h.transport.Name() }

// Publish routes the event and delivers it, retrying transient failures with a
// short backoff. Failure after the last attempt is logged, never panics — a
// notification must not take down the action that produced it.
func (h *Hub) Publish(ctx context.Context, e Event) {
	channel := Route(e)
	var err error
	for attempt := 1; attempt <= h.maxRetries; attempt++ {
		if err = h.transport.Send(ctx, channel, e); err == nil {
			return
		}
		if attempt < h.maxRetries {
			time.Sleep(time.Duration(attempt) * 150 * time.Millisecond) // linear backoff
		}
	}
	log.Printf("slack: dropped event %q → %s after %d attempts: %v", e.Kind, channel, h.maxRetries, err)
}

// LogTransport is the always-available default: it logs the routed delivery.
type LogTransport struct{}

func (LogTransport) Name() string { return "log" }
func (LogTransport) Send(_ context.Context, channel string, e Event) error {
	acts := ""
	if len(e.Actions) > 0 {
		var labels []string
		for _, a := range e.Actions {
			labels = append(labels, "["+a.Label+"]")
		}
		acts = " " + strings.Join(labels, " ")
	}
	log.Printf("slack[log] %s | %s: %s%s", channel, e.Kind, e.Text, acts)
	return nil
}
