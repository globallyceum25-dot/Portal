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

func (p *Postgres) ListServices(ctx context.Context, tenantID string) ([]models.Service, error) {
	rows, err := p.pool.Query(ctx,
		`SELECT id, tenant_id, name, category, department, sla_hours, lgh_it_review_required, approval_required
		   FROM services WHERE tenant_id = 'lgh' OR tenant_id = $1 ORDER BY name`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Service
	for rows.Next() {
		var s models.Service
		if err := rows.Scan(&s.ID, &s.TenantID, &s.Name, &s.Category, &s.Department, &s.SLAHours, &s.LGHITReviewRequired, &s.ApprovalRequired); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (p *Postgres) GetService(ctx context.Context, id string) (*models.Service, error) {
	row := p.pool.QueryRow(ctx,
		`SELECT id, tenant_id, name, category, department, sla_hours, lgh_it_review_required, approval_required
		   FROM services WHERE id = $1`, id)
	var s models.Service
	if err := row.Scan(&s.ID, &s.TenantID, &s.Name, &s.Category, &s.Department, &s.SLAHours, &s.LGHITReviewRequired, &s.ApprovalRequired); err != nil {
		return nil, nil
	}
	return &s, nil
}

// Job Cards are stored as a row of scalar columns plus a JSONB `doc` holding the
// full aggregate (timeline, approval, csat). Phase 1 favours this over full
// normalisation; the columns that are queried/filtered are promoted to real
// columns, the rest ride in the document.
func (p *Postgres) CreateJobCard(ctx context.Context, j *models.JobCard) (*models.JobCard, error) {
	var ref string
	if err := p.pool.QueryRow(ctx,
		`SELECT 'REQ-' || extract(year from now())::int || '-' || lpad(nextval('job_ref_seq')::text, 4, '0')`).
		Scan(&ref); err != nil {
		return nil, err
	}
	j.Ref = ref
	now := time.Now().UTC()
	j.CreatedAt, j.UpdatedAt = now, now
	doc, _ := json.Marshal(j)
	_, err := p.pool.Exec(ctx,
		`INSERT INTO job_cards (ref, tenant_id, requester_id, queue, status, doc)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		j.Ref, j.TenantID, j.RequesterID, j.Queue, j.Status, doc)
	if err != nil {
		return nil, err
	}
	out := *j
	return &out, nil
}

func (p *Postgres) GetJobCard(ctx context.Context, ref string) (*models.JobCard, error) {
	var doc []byte
	if err := p.pool.QueryRow(ctx, `SELECT doc FROM job_cards WHERE ref=$1`, ref).Scan(&doc); err != nil {
		return nil, nil
	}
	var j models.JobCard
	if err := json.Unmarshal(doc, &j); err != nil {
		return nil, err
	}
	return &j, nil
}

func (p *Postgres) ListJobCardsByRequester(ctx context.Context, requesterID string) ([]models.JobCard, error) {
	return p.queryJobs(ctx, `SELECT doc FROM job_cards WHERE requester_id=$1 ORDER BY created_at DESC`, requesterID)
}

func (p *Postgres) ListJobCardsByQueue(ctx context.Context, tenantID string, queue models.Queue) ([]models.JobCard, error) {
	return p.queryJobs(ctx,
		`SELECT doc FROM job_cards WHERE queue=$1 AND ($2='' OR tenant_id=$2) ORDER BY created_at DESC`,
		string(queue), tenantID)
}

func (p *Postgres) queryJobs(ctx context.Context, sql string, args ...any) ([]models.JobCard, error) {
	rows, err := p.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.JobCard
	for rows.Next() {
		var doc []byte
		if err := rows.Scan(&doc); err != nil {
			return nil, err
		}
		var j models.JobCard
		if err := json.Unmarshal(doc, &j); err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	return out, rows.Err()
}

func (p *Postgres) UpdateJobCard(ctx context.Context, j *models.JobCard) error {
	j.UpdatedAt = time.Now().UTC()
	doc, _ := json.Marshal(j)
	_, err := p.pool.Exec(ctx,
		`UPDATE job_cards SET queue=$2, status=$3, doc=$4, updated_at=now() WHERE ref=$1`,
		j.Ref, j.Queue, j.Status, doc)
	return err
}

// --- Knowledge Center documents (JSONB aggregate) ---

func (p *Postgres) ListDocuments(ctx context.Context, tenantID string) ([]models.Document, error) {
	rows, err := p.pool.Query(ctx,
		`SELECT doc FROM documents WHERE tenant_id='lgh' OR tenant_id=$1 ORDER BY title`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Document
	for rows.Next() {
		var b []byte
		if err := rows.Scan(&b); err != nil {
			return nil, err
		}
		var d models.Document
		if err := json.Unmarshal(b, &d); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (p *Postgres) GetDocument(ctx context.Context, id string) (*models.Document, error) {
	var b []byte
	if err := p.pool.QueryRow(ctx, `SELECT doc FROM documents WHERE id=$1`, id).Scan(&b); err != nil {
		return nil, nil
	}
	var d models.Document
	if err := json.Unmarshal(b, &d); err != nil {
		return nil, err
	}
	return &d, nil
}

func (p *Postgres) UpsertDocument(ctx context.Context, d *models.Document) error {
	b, _ := json.Marshal(d)
	_, err := p.pool.Exec(ctx,
		`INSERT INTO documents (id, tenant_id, title, doc) VALUES ($1,$2,$3,$4)
		 ON CONFLICT (id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id, title=EXCLUDED.title, doc=EXCLUDED.doc`,
		d.ID, d.TenantID, d.Title, b)
	return err
}

// --- Announcements (JSONB aggregate) ---

func (p *Postgres) ListAnnouncements(ctx context.Context, tenantID string) ([]models.Announcement, error) {
	rows, err := p.pool.Query(ctx,
		`SELECT doc FROM announcements WHERE tenant_id='lgh' OR tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Announcement
	for rows.Next() {
		var b []byte
		if err := rows.Scan(&b); err != nil {
			return nil, err
		}
		var a models.Announcement
		if err := json.Unmarshal(b, &a); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (p *Postgres) GetAnnouncement(ctx context.Context, id string) (*models.Announcement, error) {
	var b []byte
	if err := p.pool.QueryRow(ctx, `SELECT doc FROM announcements WHERE id=$1`, id).Scan(&b); err != nil {
		return nil, nil
	}
	var a models.Announcement
	if err := json.Unmarshal(b, &a); err != nil {
		return nil, err
	}
	return &a, nil
}

func (p *Postgres) CreateAnnouncement(ctx context.Context, a *models.Announcement) (*models.Announcement, error) {
	var id string
	if err := p.pool.QueryRow(ctx, `SELECT 'ann_' || lpad(nextval('ann_seq')::text, 4, '0')`).Scan(&id); err != nil {
		return nil, err
	}
	a.ID = id
	a.CreatedAt = time.Now().UTC()
	b, _ := json.Marshal(a)
	_, err := p.pool.Exec(ctx,
		`INSERT INTO announcements (id, tenant_id, created_at, doc) VALUES ($1,$2,$3,$4)`,
		a.ID, a.TenantID, a.CreatedAt, b)
	if err != nil {
		return nil, err
	}
	out := *a
	return &out, nil
}

func (p *Postgres) UpdateAnnouncement(ctx context.Context, a *models.Announcement) error {
	b, _ := json.Marshal(a)
	_, err := p.pool.Exec(ctx, `UPDATE announcements SET doc=$2 WHERE id=$1`, a.ID, b)
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
