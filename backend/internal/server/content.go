package server

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"lyceumconnect/backend/internal/audit"
	"lyceumconnect/backend/internal/httpx"
	"lyceumconnect/backend/internal/knowledge"
	"lyceumconnect/backend/internal/middleware"
	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/notify"
	"lyceumconnect/backend/internal/store"
)

// contentAPI serves the Knowledge Center and Announcements (spec §4, §7).
type contentAPI struct {
	store    store.Store
	syncer   *knowledge.Syncer
	notifier *notify.Notifier
}

// --- Knowledge Center ---

func (a *contentAPI) listDocuments(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	docs, err := a.store.ListDocuments(c.Request().Context(), u.TenantID)
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not load documents")
	}
	now := time.Now()
	out := make([]map[string]any, 0, len(docs))
	for _, d := range docs {
		expiring, expired := false, false
		if d.ExpiresAt != nil {
			expired = d.ExpiresAt.Before(now)
			expiring = !expired && d.ExpiresAt.Before(now.Add(30*24*time.Hour))
		}
		out = append(out, map[string]any{
			"id": d.ID, "title": d.Title, "doc_type": d.DocType, "company": d.Company,
			"tags": d.Tags, "version": d.Version, "url": d.URL, "source": d.Source,
			"expires_at": d.ExpiresAt, "expiring": expiring, "expired": expired,
			"versions": d.Versions, "updated_at": d.UpdatedAt,
			"read": models.Contains(d.ReadBy, u.ID),
		})
	}
	return httpx.OK(c, map[string]any{"documents": out})
}

func (a *contentAPI) confirmRead(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	d, err := a.store.GetDocument(c.Request().Context(), c.Param("id"))
	if err != nil || d == nil {
		return httpx.Err(c, http.StatusNotFound, "no such document")
	}
	if !models.Contains(d.ReadBy, u.ID) {
		d.ReadBy = append(d.ReadBy, u.ID)
		if err := a.store.UpsertDocument(c.Request().Context(), d); err != nil {
			return httpx.Err(c, http.StatusInternalServerError, "could not record read")
		}
		_ = audit.Record(c.Request().Context(), a.store, u, "document.read_confirmed", "document:"+d.ID, nil)
	}
	return httpx.OK(c, map[string]any{"read": true})
}

// syncNow triggers an on-demand OneDrive sync (admin only).
func (a *contentAPI) syncNow(c echo.Context) error {
	n, err := a.syncer.Sync(c.Request().Context())
	if err != nil {
		return httpx.Err(c, http.StatusBadGateway, "sync failed: "+err.Error())
	}
	u, _ := middleware.CurrentUser(c)
	_ = audit.Record(c.Request().Context(), a.store, u, "knowledge.sync", "", map[string]any{"count": n})
	return httpx.OK(c, map[string]any{"synced": n})
}

// --- Announcements ---

func (a *contentAPI) listAnnouncements(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	anns, err := a.store.ListAnnouncements(c.Request().Context(), u.TenantID)
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not load announcements")
	}
	out := make([]map[string]any, 0, len(anns))
	for _, an := range anns {
		out = append(out, map[string]any{
			"id": an.ID, "scope": an.Scope, "department": an.Department, "title": an.Title,
			"body": an.Body, "category": an.Category, "priority": an.Priority,
			"author_name": an.AuthorName, "created_at": an.CreatedAt,
			"read": models.Contains(an.ReadBy, u.ID),
		})
	}
	return httpx.OK(c, map[string]any{"announcements": out})
}

type publishReq struct {
	Title      string `json:"title"`
	Body       string `json:"body"`
	Category   string `json:"category"`
	Priority   string `json:"priority"`
	Scope      string `json:"scope"`
	Department string `json:"department"`
}

// publish creates an announcement and fans it out. Company/Group admins only.
func (a *contentAPI) publish(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	if u.Role != models.RoleCompanyAdmin && u.Role != models.RoleGroupSuperAdmin {
		return httpx.Err(c, http.StatusForbidden, "only admins may publish announcements")
	}
	var r publishReq
	if err := c.Bind(&r); err != nil || r.Title == "" {
		return httpx.Err(c, http.StatusBadRequest, "title is required")
	}
	scope := r.Scope
	if scope == "" {
		scope = "company"
	}
	tenant := u.TenantID
	if scope == "group" {
		if u.Role != models.RoleGroupSuperAdmin {
			return httpx.Err(c, http.StatusForbidden, "group-wide announcements require Group Super Admin")
		}
		tenant = "lgh"
	}
	priority := r.Priority
	if priority == "" {
		priority = "Normal"
	}
	an, err := a.store.CreateAnnouncement(c.Request().Context(), &models.Announcement{
		TenantID: tenant, Scope: scope, Department: r.Department, Title: r.Title, Body: r.Body,
		Category: r.Category, Priority: priority, AuthorID: u.ID, AuthorName: u.Name,
	})
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not publish")
	}
	_ = audit.Record(c.Request().Context(), a.store, u, "announcement.published", "announcement:"+an.ID, map[string]any{"priority": priority, "scope": scope})

	// Fan out. Urgent overrides the digest and sends immediately (spec §7);
	// here every publish notifies immediately across channels.
	a.notifier.Notify(c.Request().Context(), notify.Event{
		JobRef: an.ID, Kind: "announcement:" + priority, Recipient: "#announcements",
		Message: "[" + priority + "] " + an.Title,
	})
	return c.JSON(http.StatusCreated, an)
}

func (a *contentAPI) markAnnouncementRead(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	an, err := a.store.GetAnnouncement(c.Request().Context(), c.Param("id"))
	if err != nil || an == nil {
		return httpx.Err(c, http.StatusNotFound, "no such announcement")
	}
	if !models.Contains(an.ReadBy, u.ID) {
		an.ReadBy = append(an.ReadBy, u.ID)
		if err := a.store.UpdateAnnouncement(c.Request().Context(), an); err != nil {
			return httpx.Err(c, http.StatusInternalServerError, "could not record read")
		}
	}
	return httpx.OK(c, map[string]any{"read": true})
}
