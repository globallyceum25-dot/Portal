package models

import "time"

// DocVersion is one entry in a document's version history (spec §4).
type DocVersion struct {
	Version string    `json:"version"`
	At      time.Time `json:"at"`
	Note    string    `json:"note,omitempty"`
}

// Document is a Knowledge Center item whose metadata is synced from OneDrive /
// SharePoint and cached in the portal DB (spec §4). The binary lives in
// OneDrive; we index title/type/tags/version and track read-confirmations.
type Document struct {
	ID         string       `json:"id"`
	TenantID   string       `json:"tenant_id"` // "lgh" => group-wide
	Title      string       `json:"title"`
	DocType    string       `json:"doc_type"` // SOP | Policy | Memo | Form | Template
	Company    string       `json:"company"`
	Tags       []string     `json:"tags"`
	Version    string       `json:"version"`
	URL        string       `json:"url"`               // OneDrive/SharePoint web link
	Source     string       `json:"source"`            // "onedrive" | "seed"
	ExternalID string       `json:"external_id,omitempty"`
	ExpiresAt  *time.Time   `json:"expires_at,omitempty"` // drives expiry alerts
	Versions   []DocVersion `json:"versions,omitempty"`
	ReadBy     []string     `json:"read_by,omitempty"` // user ids that confirmed reading
	UpdatedAt  time.Time    `json:"updated_at"`
}

// Announcement scopes and priority (spec §7).
type Announcement struct {
	ID         string    `json:"id"`
	TenantID   string    `json:"tenant_id"`  // "lgh" => group-wide, else company
	Scope      string    `json:"scope"`      // group | company | department
	Department string    `json:"department,omitempty"`
	Title      string    `json:"title"`
	Body       string    `json:"body"`
	Category   string    `json:"category"`   // HR Policy | IT Maintenance | Event | Achievement | Emergency
	Priority   string    `json:"priority"`   // Normal | Important | Urgent
	AuthorID   string    `json:"author_id"`
	AuthorName string    `json:"author_name"`
	ReadBy     []string  `json:"read_by,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// Contains reports whether id is in the list (used for read-confirmation state).
func Contains(list []string, id string) bool {
	for _, v := range list {
		if v == id {
			return true
		}
	}
	return false
}
