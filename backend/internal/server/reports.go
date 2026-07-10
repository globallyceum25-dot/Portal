package server

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"lyceumconnect/backend/internal/analytics"
	"lyceumconnect/backend/internal/audit"
	"lyceumconnect/backend/internal/httpx"
	"lyceumconnect/backend/internal/middleware"
	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/store"
)

// reportsAPI serves the Dashboards & Reporting module (spec §13.6). Access is
// gated to HODs, admins and the Group Super Admin; the scope each caller sees is
// derived from their role, never from a client-supplied tenant, so a Company
// Admin can only ever report on their own company.
type reportsAPI struct {
	store    store.Store
	builder  *analytics.Builder
	narrator analytics.Narrator
}

// scope returns the tenant a caller may report on: empty (all companies) for the
// Group Super Admin, otherwise the caller's own tenant.
func reportScope(u models.User) string {
	if u.Role == models.RoleGroupSuperAdmin {
		return ""
	}
	return u.TenantID
}

// overview returns the full dashboard metrics payload.
func (a *reportsAPI) overview(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	r, err := a.builder.Build(c.Request().Context(), reportScope(u))
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not build report")
	}
	return httpx.OK(c, r)
}

// insights returns the report plus AI-generated natural-language insight
// summaries (grounded in the report figures, spec §13.6).
func (a *reportsAPI) insights(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	r, err := a.builder.Build(c.Request().Context(), reportScope(u))
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not build report")
	}
	ins, err := a.narrator.Insights(c.Request().Context(), r)
	if err != nil {
		return httpx.Err(c, http.StatusBadGateway, "insight generation failed")
	}
	return httpx.OK(c, map[string]any{"insights": ins, "engine": a.narrator.Name(), "generated_at": r.GeneratedAt})
}

type askReportReq struct {
	Question string `json:"question"`
}

// ask answers an ad-hoc natural-language question over the aggregated report
// (spec §13.6: "why did CSAT drop for ZTE in May?"). The answer is grounded in
// the freshly-built report — the model only explains figures it is handed.
func (a *reportsAPI) ask(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	var body askReportReq
	if err := c.Bind(&body); err != nil || body.Question == "" {
		return httpx.Err(c, http.StatusBadRequest, "question is required")
	}
	r, err := a.builder.Build(c.Request().Context(), reportScope(u))
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not build report")
	}
	answer, err := a.narrator.Answer(c.Request().Context(), r, body.Question)
	if err != nil {
		return httpx.Err(c, http.StatusBadGateway, "could not answer")
	}
	_ = audit.Record(c.Request().Context(), a.store, u, "report.queried", "reports:"+r.Scope, map[string]any{"engine": a.narrator.Name()})
	return httpx.OK(c, map[string]any{"answer": answer, "engine": a.narrator.Name()})
}
