package bot

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

// NIMEngine performs tool selection with a model served by NVIDIA NIM (GLM-5.1,
// spec §13.5). It is used ONLY to pick a tool and extract its argument — the
// answer itself is composed in Go from real store data (see bot.go), so the
// model can never fabricate a ticket status. On any transport or parse failure
// it falls back to the keyword Heuristic router, so the bot always answers.
//
// The Sinhala path (spec §13.5) sits upstream: a Sinhala question is translated
// to English via Google Translate before reaching this router, consistent with
// the §13.1 decision to keep Sinhala on Google's stack; by the time text arrives
// here it is English working copy, exactly as in the meeting pipeline.
type NIMEngine struct {
	cfg      config.NIM
	client   *http.Client
	fallback Heuristic
}

func NewNIMEngine(cfg config.NIM) *NIMEngine {
	return &NIMEngine{cfg: cfg, client: &http.Client{Timeout: 20 * time.Second}}
}

func (n *NIMEngine) Name() string { return "nim" }

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

func (n *NIMEngine) Route(ctx context.Context, question string, tools []ToolSpec) (ToolCall, error) {
	sys := &strings.Builder{}
	sys.WriteString("You are the router for a company portal assistant. Choose exactly ONE tool to answer the user's question and extract its argument. Respond with ONLY a JSON object: {\"tool\": string, \"arg\": string}. The arg is \"\" when the tool takes none. Available tools:\n")
	for _, t := range tools {
		arg := "none"
		if t.Arg != "" {
			arg = t.Arg
		}
		fmt.Fprintf(sys, "- %s (arg: %s): %s\n", t.Name, arg, t.Desc)
	}
	sys.WriteString("Do not answer the question yourself; only route it.")

	body, _ := json.Marshal(chatReq{
		Model: n.cfg.Model,
		Messages: []message{
			{Role: "system", Content: sys.String()},
			{Role: "user", Content: question},
		},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimRight(n.cfg.BaseURL, "/")+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return n.fallback.Route(ctx, question, tools)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+n.cfg.APIKey)

	res, err := n.client.Do(req)
	if err != nil {
		return n.fallback.Route(ctx, question, tools)
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return n.fallback.Route(ctx, question, tools)
	}
	var cr chatResp
	if err := json.NewDecoder(res.Body).Decode(&cr); err != nil || len(cr.Choices) == 0 {
		return n.fallback.Route(ctx, question, tools)
	}

	content := strings.TrimSpace(cr.Choices[0].Message.Content)
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	var call ToolCall
	if err := json.Unmarshal([]byte(strings.TrimSpace(content)), &call); err != nil || call.Tool == "" {
		return n.fallback.Route(ctx, question, tools)
	}
	// Guard against the model naming a tool we don't expose.
	if !validTool(call.Tool, tools) {
		return n.fallback.Route(ctx, question, tools)
	}
	return call, nil
}

func validTool(name string, tools []ToolSpec) bool {
	for _, t := range tools {
		if t.Name == name {
			return true
		}
	}
	return false
}
