package auth

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

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
	authr *Authenticator // nil until Entra ID is configured
}

func NewHandler(cfg config.Config, s store.Store) *Handler {
	h := &Handler{cfg: cfg, store: s}
	if cfg.Entra.Configured() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if a, err := NewAuthenticator(ctx, cfg); err != nil {
			log.Printf("Entra ID discovery failed (%v) — SSO disabled, dev-login only", err)
		} else {
			h.authr = a
			log.Printf("Entra ID SSO ready (tenant %s)", cfg.Entra.TenantID)
		}
	}
	return h
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

// Login begins the Microsoft Entra ID OIDC authorization-code flow: it stores a
// one-time state, nonce and PKCE verifier in short-lived cookies and redirects
// the browser to Entra's authorize endpoint.
func (h *Handler) Login(c echo.Context) error {
	if h.authr == nil {
		return httpx.Err(c, http.StatusNotImplemented,
			"Entra ID SSO not configured — set ENTRA_TENANT_ID / ENTRA_CLIENT_ID / ENTRA_CLIENT_SECRET, or use /api/auth/dev-login in development")
	}
	state, nonce, verifier := randToken(), randToken(), randToken()
	w := c.Response().Writer
	h.authr.setCookie(w, "lc_state", state)
	h.authr.setCookie(w, "lc_nonce", nonce)
	h.authr.setCookie(w, "lc_verifier", verifier)
	return c.Redirect(http.StatusFound, h.authr.authCodeURL(state, nonce, pkceChallenge(verifier)))
}

// Callback handles Entra's redirect: it validates state, exchanges the code
// (with the PKCE verifier), verifies the id_token, upserts the user, issues our
// session JWT, and redirects back to the frontend with the token in the URL
// fragment (never persisted server-side).
func (h *Handler) Callback(c echo.Context) error {
	if h.authr == nil {
		return httpx.Err(c, http.StatusNotImplemented, "Entra ID SSO not configured")
	}
	req := c.Request()
	w := c.Response().Writer

	// Validate one-time state against the cookie.
	stateCookie, err := req.Cookie("lc_state")
	if err != nil || c.QueryParam("state") == "" || c.QueryParam("state") != stateCookie.Value {
		return httpx.Err(c, http.StatusBadRequest, "invalid or expired login state")
	}
	nonceCookie, _ := req.Cookie("lc_nonce")
	verifierCookie, _ := req.Cookie("lc_verifier")
	if nonceCookie == nil || verifierCookie == nil {
		return httpx.Err(c, http.StatusBadRequest, "missing login session")
	}
	// One-time: clear immediately.
	for _, n := range []string{"lc_state", "lc_nonce", "lc_verifier"} {
		h.authr.clearCookie(w, n)
	}

	if e := c.QueryParam("error"); e != "" {
		return httpx.Err(c, http.StatusUnauthorized, "sign-in was cancelled or failed")
	}

	ec, err := h.authr.exchange(req.Context(), c.QueryParam("code"), verifierCookie.Value, nonceCookie.Value)
	if err != nil {
		return httpx.Err(c, http.StatusUnauthorized, "could not verify identity")
	}

	user, err := h.store.UpsertUser(req.Context(), func() *models.User { u := ec.toUser(); return &u }())
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not provision user")
	}
	token, _, err := Issue(h.cfg, *user)
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not issue token")
	}
	_ = audit.Record(req.Context(), h.store, *user, "auth.sso_login", "user:"+user.ID, map[string]any{"idp": "entra"})

	// Hand the token to the SPA via the fragment (kept out of server logs/referrers).
	sep := "#"
	if strings.Contains(h.cfg.FrontendURL, "#") {
		sep = "&"
	}
	return c.Redirect(http.StatusFound, h.cfg.FrontendURL+sep+"token="+token)
}
