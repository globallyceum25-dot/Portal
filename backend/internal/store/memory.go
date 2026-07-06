package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"sort"
	"strings"
	"sync"
	"time"

	"lyceumconnect/backend/internal/models"
)

// Memory is a zero-dependency Store used when DATABASE_URL is unset, so the
// backend spine runs and is demonstrable without a Postgres instance.
type Memory struct {
	mu     sync.RWMutex
	users  map[string]*models.User // keyed by lowercased email
	audits []models.AuditEntry
}

func NewMemory() *Memory {
	return &Memory{users: make(map[string]*models.User)}
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

func randID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
