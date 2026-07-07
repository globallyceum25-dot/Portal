package models

import "time"

// Task status values (spec §5: To Do / In Progress / Done).
type TaskStatus string

const (
	TaskTodo       TaskStatus = "todo"
	TaskInProgress TaskStatus = "in_progress"
	TaskDone       TaskStatus = "done"
)

func (s TaskStatus) Valid() bool {
	return s == TaskTodo || s == TaskInProgress || s == TaskDone
}

// Task is a unit of work — created manually or auto-generated from a meeting
// transcript and linked back to its source (spec §5).
type Task struct {
	ID              string     `json:"id"`
	TenantID        string     `json:"tenant_id"`
	Title           string     `json:"title"`
	Status          TaskStatus `json:"status"`
	Priority        string     `json:"priority"` // Low | Normal | High
	AssigneeName    string     `json:"assignee_name,omitempty"`
	AssigneeID      string     `json:"assignee_id,omitempty"`
	DueDate         *time.Time `json:"due_date,omitempty"`
	SourceMeetingID string     `json:"source_meeting_id,omitempty"` // link back to transcript
	CreatedByID     string     `json:"created_by_id"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// ActionItem is an extracted to-do with an optional assignee name.
type ActionItem struct {
	Text     string `json:"text"`
	Assignee string `json:"assignee,omitempty"`
}

// Meeting holds a transcript and the AI-derived summary + action items (spec §5).
// The stored transcript is PII-masked; analysis runs on the raw text in memory.
type Meeting struct {
	ID          string       `json:"id"`
	TenantID    string       `json:"tenant_id"`
	Title       string       `json:"title"`
	Language    string       `json:"language"` // en | si | mixed
	Transcript  string       `json:"transcript"`
	Summary     string       `json:"summary"`
	KeyPoints   []string     `json:"key_points"`
	ActionItems []ActionItem `json:"action_items"`
	TaskIDs     []string     `json:"task_ids"`
	Analyzer    string       `json:"analyzer"` // which engine produced the analysis
	CreatedByID string       `json:"created_by_id"`
	CreatedAt   time.Time    `json:"created_at"`
}
