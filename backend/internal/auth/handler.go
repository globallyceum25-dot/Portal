package auth

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"lyceumconnect/backend/internal/audit"
	"lyceumconnect/backend/internal/config"
	"lyceumconnect/backend/internal/httpx"
	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/store"
)

type Handler struct {
	cfg   config.Config
	store store.Store
}

func NewHandler(cfg config.Config, s store.Store) *Handler {
	return &Handler{cfg: cfg, store: s}
}

type devLoginReq struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	TenantID string `json:"tenant_id"`
	Role     string `json:"role"`
}

// DevLogin issues a real JWT without Entra, for local development only. It is
// registered only when DEV_AUTH=true. This lets the whole spine be exercised
// before the Entra tenant is wired up — real SSO replaces it via Login/Callback.
func (h *Handler) DevLogin(c echo.Context) error {
	var req devLoginReq
	if err := c.Bind(&req); err != nil {
		return httpx.Err(c, http.StatusBadRequest, "invalid body")
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" {
		return httpx.Err(c, http.StatusBadRequest, "email is required")
	}
	role := models.Role(req.Role)
	if role == "" {
		role = models.RoleEmployee
	}
	if !role.Valid() {
		return httpx.Err(c, http.StatusBadRequest, "unknown role: "+req.Role)
	}
	if req.TenantID == "" {
		req.TenantID = "lgh" // default to the group tenant for convenience
	}
	if req.Name == "" {
		req.Name = req.Email
	}

	user, err := h.store.UpsertUser(c.Request().Context(), &models.User{
		Email: req.Email, Name: req.Name, TenantID: req.TenantID, Role: role,
	})
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not persist user")
	}

	token, exp, err := Issue(h.cfg, *user)
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not issue token")
	}

	_ = audit.Record(c.Request().Context(), h.store, *user, "auth.dev_login", "user:"+user.ID, nil)

	return httpx.OK(c, map[string]any{
		"token":      token,
		"expires_at": exp,
		"user":       user,
	})
}

// Login begins the Microsoft Entra ID OIDC flow. Scaffolded: returns 501 until
// ENTRA_* is configured. Wiring point for coreos/go-oidc in the next step.
func (h *Handler) Login(c echo.Context) error {
	if !h.cfg.Entra.Configured() {
		return httpx.Err(c, http.StatusNotImplemented,
			"Entra ID SSO not configured — set ENTRA_TENANT_ID / ENTRA_CLIENT_ID / ENTRA_CLIENT_SECRET, or use /api/auth/dev-login in development")
	}
	// TODO(phase0): redirect to the Entra authorize endpoint with PKCE + state.
	return httpx.Err(c, http.StatusNotImplemented, "Entra authorize redirect not yet implemented")
}

// Callback handles the Entra OIDC redirect: exchange code, verify id_token,
// upsert the user, issue our JWT. Scaffolded for the next step.
func (h *Handler) Callback(c echo.Context) error {
	return httpx.Err(c, http.StatusNotImplemented, "Entra callback not yet implemented")
}
