// Package server wires the API Gateway: middleware chain, routes, and the
// public/protected boundary. This is the composition root for Phase 0.
package server

import (
	"net/http"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"

	"lyceumconnect/backend/internal/auth"
	"lyceumconnect/backend/internal/config"
	"lyceumconnect/backend/internal/httpx"
	"lyceumconnect/backend/internal/middleware"
	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/store"
)

func New(cfg config.Config, s store.Store) *echo.Echo {
	e := echo.New()
	e.HideBanner = true

	// --- Gateway cross-cutting layers (applied to every request) ---
	e.Use(echomw.RequestID())
	e.Use(echomw.Logger())
	e.Use(echomw.Recover())
	e.Use(echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins: []string{cfg.AllowedOrigin},
		AllowHeaders: []string{echo.HeaderAuthorization, echo.HeaderContentType},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete, http.MethodOptions},
	}))
	// Rate limiting per client IP (spec §13.3). In-memory store for Phase 0.
	e.Use(echomw.RateLimiter(echomw.NewRateLimiterMemoryStore(20)))

	authH := auth.NewHandler(cfg, s)

	// --- Public routes ---
	e.GET("/healthz", health(s))

	api := e.Group("/api")
	api.GET("/auth/login", authH.Login)
	api.GET("/auth/callback", authH.Callback)
	if cfg.DevAuth {
		api.POST("/auth/dev-login", authH.DevLogin)
	}

	// --- Protected routes (require a valid token) ---
	secure := api.Group("", middleware.Auth(cfg.JWTSecret))
	secure.GET("/me", me)

	// Admin-only: proves RBAC and exposes the audit trail.
	admin := secure.Group("/admin", middleware.RequireRole(models.RoleCompanyAdmin, models.RoleGroupSuperAdmin))
	admin.GET("/ping", func(c echo.Context) error {
		u, _ := middleware.CurrentUser(c)
		return httpx.OK(c, map[string]any{"ok": true, "as": u.Email, "role": u.Role})
	})
	admin.GET("/audit", listAudit(s))

	return e
}

func health(s store.Store) echo.HandlerFunc {
	return func(c echo.Context) error {
		dbOK := s.Ping(c.Request().Context()) == nil
		return httpx.OK(c, map[string]any{
			"status": "ok",
			"store":  s.Kind(),
			"store_healthy": dbOK,
		})
	}
}

func me(c echo.Context) error {
	u, ok := middleware.CurrentUser(c)
	if !ok {
		return httpx.Err(c, http.StatusUnauthorized, "no user")
	}
	return httpx.OK(c, u)
}

func listAudit(s store.Store) echo.HandlerFunc {
	return func(c echo.Context) error {
		u, _ := middleware.CurrentUser(c)
		// Group Super Admin sees all tenants; company admins are scoped to theirs.
		scope := u.TenantID
		if u.Role == models.RoleGroupSuperAdmin {
			scope = ""
		}
		entries, err := s.RecentAudit(c.Request().Context(), scope, 50)
		if err != nil {
			return httpx.Err(c, http.StatusInternalServerError, "could not read audit log")
		}
		return httpx.OK(c, map[string]any{"entries": entries})
	}
}
