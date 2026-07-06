package models

import "time"

// Queue is a work queue a Job Card can sit in. The two-tier IT flow (spec §3.3)
// is expressed as movement between QueueLGHIT and QueueZTE.
type Queue string

const (
	QueueLGHIT      Queue = "lgh_it_review" // LGH Group IT review queue (first tier)
	QueueZTE        Queue = "zte"           // ZTE execution queue (second tier)
	QueueDepartment Queue = "department"    // direct company/department queue
)

// JobStatus is the lifecycle state of a Job Card (spec §3.1–3.7).
type JobStatus string

const (
	StatusSubmitted       JobStatus = "submitted"        // just created
	StatusPendingApproval JobStatus = "pending_approval" // held at an HOD approval gate
	StatusUnderReview     JobStatus = "under_review"     // in the LGH IT review queue
	StatusForwarded       JobStatus = "forwarded"        // forwarded LGH IT → ZTE
	StatusAcknowledged    JobStatus = "acknowledged"     // assignee acknowledged
	StatusInProgress      JobStatus = "in_progress"
	StatusCompleted       JobStatus = "completed"
	StatusRejected        JobStatus = "rejected"
)

// Service is a catalog entry. The routing flags live here so routing is
// configuration-driven, not hard-coded (spec §3.3 "the flag is configurable").
type Service struct {
	ID                  string `json:"id"`
	TenantID            string `json:"tenant_id"` // "lgh" services are group-wide
	Name                string `json:"name"`
	Category            string `json:"category"`
	Department          string `json:"department"`
	SLAHours            int    `json:"sla_hours"`
	LGHITReviewRequired bool   `json:"lgh_it_review_required"`
	ApprovalRequired    bool   `json:"approval_required"`
}

// StatusEvent is one immutable entry in a Job Card's timeline. Together they are
// the per-card audit trail surfaced in request-tracking (spec §3.9).
type StatusEvent struct {
	At        time.Time `json:"at"`
	ActorID   string    `json:"actor_id"`
	ActorRole Role      `json:"actor_role"`
	Status    JobStatus `json:"status"`
	Note      string    `json:"note,omitempty"`
}

// Approval captures an HOD/Manager approval gate (spec §3.6).
type Approval struct {
	Required bool      `json:"required"`
	Decision string    `json:"decision,omitempty"` // approve | reject | more_info
	ByID     string    `json:"by_id,omitempty"`
	At       time.Time `json:"at,omitempty"`
	Comment  string    `json:"comment,omitempty"`
}

// CSAT is the post-completion satisfaction response (spec §3.8).
type CSAT struct {
	Rating  int       `json:"rating"` // 1..5
	Comment string    `json:"comment,omitempty"`
	At      time.Time `json:"at"`
}

// JobCard is the structured ticket auto-created on submission (spec §3.2). It is
// the aggregate root of the lifecycle: timeline, approval, and CSAT hang off it.
type JobCard struct {
	Ref            string            `json:"ref"` // e.g. REQ-2026-0001
	TenantID       string            `json:"tenant_id"`
	ServiceID      string            `json:"service_id"`
	ServiceName    string            `json:"service_name"`
	Category       string            `json:"category"`
	RequesterID    string            `json:"requester_id"`
	RequesterName  string            `json:"requester_name"`
	RequesterEmail string            `json:"requester_email"`
	Priority       string            `json:"priority"`
	Fields         map[string]string `json:"fields"` // form answers, PII-masked
	Status         JobStatus         `json:"status"`
	Queue          Queue             `json:"queue"`
	AssigneeID     string            `json:"assignee_id,omitempty"`
	RoutePath      []Queue           `json:"route_path"` // planned journey, e.g. [lgh_it_review, zte]
	SLADeadline    time.Time         `json:"sla_deadline"`
	Approval       Approval          `json:"approval"`
	Timeline       []StatusEvent     `json:"timeline"`
	CSAT           *CSAT             `json:"csat,omitempty"`
	CreatedAt      time.Time         `json:"created_at"`
	UpdatedAt      time.Time         `json:"updated_at"`
}

// Log appends a status event to the card's timeline.
func (j *JobCard) Log(actorID string, role Role, status JobStatus, note string) {
	j.Status = status
	j.UpdatedAt = time.Now().UTC()
	j.Timeline = append(j.Timeline, StatusEvent{
		At: j.UpdatedAt, ActorID: actorID, ActorRole: role, Status: status, Note: note,
	})
}
