package bot

import (
	"context"
	"strings"
	"testing"

	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/store"
)

// seedCard puts a job card in the store owned by requesterID in tenant.
func seedCard(t *testing.T, s store.Store, requesterID, tenant, service string) *models.JobCard {
	t.Helper()
	c, err := s.CreateJobCard(context.Background(), &models.JobCard{
		TenantID: tenant, ServiceName: service, Category: "IT Support",
		RequesterID: requesterID, Status: models.StatusUnderReview, Queue: models.QueueLGHIT,
	})
	if err != nil {
		t.Fatalf("seed card: %v", err)
	}
	return c
}

func TestBot_RequestStatus_IsGrounded(t *testing.T) {
	s := store.NewMemory()
	card := seedCard(t, s, "usr_alice", "lgh", "IT Support")
	a := New(s, Heuristic{})

	alice := models.User{ID: "usr_alice", TenantID: "lgh", Role: models.RoleEmployee, Name: "Alice"}
	ans, err := a.Ask(context.Background(), alice, "what's the status of "+card.Ref+"?")
	if err != nil {
		t.Fatalf("ask: %v", err)
	}
	if !strings.Contains(ans.Text, card.Ref) || !strings.Contains(ans.Text, "under review") {
		t.Fatalf("answer not grounded in the real card status: %q", ans.Text)
	}
	if len(ans.Citations) == 0 || ans.Citations[0].Ref != card.Ref {
		t.Fatalf("expected a citation back to %s, got %+v", card.Ref, ans.Citations)
	}
}

func TestBot_RBAC_CannotSeeAnothersTicket(t *testing.T) {
	s := store.NewMemory()
	card := seedCard(t, s, "usr_alice", "lgh", "IT Support")
	a := New(s, Heuristic{})

	// Bob is an employee in the same tenant but not the requester.
	bob := models.User{ID: "usr_bob", TenantID: "lgh", Role: models.RoleEmployee, Name: "Bob"}
	ans, _ := a.Ask(context.Background(), bob, "status of "+card.Ref)
	if !strings.Contains(strings.ToLower(ans.Text), "don't have access") {
		t.Fatalf("employee should be denied another user's ticket, got: %q", ans.Text)
	}
}

func TestBot_RBAC_QueueSummaryRequiresStaff(t *testing.T) {
	s := store.NewMemory()
	seedCard(t, s, "usr_alice", "lgh", "IT Support")
	a := New(s, Heuristic{})

	employee := models.User{ID: "usr_alice", TenantID: "lgh", Role: models.RoleEmployee, Name: "Alice"}
	ans, _ := a.Ask(context.Background(), employee, "how many unacknowledged requests are in the IT queue?")
	if !strings.Contains(strings.ToLower(ans.Text), "available to") {
		t.Fatalf("employee should be denied queue summary, got: %q", ans.Text)
	}

	reviewer := models.User{ID: "usr_rev", TenantID: "lgh", Role: models.RoleLGHITReviewer, Name: "Rev"}
	ans2, _ := a.Ask(context.Background(), reviewer, "how many unacknowledged requests are in the IT queue?")
	if !strings.Contains(ans2.Text, "LGH IT Review") {
		t.Fatalf("reviewer should get a queue summary, got: %q", ans2.Text)
	}
}
