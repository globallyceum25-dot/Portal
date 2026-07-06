package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"lyceumconnect/backend/internal/models"
)

// Memory is a zero-dependency Store used when DATABASE_URL is unset, so the
// backend spine runs and is demonstrable without a Postgres instance.
type Memory struct {
	mu       sync.RWMutex
	users    map[string]*models.User    // keyed by lowercased email
	audits   []models.AuditEntry
	services map[string]models.Service       // keyed by service id
	jobs     map[string]*models.JobCard      // keyed by ref
	docs     map[string]*models.Document     // keyed by id
	anns     map[string]*models.Announcement // keyed by id
	refSeq   int
	annSeq   int
}

func NewMemory() *Memory {
	m := &Memory{
		users:    make(map[string]*models.User),
		services: make(map[string]models.Service),
		jobs:     make(map[string]*models.JobCard),
		docs:     make(map[string]*models.Document),
		anns:     make(map[string]*models.Announcement),
	}
	for _, a := range seedAnnouncements() {
		cp := a
		m.anns[a.ID] = &cp
	}
	// Continue the id sequence past the seeded announcements to avoid collisions.
	m.annSeq = len(m.anns)
	for _, s := range seedServices() {
		m.services[s.ID] = s
	}
	return m
}

// seedServices provides a demo catalog exercising both routing branches and the
// approval gate. In production this comes from the admin-managed catalog.
func seedServices() []models.Service {
	return []models.Service{
		{ID: "it-support", TenantID: "lgh", Name: "IT Support", Category: "IT Support", Department: "IT", SLAHours: 8, LGHITReviewRequired: true},
		{ID: "email-account", TenantID: "lgh", Name: "Email Account", Category: "Email Accounts", Department: "IT", SLAHours: 24, LGHITReviewRequired: true},
		{ID: "new-website", TenantID: "lgh", Name: "New Website / App Build", Category: "Websites & Applications Development", Department: "IT", SLAHours: 72, LGHITReviewRequired: true, ApprovalRequired: true},
		{ID: "vehicle-booking", TenantID: "lgh", Name: "Company Vehicle Booking", Category: "Facility", Department: "Facility", SLAHours: 24},
		{ID: "leave-request", TenantID: "lgh", Name: "Leave Request", Category: "HR", Department: "Human Resources", SLAHours: 48, ApprovalRequired: true},
	}
}

func (m *Memory) Kind() string                     { return "memory" }
func (m *Memory) Ping(ctx context.Context) error   { return nil }
func (m *Memory) Close()                            {}

func (m *Memory) GetUserByEmail(_ context.Context, email string) (*models.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if u, ok := m.users[strings.ToLower(email)]; ok {
		cp := *u
		return &cp, nil
	}
	return nil, nil
}

func (m *Memory) UpsertUser(_ context.Context, u *models.User) (*models.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := strings.ToLower(u.Email)
	if existing, ok := m.users[key]; ok {
		existing.Name = u.Name
		existing.TenantID = u.TenantID
		existing.Role = u.Role
		cp := *existing
		return &cp, nil
	}
	u.ID = "usr_" + randID()
	u.CreatedAt = time.Now().UTC()
	cp := *u
	m.users[key] = &cp
	out := *u
	return &out, nil
}

func (m *Memory) CreateAudit(_ context.Context, e models.AuditEntry) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if e.ID == "" {
		e.ID = "aud_" + randID()
	}
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now().UTC()
	}
	m.audits = append(m.audits, e)
	return nil
}

func (m *Memory) RecentAudit(_ context.Context, tenantID string, limit int) ([]models.AuditEntry, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []models.AuditEntry
	for _, a := range m.audits {
		if tenantID == "" || a.TenantID == tenantID {
			out = append(out, a)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (m *Memory) ListServices(_ context.Context, tenantID string) ([]models.Service, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []models.Service
	for _, s := range m.services {
		if s.TenantID == "lgh" || s.TenantID == tenantID {
			out = append(out, s)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

func (m *Memory) GetService(_ context.Context, id string) (*models.Service, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if s, ok := m.services[id]; ok {
		cp := s
		return &cp, nil
	}
	return nil, nil
}

func (m *Memory) CreateJobCard(_ context.Context, j *models.JobCard) (*models.JobCard, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.refSeq++
	j.Ref = fmt.Sprintf("REQ-%d-%04d", time.Now().Year(), m.refSeq)
	if j.CreatedAt.IsZero() {
		j.CreatedAt = time.Now().UTC()
	}
	j.UpdatedAt = j.CreatedAt
	cp := *j
	m.jobs[j.Ref] = &cp
	out := *j
	return &out, nil
}

func (m *Memory) GetJobCard(_ context.Context, ref string) (*models.JobCard, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if j, ok := m.jobs[ref]; ok {
		cp := *j
		return &cp, nil
	}
	return nil, nil
}

func (m *Memory) ListJobCardsByRequester(_ context.Context, requesterID string) ([]models.JobCard, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []models.JobCard
	for _, j := range m.jobs {
		if j.RequesterID == requesterID {
			out = append(out, *j)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (m *Memory) ListJobCardsByQueue(_ context.Context, tenantID string, queue models.Queue) ([]models.JobCard, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []models.JobCard
	for _, j := range m.jobs {
		if j.Queue == queue && (tenantID == "" || j.TenantID == tenantID) {
			out = append(out, *j)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (m *Memory) UpdateJobCard(_ context.Context, j *models.JobCard) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.jobs[j.Ref]; !ok {
		return fmt.Errorf("job card %s not found", j.Ref)
	}
	cp := *j
	m.jobs[j.Ref] = &cp
	return nil
}

// --- Knowledge Center documents ---

func (m *Memory) ListDocuments(_ context.Context, tenantID string) ([]models.Document, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []models.Document
	for _, d := range m.docs {
		if d.TenantID == "lgh" || d.TenantID == tenantID {
			out = append(out, *d)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Title < out[j].Title })
	return out, nil
}

func (m *Memory) GetDocument(_ context.Context, id string) (*models.Document, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if d, ok := m.docs[id]; ok {
		cp := *d
		return &cp, nil
	}
	return nil, nil
}

func (m *Memory) UpsertDocument(_ context.Context, d *models.Document) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cp := *d
	m.docs[d.ID] = &cp
	return nil
}

// --- Announcements ---

func (m *Memory) ListAnnouncements(_ context.Context, tenantID string) ([]models.Announcement, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []models.Announcement
	for _, a := range m.anns {
		if a.TenantID == "lgh" || a.TenantID == tenantID {
			out = append(out, *a)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (m *Memory) GetAnnouncement(_ context.Context, id string) (*models.Announcement, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if a, ok := m.anns[id]; ok {
		cp := *a
		return &cp, nil
	}
	return nil, nil
}

func (m *Memory) CreateAnnouncement(_ context.Context, a *models.Announcement) (*models.Announcement, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.annSeq++
	a.ID = fmt.Sprintf("ann_%04d", m.annSeq)
	if a.CreatedAt.IsZero() {
		a.CreatedAt = time.Now().UTC()
	}
	cp := *a
	m.anns[a.ID] = &cp
	out := *a
	return &out, nil
}

func (m *Memory) UpdateAnnouncement(_ context.Context, a *models.Announcement) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.anns[a.ID]; !ok {
		return fmt.Errorf("announcement %s not found", a.ID)
	}
	cp := *a
	m.anns[a.ID] = &cp
	return nil
}

func seedAnnouncements() []models.Announcement {
	now := time.Now().UTC()
	return []models.Announcement{
		{ID: "ann_0001", TenantID: "lgh", Scope: "group", Title: "Server maintenance 00:00–03:00 on 07 June", Body: "Group IT will perform scheduled maintenance. Plan ahead — portal access may be intermittent.", Category: "IT Maintenance", Priority: "Important", AuthorName: "Group IT", CreatedAt: now.Add(-24 * time.Hour)},
		{ID: "ann_0002", TenantID: "lgh", Scope: "group", Title: "IT Asset Policy — acknowledgement required by 15 June", Body: "All staff must read and acknowledge the updated IT Asset Policy in the Knowledge Center.", Category: "HR Policy", Priority: "Normal", AuthorName: "HR Department", CreatedAt: now.Add(-48 * time.Hour)},
		{ID: "ann_0003", TenantID: "lgh", Scope: "group", Title: "Annual Sports Day — 30 June", Body: "Join us at Lyceum Sports Ground for the group-wide Annual Sports Day.", Category: "Event", Priority: "Normal", AuthorName: "Events Committee", CreatedAt: now.Add(-72 * time.Hour)},
	}
}

func randID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
