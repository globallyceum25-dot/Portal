// Package lifecycle orchestrates the Service Request lifecycle (spec §3):
// submission → job card → routing → (approval) → acknowledge → in-progress →
// complete → CSAT, with an audit entry and notification fan-out at every step.
//
// It is the transaction script that ties together the Routing Engine, the
// store, the audit primitive, and the notifier. State transitions are validated
// here; handlers stay thin.
package lifecycle

import (
	"context"
	"fmt"
	"time"

	"lyceumconnect/backend/internal/audit"
	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/notify"
	"lyceumconnect/backend/internal/pii"
	"lyceumconnect/backend/internal/routing"
	"lyceumconnect/backend/internal/store"
)

// Error carries an HTTP status so handlers can map failures without a switch.
type Error struct {
	Code int
	Msg  string
}

func (e *Error) Error() string { return e.Msg }
func errf(code int, format string, a ...any) *Error {
	return &Error{Code: code, Msg: fmt.Sprintf(format, a...)}
}

type Service struct {
	store    store.Store
	notifier *notify.Notifier
}

func New(s store.Store, n *notify.Notifier) *Service {
	return &Service{store: s, notifier: n}
}

// SubmitInput is the payload from request-form.html.
type SubmitInput struct {
	ServiceID string
	Priority  string
	Fields    map[string]string
}

// Submit creates a Job Card, runs it through the Routing Engine, applies any
// approval hold, and notifies (spec §3.1–3.4).
func (s *Service) Submit(ctx context.Context, actor models.User, in SubmitInput) (*models.JobCard, error) {
	svc, err := s.store.GetService(ctx, in.ServiceID)
	if err != nil {
		return nil, errf(500, "service lookup failed")
	}
	if svc == nil {
		return nil, errf(404, "unknown service: %s", in.ServiceID)
	}

	// PII minimisation before persistence (spec §13.1 / PDPA §10).
	fields := map[string]string{}
	for k, v := range in.Fields {
		fields[k] = pii.Mask(v)
	}
	priority := in.Priority
	if priority == "" {
		priority = "Normal"
	}

	plan := routing.Route(*svc)
	jc := &models.JobCard{
		TenantID:       actor.TenantID,
		ServiceID:      svc.ID,
		ServiceName:    svc.Name,
		Category:       svc.Category,
		RequesterID:    actor.ID,
		RequesterName:  actor.Name,
		RequesterEmail: actor.Email,
		Priority:       priority,
		Fields:         fields,
		Queue:          plan.Queue,
		RoutePath:      plan.Path,
		SLADeadline:    time.Now().UTC().Add(time.Duration(svc.SLAHours) * time.Hour),
		Approval:       models.Approval{Required: svc.ApprovalRequired},
	}
	jc.Log(actor.ID, actor.Role, models.StatusSubmitted, "Request submitted")

	if svc.ApprovalRequired {
		jc.Log("system", "", models.StatusPendingApproval, "Awaiting HOD approval before routing")
	} else {
		jc.Log("system", "", plan.Status, plan.Reason)
	}

	created, err := s.store.CreateJobCard(ctx, jc)
	if err != nil {
		return nil, errf(500, "could not create job card")
	}

	_ = audit.Record(ctx, s.store, actor, "jobcard.created", "jobcard:"+created.Ref, map[string]any{
		"service": svc.ID, "queue": created.Queue, "route": plan.Path,
	})
	s.notifier.Notify(ctx, notify.Event{
		JobRef: created.Ref, Kind: "submitted", Recipient: actor.Email,
		Message: fmt.Sprintf("Your request %q was submitted (%s).", svc.Name, created.Ref),
	})
	return created, nil
}

// Approve resolves an HOD approval gate (spec §3.6).
func (s *Service) Approve(ctx context.Context, actor models.User, ref, decision, comment string) (*models.JobCard, error) {
	if !roleIn(actor, models.RoleHODManager) {
		return nil, errf(403, "only an HOD/Manager may approve")
	}
	jc, e := s.get(ctx, ref)
	if e != nil {
		return nil, e
	}
	if !jc.Approval.Required || jc.Status != models.StatusPendingApproval {
		return nil, errf(409, "request is not awaiting approval")
	}
	jc.Approval.Decision = decision
	jc.Approval.ByID = actor.ID
	jc.Approval.At = time.Now().UTC()
	jc.Approval.Comment = comment

	switch decision {
	case "approve":
		jc.Log(actor.ID, actor.Role, models.StatusUnderReview, "Approved by HOD; entering queue")
	case "reject":
		jc.Log(actor.ID, actor.Role, models.StatusRejected, "Rejected by HOD: "+comment)
	case "more_info":
		jc.Log(actor.ID, actor.Role, models.StatusPendingApproval, "More information requested: "+comment)
	default:
		return nil, errf(400, "decision must be approve, reject, or more_info")
	}
	return s.persist(ctx, actor, jc, "jobcard.approval_"+decision,
		fmt.Sprintf("Your request %s was %s by approver.", ref, decision))
}

// Acknowledge is the assignee picking up the card in their queue (spec §3.4).
func (s *Service) Acknowledge(ctx context.Context, actor models.User, ref string) (*models.JobCard, error) {
	if !roleIn(actor, models.RoleDeptStaff, models.RoleLGHITReviewer, models.RoleZTETechnician, models.RoleCompanyAdmin) {
		return nil, errf(403, "not a queue handler")
	}
	jc, e := s.get(ctx, ref)
	if e != nil {
		return nil, e
	}
	if jc.Status != models.StatusUnderReview && jc.Status != models.StatusForwarded {
		return nil, errf(409, "request cannot be acknowledged from %s", jc.Status)
	}
	jc.AssigneeID = actor.ID
	jc.Log(actor.ID, actor.Role, models.StatusAcknowledged, "Acknowledged by assignee")
	return s.persist(ctx, actor, jc, "jobcard.acknowledged",
		fmt.Sprintf("Your request %s was acknowledged.", ref))
}

// Start moves an acknowledged card into active work (spec §3.5).
func (s *Service) Start(ctx context.Context, actor models.User, ref string) (*models.JobCard, error) {
	jc, e := s.get(ctx, ref)
	if e != nil {
		return nil, e
	}
	if jc.Status != models.StatusAcknowledged {
		return nil, errf(409, "request must be acknowledged before starting")
	}
	jc.Log(actor.ID, actor.Role, models.StatusInProgress, "Work started")
	return s.persist(ctx, actor, jc, "jobcard.in_progress",
		fmt.Sprintf("Your request %s is now in progress.", ref))
}

// Forward moves a card from the LGH IT review queue to ZTE (spec §3.3 second tier).
func (s *Service) Forward(ctx context.Context, actor models.User, ref, note string) (*models.JobCard, error) {
	if !roleIn(actor, models.RoleLGHITReviewer) {
		return nil, errf(403, "only an LGH IT reviewer may forward to ZTE")
	}
	jc, e := s.get(ctx, ref)
	if e != nil {
		return nil, e
	}
	if jc.Queue != models.QueueLGHIT {
		return nil, errf(409, "request is not in the LGH IT review queue")
	}
	jc.Queue = models.QueueZTE
	jc.AssigneeID = "" // ZTE re-acknowledges
	jc.Log(actor.ID, actor.Role, models.StatusForwarded, "Forwarded to ZTE: "+note)
	return s.persist(ctx, actor, jc, "jobcard.forwarded_zte",
		fmt.Sprintf("Your request %s was approved by LGH IT and forwarded to ZTE.", ref))
}

// RejectReview rejects a card during LGH IT review (spec §3.3).
func (s *Service) RejectReview(ctx context.Context, actor models.User, ref, note string) (*models.JobCard, error) {
	if !roleIn(actor, models.RoleLGHITReviewer) {
		return nil, errf(403, "only an LGH IT reviewer may reject here")
	}
	jc, e := s.get(ctx, ref)
	if e != nil {
		return nil, e
	}
	if jc.Queue != models.QueueLGHIT {
		return nil, errf(409, "request is not in the LGH IT review queue")
	}
	jc.Log(actor.ID, actor.Role, models.StatusRejected, "Rejected by LGH IT: "+note)
	return s.persist(ctx, actor, jc, "jobcard.rejected",
		fmt.Sprintf("Your request %s was rejected by LGH IT review.", ref))
}

// Complete marks the job done and prompts for CSAT (spec §3.7–3.8).
func (s *Service) Complete(ctx context.Context, actor models.User, ref, notes string) (*models.JobCard, error) {
	if !roleIn(actor, models.RoleDeptStaff, models.RoleLGHITReviewer, models.RoleZTETechnician, models.RoleCompanyAdmin) {
		return nil, errf(403, "not a queue handler")
	}
	jc, e := s.get(ctx, ref)
	if e != nil {
		return nil, e
	}
	if jc.Status != models.StatusInProgress && jc.Status != models.StatusAcknowledged {
		return nil, errf(409, "request cannot be completed from %s", jc.Status)
	}
	jc.Log(actor.ID, actor.Role, models.StatusCompleted, "Completed: "+notes)
	return s.persist(ctx, actor, jc, "jobcard.completed",
		fmt.Sprintf("Your request %s is complete. Please rate your experience.", ref))
}

// SubmitCSAT records the requester's satisfaction rating (spec §3.8).
func (s *Service) SubmitCSAT(ctx context.Context, actor models.User, ref string, rating int, comment string) (*models.JobCard, error) {
	jc, e := s.get(ctx, ref)
	if e != nil {
		return nil, e
	}
	if jc.RequesterID != actor.ID {
		return nil, errf(403, "only the requester may rate this request")
	}
	if jc.Status != models.StatusCompleted {
		return nil, errf(409, "CSAT is available only after completion")
	}
	if rating < 1 || rating > 5 {
		return nil, errf(400, "rating must be 1–5")
	}
	jc.CSAT = &models.CSAT{Rating: rating, Comment: pii.Mask(comment), At: time.Now().UTC()}
	jc.UpdatedAt = time.Now().UTC()
	if err := s.store.UpdateJobCard(ctx, jc); err != nil {
		return nil, errf(500, "could not save rating")
	}
	_ = audit.Record(ctx, s.store, actor, "jobcard.csat", "jobcard:"+ref, map[string]any{"rating": rating})
	return jc, nil
}

// --- helpers ---

func (s *Service) get(ctx context.Context, ref string) (*models.JobCard, *Error) {
	jc, err := s.store.GetJobCard(ctx, ref)
	if err != nil {
		return nil, errf(500, "job card lookup failed")
	}
	if jc == nil {
		return nil, errf(404, "no request with reference %s", ref)
	}
	return jc, nil
}

// persist saves the card, writes the audit line, and fans out the notification.
func (s *Service) persist(ctx context.Context, actor models.User, jc *models.JobCard, action, msg string) (*models.JobCard, error) {
	if err := s.store.UpdateJobCard(ctx, jc); err != nil {
		return nil, errf(500, "could not update request")
	}
	_ = audit.Record(ctx, s.store, actor, action, "jobcard:"+jc.Ref, map[string]any{"status": jc.Status})
	s.notifier.Notify(ctx, notify.Event{JobRef: jc.Ref, Kind: string(jc.Status), Recipient: jc.RequesterEmail, Message: msg})
	return jc, nil
}

func roleIn(u models.User, roles ...models.Role) bool {
	if u.Role == models.RoleGroupSuperAdmin {
		return true
	}
	for _, r := range roles {
		if u.Role == r {
			return true
		}
	}
	return false
}
