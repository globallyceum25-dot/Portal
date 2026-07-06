// Package models holds the core domain types shared across the backend.
// These are the Phase 0 foundation entities: identity, tenancy, and audit.
package models

import "time"

// Role is one of the seven RBAC roles defined in the Lyceum Connect spec (§9).
type Role string

const (
	RoleEmployee        Role = "employee"
	RoleDeptStaff       Role = "dept_staff"
	RoleLGHITReviewer   Role = "lgh_it_reviewer"
	RoleZTETechnician   Role = "zte_technician"
	RoleHODManager      Role = "hod_manager"
	RoleCompanyAdmin    Role = "company_admin"
	RoleGroupSuperAdmin Role = "group_super_admin"
)

// ValidRoles is the closed set of roles the system accepts.
var ValidRoles = map[Role]bool{
	RoleEmployee: true, RoleDeptStaff: true, RoleLGHITReviewer: true,
	RoleZTETechnician: true, RoleHODManager: true, RoleCompanyAdmin: true,
	RoleGroupSuperAdmin: true,
}

func (r Role) Valid() bool { return ValidRoles[r] }

// Tenant is a subsidiary company within LGH Group. Every business row in the
// system carries a TenantID for row-level multi-tenant isolation (spec §10).
type Tenant struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

// User is an authenticated employee. In production the identity is minted by
// Microsoft Entra ID; TenantID + Role drive every downstream authorization check.
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	TenantID  string    `json:"tenant_id"`
	Role      Role      `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

// AuditEntry is one immutable line in the audit trail. Spec §3.9 requires every
// meaningful action to be logged with actor + timestamp; this is that primitive,
// reused by every module rather than reimplemented per feature.
type AuditEntry struct {
	ID        string         `json:"id"`
	TenantID  string         `json:"tenant_id"`
	ActorID   string         `json:"actor_id"`
	ActorRole Role           `json:"actor_role"`
	Action    string         `json:"action"`             // e.g. "auth.login", "jobcard.status_changed"
	Target    string         `json:"target,omitempty"`   // e.g. "jobcard:REQ-2025-048"
	Meta      map[string]any `json:"meta,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
}
