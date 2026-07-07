package slack

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"lyceumconnect/backend/internal/config"
)

// Pick selects the outbound transport from config: real bot posting, a single
// incoming webhook, or the log transport (default).
func Pick(cfg config.Slack) Transport {
	switch {
	case cfg.BotToken != "":
		return &BotTransport{token: cfg.BotToken, client: httpClient()}
	case cfg.WebhookURL != "":
		return &WebhookTransport{url: cfg.WebhookURL, client: httpClient()}
	default:
		return LogTransport{}
	}
}

func httpClient() *http.Client { return &http.Client{Timeout: 10 * time.Second} }

// render turns an Event into human-readable Slack text with action hints.
func render(e Event) string {
	b := strings.Builder{}
	if e.Title != "" {
		b.WriteString("*" + e.Title + "*\n")
	}
	b.WriteString(e.Text)
	if e.Ref != "" {
		b.WriteString("  (" + e.Ref + ")")
	}
	for _, a := range e.Actions {
		b.WriteString("\n• " + a.Label + " → `/" + a.Action + " " + a.Value + "`")
	}
	return b.String()
}

// BotTransport posts via chat.postMessage to the routed channel.
type BotTransport struct {
	token  string
	client *http.Client
}

func (BotTransport) Name() string { return "bot" }

func (t *BotTransport) Send(ctx context.Context, channel string, e Event) error {
	body, _ := json.Marshal(map[string]any{"channel": channel, "text": render(e)})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://slack.com/api/chat.postMessage", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+t.token)
	res, err := t.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	var out struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	_ = json.NewDecoder(res.Body).Decode(&out)
	if !out.OK {
		return fmt.Errorf("slack api: %s", out.Error)
	}
	return nil
}

// WebhookTransport posts to a single incoming webhook (channel is informational).
type WebhookTransport struct {
	url    string
	client *http.Client
}

func (WebhookTransport) Name() string { return "webhook" }

func (t *WebhookTransport) Send(ctx context.Context, channel string, e Event) error {
	body, _ := json.Marshal(map[string]any{"text": channel + " — " + render(e)})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, t.url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := t.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("webhook status %d", res.StatusCode)
	}
	return nil
}

// VerifySignature validates an inbound Slack request (spec §6.2). It recomputes
// the v0 HMAC over "v0:{timestamp}:{body}" and constant-time compares it, and
// rejects stale timestamps (>5 min) to prevent replay.
func VerifySignature(secret, timestamp, signature string, body []byte) bool {
	if secret == "" {
		return false
	}
	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil || time.Since(time.Unix(ts, 0)) > 5*time.Minute {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte("v0:" + timestamp + ":"))
	mac.Write(body)
	expected := "v0=" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}
