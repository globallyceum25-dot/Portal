// Package knowledge implements the Knowledge Center document sync (spec §4):
// metadata is pulled from a Source (OneDrive/SharePoint in production) and cached
// into the portal DB. The pattern is scheduled sync + on-demand fetch.
//
// The Source is an interface so the real Microsoft Graph adapter and the seed
// adapter are interchangeable — the same swap-behind-a-config-gate approach used
// for Entra SSO. Only the seed source is wired now; GraphSource is the seam.
package knowledge

import (
	"context"
	"log"
	"time"

	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/store"
)

// Source produces document metadata to be cached.
type Source interface {
	Name() string
	Fetch(ctx context.Context) ([]models.Document, error)
}

// Syncer upserts a source's documents into the store.
type Syncer struct {
	source Source
	store  store.Store
}

func NewSyncer(src Source, s store.Store) *Syncer { return &Syncer{source: src, store: s} }

// Sync fetches from the source and caches metadata. Idempotent: documents are
// upserted by ID, so re-running refreshes rather than duplicates.
func (s *Syncer) Sync(ctx context.Context) (int, error) {
	docs, err := s.source.Fetch(ctx)
	if err != nil {
		return 0, err
	}
	for i := range docs {
		docs[i].UpdatedAt = time.Now().UTC()
		if err := s.store.UpsertDocument(ctx, &docs[i]); err != nil {
			return 0, err
		}
	}
	log.Printf("knowledge: synced %d documents from %s", len(docs), s.source.Name())
	return len(docs), nil
}

// SeedSource is the built-in demo catalog, always available so the Knowledge
// Center works without OneDrive credentials.
type SeedSource struct{}

func (SeedSource) Name() string { return "seed" }

func (SeedSource) Fetch(_ context.Context) ([]models.Document, error) {
	soon := time.Now().Add(21 * 24 * time.Hour) // expiring within ~3 weeks
	past := time.Now().Add(-2 * 24 * time.Hour)  // already expired
	return []models.Document{
		{ID: "doc-it-security", TenantID: "lgh", Title: "IT Security Policy", DocType: "Policy", Company: "LGH Group", Tags: []string{"security", "compliance"}, Version: "3.1", URL: "#", Source: "seed",
			Versions: []models.DocVersion{{Version: "3.1", At: time.Now().Add(-30 * 24 * time.Hour), Note: "Added MFA section"}, {Version: "3.0", At: time.Now().Add(-200 * 24 * time.Hour)}}},
		{ID: "doc-leave-sop", TenantID: "lgh", Title: "Leave Request SOP", DocType: "SOP", Company: "Human Resources", Tags: []string{"hr", "leave"}, Version: "2.0", URL: "#", Source: "seed"},
		{ID: "doc-vehicle-form", TenantID: "lgh", Title: "Company Vehicle Booking Form", DocType: "Form", Company: "Facility", Tags: []string{"facility", "transport"}, Version: "1.4", URL: "#", Source: "seed"},
		{ID: "doc-onboarding", TenantID: "lgh", Title: "New Employee Onboarding Memo", DocType: "Memo", Company: "Human Resources", Tags: []string{"hr", "onboarding"}, Version: "1.0", URL: "#", Source: "seed", ExpiresAt: &soon},
		{ID: "doc-brand-kit", TenantID: "lgh", Title: "Brand Guidelines Template", DocType: "Template", Company: "Marketing", Tags: []string{"brand", "design"}, Version: "5.2", URL: "#", Source: "seed"},
		{ID: "doc-pdpa-notice", TenantID: "lgh", Title: "PDPA Data Handling Policy", DocType: "Policy", Company: "LGH Group", Tags: []string{"pdpa", "privacy", "compliance"}, Version: "1.1", URL: "#", Source: "seed", ExpiresAt: &past},
	}, nil
}
