// Package notify is the notification fan-out abstraction (spec §3.4). Every
// lifecycle event notifies the requester across three channels — in-portal,
// email, and Slack — concurrently. Go's goroutines are exactly why the backend
// is written in Go (spec §13.4): this fan-out is the motivating pattern.
//
// Phase 1 ships logging channels; the Slack channel is the seam the Phase 4
// Slack Hub fills in, and email swaps to a real provider, with no caller change.
package notify

import (
	"context"
	"log"
	"sync"
)

// Event is a single notification to deliver.
type Event struct {
	JobRef    string
	Kind      string // e.g. "submitted", "acknowledged", "completed"
	Recipient string // email of the requester or queue owner
	Message   string
}

// Channel delivers an event over one medium.
type Channel interface {
	Name() string
	Send(ctx context.Context, e Event) error
}

// Notifier fans an event out across all channels concurrently and waits for
// completion. A failing channel never blocks the others.
type Notifier struct{ channels []Channel }

func New(channels ...Channel) *Notifier { return &Notifier{channels: channels} }

// Default wires the Phase 1 channels: in-portal, email, Slack (all logging).
func Default() *Notifier {
	return New(logChannel{"in-portal"}, logChannel{"email"}, logChannel{"slack"})
}

func (n *Notifier) Notify(ctx context.Context, e Event) {
	var wg sync.WaitGroup
	for _, ch := range n.channels {
		wg.Add(1)
		go func(ch Channel) {
			defer wg.Done()
			if err := ch.Send(ctx, e); err != nil {
				log.Printf("notify: channel %s failed for %s: %v", ch.Name(), e.JobRef, err)
			}
		}(ch)
	}
	wg.Wait()
}

// logChannel is a placeholder channel that logs delivery. Real email/Slack
// implementations satisfy the same Channel interface.
type logChannel struct{ name string }

func (c logChannel) Name() string { return c.name }
func (c logChannel) Send(_ context.Context, e Event) error {
	log.Printf("notify[%s] → %s | %s (%s): %s", c.name, e.Recipient, e.JobRef, e.Kind, e.Message)
	return nil
}
