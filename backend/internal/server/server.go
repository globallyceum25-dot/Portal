// Package server wires the API Gateway: middleware chain, routes, and the
// public/protected boundary. This is the composition root for Phase 0.
package server

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"

	"lyceumconnect/backend/internal/analytics"
	"lyceumconnect/backend/internal/auth"
	"lyceumconnect/backend/internal/bot"
	"lyceumconnect/backend/internal/directory"
	"lyceumconnect/backend/internal/config"
	"lyceumconnect/backend/internal/httpx"
	"lyceumconnect/backend/internal/knowledge"
	"lyceumconnect/backend/internal/lifecycle"
	"lyceumconnect/backend/internal/meetingai"
	"lyceumconnect/backend/internal/middleware"
	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/notify"
	"lyceumconnect/backend/internal/slack"
	"lyceumconnect/backend/internal/store"
)

func New(cfg config.Config, s store.Store) *echo.Echo {
	e := echo.New()
	e.HideBanner = true

	// --- Gateway cross-cutting layers (applied to every request) ---
	e.Use(echomw.RequestID())
	e.Use(echomw.Logger())
	e.Use(echomw.Recover())
	corsCfg := echomw.CORSConfig{
		// ALLOWED_ORIGIN may be a comma-separated list (e.g. the preview server
		// plus a live-server dev port).
		AllowOrigins: splitOrigins(cfg.AllowedOrigin),
		AllowHeaders: []string{echo.HeaderAuthorization, echo.HeaderContentType},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete, http.MethodOptions},
	}
	// In dev mode the static frontend is served by live-server, which floats to a
	// random localhost port when its default is busy. Rather than pin the port,
	// accept any localhost/127.0.0.1 origin — scoped to dev only, mirroring the
	// dev-login gate. Production keeps the strict ALLOWED_ORIGIN allowlist.
	if cfg.DevAuth {
		corsCfg.AllowOriginFunc = func(origin string) (bool, error) {
			return isLocalhostOrigin(origin), nil
		}
	}
	e.Use(echomw.CORSWithConfig(corsCfg))
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

	// Slack Integration Hub (spec §6): owns Slack delivery via the notifier's
	// extra channel, and exposes the inbound interactions endpoint.
	hub := slack.NewHub(slack.Pick(cfg.Slack))
	notifier := notify.Default(slackChannel{hub: hub})

	// Service Request lifecycle (spec §3).
	lc := lifecycle.New(s, notifier)
	reqs := &requestsAPI{store: s, lc: lc}
	secure.GET("/services", reqs.listServices)
	secure.POST("/requests", reqs.submit)
	secure.GET("/requests", reqs.myRequests)
	secure.GET("/requests/:ref", reqs.getRequest)
	secure.POST("/requests/:ref/approve", reqs.approve)
	secure.POST("/requests/:ref/acknowledge", reqs.acknowledge)
	secure.POST("/requests/:ref/start", reqs.start)
	secure.POST("/requests/:ref/forward", reqs.forward)
	secure.POST("/requests/:ref/reject", reqs.reject)
	secure.POST("/requests/:ref/complete", reqs.complete)
	secure.POST("/requests/:ref/csat", reqs.csat)
	secure.GET("/queues/:queue", reqs.queue)

	// Knowledge Center + Announcements (spec §4, §7).
	content := &contentAPI{store: s, syncer: knowledge.NewSyncer(knowledge.SeedSource{}, s), notifier: notifier}
	secure.GET("/documents", content.listDocuments)
	secure.POST("/documents/:id/read", content.confirmRead)
	secure.GET("/announcements", content.listAnnouncements)
	secure.POST("/announcements", content.publish)
	secure.POST("/announcements/:id/read", content.markAnnouncementRead)

	// Meeting transcription → Tasks pipeline + Task Manager (spec §5).
	meetings := &meetingsAPI{store: s, pipeline: meetingai.NewPipeline(s, meetingai.Pick(cfg))}
	secure.POST("/meetings", meetings.ingest)
	secure.GET("/meetings", meetings.listMeetings)
	secure.GET("/meetings/:id", meetings.getMeeting)
	secure.GET("/tasks", meetings.listTasks)
	secure.POST("/tasks", meetings.createTask)
	secure.PATCH("/tasks/:id", meetings.updateTask)

	// Employee Directory (spec §"Employee Directory"). Read-only roster, visible
	// to every authenticated user; search/filter/paginate happen server-side.
	dirH := &directoryAPI{dir: directory.New(140)}
	secure.GET("/directory", dirH.list)
	secure.GET("/directory/:id", dirH.get)

	// Portal Bot — grounded, tool-calling conversational assistant (spec §13.5).
	// Available to every authenticated user; RBAC scoping happens inside the
	// assistant's tools (an Employee only ever reaches their own data).
	botH := &botAPI{store: s, assistant: bot.New(s, bot.Pick(cfg))}
	secure.POST("/bot/ask", botH.ask)

	// Slack Integration Hub (spec §6). Inbound interactions are public (Slack
	// posts server-to-server) but signature-verified when a secret is set.
	slackH := &slackAPI{cfg: cfg.Slack, hub: hub, lc: lc}
	e.POST("/api/slack/interactions", slackH.interactions)

	// Dashboards & Reporting module (spec §13.6). Restricted to HODs, admins and
	// the Group Super Admin; each caller's scope is derived from their role.
	reportsH := &reportsAPI{store: s, builder: analytics.NewBuilder(s), narrator: analytics.Pick(cfg)}
	reports := secure.Group("/reports", middleware.RequireRole(models.RoleHODManager, models.RoleCompanyAdmin, models.RoleGroupSuperAdmin))
	reports.GET("/overview", reportsH.overview)
	reports.GET("/insights", reportsH.insights)
	reports.POST("/ask", reportsH.ask)

	// Admin-only: proves RBAC and exposes the audit trail.
	admin := secure.Group("/admin", middleware.RequireRole(models.RoleCompanyAdmin, models.RoleGroupSuperAdmin))
	admin.POST("/kb/sync", content.syncNow)
	admin.GET("/slack/hub", slackH.hubStatus)
	admin.GET("/bot/logs", func(c echo.Context) error {
		u, _ := middleware.CurrentUser(c)
		scope := u.TenantID
		if u.Role == models.RoleGroupSuperAdmin {
			scope = ""
		}
		logs, err := s.ListBotLogs(c.Request().Context(), scope, 50)
		if err != nil {
			return httpx.Err(c, http.StatusInternalServerError, "could not read bot logs")
		}
		return httpx.OK(c, map[string]any{"logs": logs})
	})
	admin.GET("/ping", func(c echo.Context) error {
		u, _ := middleware.CurrentUser(c)
		return httpx.OK(c, map[string]any{"ok": true, "as": u.Email, "role": u.Role})
	})
	admin.GET("/audit", listAudit(s))

	return e
}

// isLocalhostOrigin reports whether an Origin header points at the local machine
// on any port — used to relax CORS for the floating live-server dev port.
func isLocalhostOrigin(origin string) bool {
	for _, prefix := range []string{"http://localhost:", "http://127.0.0.1:", "http://localhost", "http://127.0.0.1"} {
		if origin == strings.TrimSuffix(prefix, ":") || strings.HasPrefix(origin, prefix) {
			return true
		}
	}
	return false
}

// splitOrigins turns a comma-separated ALLOWED_ORIGIN into a trimmed list.
func splitOrigins(v string) []string {
	var out []string
	for _, p := range strings.Split(v, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
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
