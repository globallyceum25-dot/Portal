package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/labstack/echo/v4"

	"lyceumconnect/backend/internal/config"
	"lyceumconnect/backend/internal/httpx"
	"lyceumconnect/backend/internal/lifecycle"
	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/notify"
	"lyceumconnect/backend/internal/slack"
)

// slackChannel adapts the notifier's Channel interface onto the Slack Hub, so
// every portal notification flows through the Hub's routing + retry (spec §6).
type slackChannel struct{ hub *slack.Hub }

func (slackChannel) Name() string { return "slack" }

func (s slackChannel) Send(ctx context.Context, e notify.Event) error {
	var acts []slack.Action
	for _, a := range e.Actions {
		acts = append(acts, slack.Action{Label: a.Label, Action: a.Action, Value: a.Value})
	}
	// Publish never blocks the caller on failure — the Hub retries then logs.
	s.hub.Publish(ctx, slack.Event{
		Source: "portal", Kind: e.Kind, Category: e.Category,
		Title: e.JobRef, Text: e.Message, Ref: e.JobRef, Actions: acts,
	})
	return nil
}

// slackAPI serves the Hub's inbound half: interactions from Slack that drive
// portal actions (spec §6.2 bidirectional).
type slackAPI struct {
	cfg config.Slack
	hub *slack.Hub
	lc  *lifecycle.Service
}

// hubStatus (admin) exposes the Hub's transport and channels for visibility.
func (a *slackAPI) hubStatus(c echo.Context) error {
	return httpx.OK(c, map[string]any{
		"transport": a.hub.Transport(),
		"channels":  slack.AllChannels,
		"inbound_verified": a.cfg.SigningSecret != "",
	})
}

type interactionReq struct {
	Action string `json:"action"` // approve | reject-approval | forward | reject
	Ref    string `json:"ref"`
}

// interactions handles a Slack interactive action (button click / slash command)
// and performs the corresponding portal action. When a signing secret is set,
// the request signature is verified; otherwise (dev) it is accepted.
func (a *slackAPI) interactions(c echo.Context) error {
	body, _ := io.ReadAll(c.Request().Body)

	if a.cfg.SigningSecret != "" {
		ts := c.Request().Header.Get("X-Slack-Request-Timestamp")
		sig := c.Request().Header.Get("X-Slack-Signature")
		if !slack.VerifySignature(a.cfg.SigningSecret, ts, sig, body) {
			return httpx.Err(c, http.StatusUnauthorized, "invalid Slack signature")
		}
	}

	var r interactionReq
	if err := json.Unmarshal(body, &r); err != nil || r.Ref == "" || r.Action == "" {
		return httpx.Err(c, http.StatusBadRequest, "expected {action, ref}")
	}

	ctx := c.Request().Context()
	// A Slack action is performed by a synthesized service actor holding the role
	// the action requires. (Mapping real Slack users → portal users is a later
	// refinement.)
	var err error
	switch r.Action {
	case "approve":
		_, err = a.lc.Approve(ctx, slackActor(models.RoleHODManager), r.Ref, "approve", "Approved from Slack")
	case "reject-approval":
		_, err = a.lc.Approve(ctx, slackActor(models.RoleHODManager), r.Ref, "reject", "Rejected from Slack")
	case "forward":
		_, err = a.lc.Forward(ctx, slackActor(models.RoleLGHITReviewer), r.Ref, "Forwarded from Slack")
	case "reject":
		_, err = a.lc.RejectReview(ctx, slackActor(models.RoleLGHITReviewer), r.Ref, "Rejected from Slack")
	default:
		return httpx.Err(c, http.StatusBadRequest, "unknown action: "+r.Action)
	}
	if err != nil {
		return fail(c, err)
	}
	return httpx.OK(c, map[string]any{"ok": true, "ref": r.Ref, "action": r.Action})
}

func slackActor(role models.Role) models.User {
	return models.User{ID: "slack-hub", Name: "Slack Hub", TenantID: "lgh", Role: role}
}
