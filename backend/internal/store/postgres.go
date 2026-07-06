package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"lyceumconnect/backend/internal/models"
)

// Postgres is the production Store. It is selected automatically when
// DATABASE_URL is set. Schema lives in db/migrations/0001_init.sql; every table
// carries tenant_id for row-level isolation (spec §10 multi-tenancy).
type Postgres struct{ pool *pgxpool.Pool }

// NewPostgres opens a pooled connection and verifies connectivity.
func NewPostgres(ctx context.Context, dsn string) (*Postgres, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Postgres{pool: pool}, nil
}

func (p *Postgres) Kind() string                   { return "postgres" }
func (p *Postgres) Ping(ctx context.Context) error { return p.pool.Ping(ctx) }
func (p *Postgres) Close()                          { p.pool.Close() }

func (p *Postgres) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	row := p.pool.QueryRow(ctx,
		`SELECT id, email, name, tenant_id, role, created_at
		   FROM users WHERE lower(email) = lower($1)`, email)
	var u models.User
	if err := row.Scan(&u.ID, &u.Email, &u.Name, &u.TenantID, &u.Role, &u.CreatedAt); err != nil {
		// no rows => treat as "not found", not an error, matching the memory store
		return nil, nil
	}
	return &u, nil
}

func (p *Postgres) UpsertUser(ctx context.Context, u *models.User) (*models.User, error) {
	row := p.pool.QueryRow(ctx,
		`INSERT INTO users (email, name, tenant_id, role)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (lower(email)) DO UPDATE
		   SET name = EXCLUDED.name, tenant_id = EXCLUDED.tenant_id, role = EXCLUDED.role
		 RETURNING id, email, name, tenant_id, role, created_at`,
		u.Email, u.Name, u.TenantID, u.Role)
	var out models.User
	if err := row.Scan(&out.ID, &out.Email, &out.Name, &out.TenantID, &out.Role, &out.CreatedAt); err != nil {
		return nil, err
	}
	return &out, nil
}

func (p *Postgres) CreateAudit(ctx context.Context, e models.AuditEntry) error {
	meta, _ := json.Marshal(e.Meta)
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now().UTC()
	}
	_, err := p.pool.Exec(ctx,
		`INSERT INTO audit_log (tenant_id, actor_id, actor_role, action, target, meta, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		e.TenantID, e.ActorID, e.ActorRole, e.Action, e.Target, meta, e.CreatedAt)
	return err
}

func (p *Postgres) RecentAudit(ctx context.Context, tenantID string, limit int) ([]models.AuditEntry, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := p.pool.Query(ctx,
		`SELECT id, tenant_id, actor_id, actor_role, action, target, meta, created_at
		   FROM audit_log
		  WHERE ($1 = '' OR tenant_id = $1)
		  ORDER BY created_at DESC
		  LIMIT $2`, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.AuditEntry
	for rows.Next() {
		var e models.AuditEntry
		var meta []byte
		if err := rows.Scan(&e.ID, &e.TenantID, &e.ActorID, &e.ActorRole, &e.Action, &e.Target, &meta, &e.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(meta, &e.Meta)
		out = append(out, e)
	}
	return out, rows.Err()
}
