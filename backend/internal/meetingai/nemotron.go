package meetingai

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

// Nemotron calls an NVIDIA NIM OpenAI-compatible chat endpoint to analyze a
// transcript (spec §13.1). Constructed only when NIM is configured; otherwise
// the pipeline uses the Heuristic analyzer.
type Nemotron struct {
	cfg    config.NIM
	client *http.Client
}

func NewNemotron(cfg config.NIM) *Nemotron {
	return &Nemotron{cfg: cfg, client: &http.Client{Timeout: 30 * time.Second}}
}

func (n *Nemotron) Name() string { return "nemotron" }

const systemPrompt = `You are a meeting-notes assistant. Given a transcript, respond with ONLY a JSON object of the form:
{"summary": string, "key_points": string[], "actions": [{"text": string, "assignee": string}]}
Keep the summary to 2-3 sentences. Extract concrete action items with the responsible person's first name as "assignee" (empty string if none). Do not include any prose outside the JSON.`

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

func (n *Nemotron) Analyze(ctx context.Context, transcript string) (Analysis, error) {
	body, _ := json.Marshal(chatReq{
		Model: n.cfg.Model,
		Messages: []message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: transcript},
		},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimRight(n.cfg.BaseURL, "/")+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return Analysis{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+n.cfg.APIKey)

	res, err := n.client.Do(req)
	if err != nil {
		return Analysis{}, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return Analysis{}, fmt.Errorf("nim status %d", res.StatusCode)
	}

	var cr chatResp
	if err := json.NewDecoder(res.Body).Decode(&cr); err != nil {
		return Analysis{}, err
	}
	if len(cr.Choices) == 0 {
		return Analysis{}, fmt.Errorf("nim: empty response")
	}

	// The model returns JSON; tolerate code-fences around it.
	content := strings.TrimSpace(cr.Choices[0].Message.Content)
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")

	var parsed struct {
		Summary   string   `json:"summary"`
		KeyPoints []string `json:"key_points"`
		Actions   []Action `json:"actions"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(content)), &parsed); err != nil {
		return Analysis{}, fmt.Errorf("nim: could not parse model output: %w", err)
	}
	return Analysis{Summary: parsed.Summary, KeyPoints: parsed.KeyPoints, Actions: parsed.Actions}, nil
}

// Pick returns the configured analyzer: Nemotron when NIM is set, else Heuristic.
func Pick(cfg config.Config) Analyzer {
	if cfg.NIM.Configured() {
		return NewNemotron(cfg.NIM)
	}
	return Heuristic{}
}
