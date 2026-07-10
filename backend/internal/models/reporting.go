package models

import "time"

// BotTurn is a single question/answer exchange inside a Portal Bot conversation
// (spec §13.5). The answer is grounded — assembled from tool-call results against
// the portal API, not free LLM generation — and Tools records which tool calls
// produced it, so the exchange is auditable and reproducible.
type BotTurn struct {
	Question string    `json:"question"`
	Answer   string    `json:"answer"`
	Tools    []string  `json:"tools,omitempty"` // tool names invoked to ground the answer
	At       time.Time `json:"at"`
}

// BotConversationLog is the audit/improvement record of a Portal Bot session
// (spec §13.5 "BotConversationLog"). It is tenant- and actor-scoped and its
// stored text passes through the PII masking layer before persistence, like the
// meeting transcripts do.
type BotConversationLog struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	ActorID   string    `json:"actor_id"`
	ActorRole Role      `json:"actor_role"`
	Turns     []BotTurn `json:"turns"`
	CreatedAt time.Time `json:"created_at"`
}
