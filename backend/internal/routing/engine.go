// Package routing is the Routing Engine (spec §3.3) — a named, standalone
// component, not logic buried in a controller. Given a Service, it decides where
// a new Job Card enters the system and the path it will travel.
//
// The defining rule: because ZTE is a third-party company, every service flagged
// LGHITReviewRequired is gated through the LGH Group IT review queue first, then
// forwarded to ZTE — including routine helpdesk. Unflagged services go straight
// to the relevant company/department queue.
package routing

import "lyceumconnect/backend/internal/models"

// Plan is the routing decision for a new Job Card.
type Plan struct {
	Queue     models.Queue     // where the card enters once any approval clears
	Status    models.JobStatus // its status on entry
	Path      []models.Queue   // full planned journey
	Reason    string           // human-readable justification (shown in the timeline)
}

// Route computes the plan for a service. It does not consider the approval gate;
// callers apply approval holding separately (a card may be held pending approval
// before it enters the queue this plan selects).
func Route(svc models.Service) Plan {
	if svc.LGHITReviewRequired {
		return Plan{
			Queue:  models.QueueLGHIT,
			Status: models.StatusUnderReview,
			Path:   []models.Queue{models.QueueLGHIT, models.QueueZTE},
			Reason: "ZTE is a third-party execution arm — gated through LGH Group IT review before forwarding",
		}
	}
	return Plan{
		Queue:  models.QueueDepartment,
		Status: models.StatusUnderReview,
		Path:   []models.Queue{models.QueueDepartment},
		Reason: "Routed directly to the " + dept(svc) + " queue",
	}
}

func dept(svc models.Service) string {
	if svc.Department != "" {
		return svc.Department
	}
	return "department"
}
