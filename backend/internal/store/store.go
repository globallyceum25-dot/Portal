// Package store defines the persistence boundary. Everything above it depends
// on this interface, not on Postgres — so the in-memory dev store and the real
// Postgres store are interchangeable, and future modules (Job Cards, Tasks, …)
// extend the same seam.
package store

import (
	"context"

	"lyceumconnect/backend/internal/models"
)

type Store interface {
	// Identity
	GetUserByEmail(ctx context.Context, email string) (*models.User, error)
	UpsertUser(ctx context.Context, u *models.User) (*models.User, error)

	// Audit trail (spec §3.9)
	CreateAudit(ctx context.Context, e models.AuditEntry) error
	RecentAudit(ctx context.Context, tenantID string, limit int) ([]models.AuditEntry, error)

	// Ping reports store health for /healthz.
	Ping(ctx context.Context) error
	Kind() string
	Close()
}
