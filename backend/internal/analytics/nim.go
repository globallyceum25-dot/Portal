package analytics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"lyceumconnect/backend/internal/config"
)

// NIMNarrator generates insight summaries with a reasoning model served by
// NVIDIA NIM (GLM-5.1 / Nemotron, spec §13.6). It is grounded: the model is
// handed the already-computed Report as JSON and instructed to explain only
// those figures — it has no data access of its own and cannot invent numbers.
// Any transport or parse failure degrades to the Heuristic narrator so the
// dashboard's narrative panel is never empty.
type NIMNarrator struct {
	cfg      config.NIM
	client   *http.Client
	fallback Heuristic
}

func NewNIMNarrator(cfg config.NIM) *NIMNarrator {
	return &NIMNarrator{cfg: cfg, client: &http.Client{Timeout: 30 * time.Second}}
}

func (n *NIMNarrator) Name() string { return "nim" }

type chatReq struct {
	Model    string    `json:"model"`
	Messages []message `json:"messages"`
	Stream   bool      `json:"stream"`
}
type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}
type chatResp struct {
	Choices []struct {
		Message message `json:"message"`
	} `json:"choices"`
}

const insightsSystem = `You are a portal analytics assistant. You are given a JSON report of aggregated operational metrics. Respond with ONLY a JSON array of insight objects:
[{"severity": "positive"|"info"|"warning"|"critical", "title": string, "detail": string}]
Base every statement strictly on the numbers in the report — never invent figures. Keep each detail to one sentence. Return 3-5 insights, ordered most important first.`

const answerSystem = `You are a portal analytics assistant. You are given a JSON report of aggregated operational metrics and a question. Answer in 1-3 plain sentences using ONLY figures present in the report. If the report does not contain the answer, say so plainly. Do not invent numbers.`

func (n *NIMNarrator) Insights(ctx context.Context, r *Report) ([]Insight, error) {
	payload, _ := json.Marshal(r)
	content, err := n.chat(ctx, insightsSystem, string(payload))
	if err != nil {
		return n.fallback.Insights(ctx, r)
	}
	var parsed []Insight
	if err := json.Unmarshal([]byte(stripFences(content)), &parsed); err != nil || len(parsed) == 0 {
		return n.fallback.Insights(ctx, r)
	}
	return parsed, nil
}

func (n *NIMNarrator) Answer(ctx context.Context, r *Report, question string) (string, error) {
	payload, _ := json.Marshal(r)
	user := "REPORT:\n" + string(payload) + "\n\nQUESTION: " + question
	content, err := n.chat(ctx, answerSystem, user)
	if err != nil || strings.TrimSpace(content) == "" {
		return n.fallback.Answer(ctx, r, question)
	}
	return strings.TrimSpace(content), nil
}

func (n *NIMNarrator) chat(ctx context.Context, system, user string) (string, error) {
	body, _ := json.Marshal(chatReq{
		Model: n.cfg.Model,
		Messages: []message{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimRight(n.cfg.BaseURL, "/")+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+n.cfg.APIKey)

	res, err := n.client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("nim status %d", res.StatusCode)
	}
	var cr chatResp
	if err := json.NewDecoder(res.Body).Decode(&cr); err != nil {
		return "", err
	}
	if len(cr.Choices) == 0 {
		return "", fmt.Errorf("nim: empty response")
	}
	return cr.Choices[0].Message.Content, nil
}

func stripFences(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}
