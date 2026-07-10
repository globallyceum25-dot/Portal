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

	// Service catalog (spec §3.1). "lgh" services are group-wide and visible to
	// every tenant; others are scoped to their own tenant.
	ListServices(ctx context.Context, tenantID string) ([]models.Service, error)
	GetService(ctx context.Context, id string) (*models.Service, error)

	// Job Cards (spec §3.2). CreateJobCard assigns the reference number.
	CreateJobCard(ctx context.Context, j *models.JobCard) (*models.JobCard, error)
	GetJobCard(ctx context.Context, ref string) (*models.JobCard, error)
	ListJobCardsByRequester(ctx context.Context, requesterID string) ([]models.JobCard, error)
	ListJobCardsByQueue(ctx context.Context, tenantID string, queue models.Queue) ([]models.JobCard, error)
	UpdateJobCard(ctx context.Context, j *models.JobCard) error

	// Knowledge Center documents (spec §4). Visible = group ("lgh") + own tenant.
	ListDocuments(ctx context.Context, tenantID string) ([]models.Document, error)
	GetDocument(ctx context.Context, id string) (*models.Document, error)
	UpsertDocument(ctx context.Context, d *models.Document) error // sync + read updates

	// Announcements (spec §7).
	ListAnnouncements(ctx context.Context, tenantID string) ([]models.Announcement, error)
	GetAnnouncement(ctx context.Context, id string) (*models.Announcement, error)
	CreateAnnouncement(ctx context.Context, a *models.Announcement) (*models.Announcement, error)
	UpdateAnnouncement(ctx context.Context, a *models.Announcement) error

	// Meetings + Tasks (spec §5).
	CreateMeeting(ctx context.Context, m *models.Meeting) (*models.Meeting, error)
	GetMeeting(ctx context.Context, id string) (*models.Meeting, error)
	ListMeetings(ctx context.Context, tenantID string) ([]models.Meeting, error)
	UpdateMeeting(ctx context.Context, m *models.Meeting) error
	CreateTask(ctx context.Context, t *models.Task) (*models.Task, error)
	GetTask(ctx context.Context, id string) (*models.Task, error)
	ListTasks(ctx context.Context, tenantID string) ([]models.Task, error)
	UpdateTask(ctx context.Context, t *models.Task) error

	// Portal Bot conversation logs (spec §13.5). Stored PII-masked for audit and
	// model-improvement review; scoped to the tenant.
	CreateBotLog(ctx context.Context, l *models.BotConversationLog) (*models.BotConversationLog, error)
	ListBotLogs(ctx context.Context, tenantID string, limit int) ([]models.BotConversationLog, error)

	// Ping reports store health for /healthz.
	Ping(ctx context.Context) error
	Kind() string
	Close()
}
