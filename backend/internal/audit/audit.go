// Package audit is the single write path for the audit trail (spec §3.9).
// Every module records through Record() so logging is uniform and never
// reinvented per feature.
package audit

import (
	"context"

	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/store"
)

// Record persists one audit line. Failures are returned but callers generally
// log-and-continue: an audit write must never take down the primary action.
func Record(ctx context.Context, s store.Store, actor models.User, action, target string, meta map[string]any) error {
	return s.CreateAudit(ctx, models.AuditEntry{
		TenantID:  actor.TenantID,
		ActorID:   actor.ID,
		ActorRole: actor.Role,
		Action:    action,
		Target:    target,
		Meta:      meta,
	})
}
