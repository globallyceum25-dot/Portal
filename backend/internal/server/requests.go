package server

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"lyceumconnect/backend/internal/httpx"
	"lyceumconnect/backend/internal/lifecycle"
	"lyceumconnect/backend/internal/middleware"
	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/store"
)

// requestsAPI holds the handlers for the Service Request lifecycle.
type requestsAPI struct {
	store store.Store
	lc    *lifecycle.Service
}

// fail maps a lifecycle.Error's embedded status to the HTTP response.
func fail(c echo.Context, err error) error {
	var le *lifecycle.Error
	if errors.As(err, &le) {
		return httpx.Err(c, le.Code, le.Msg)
	}
	return httpx.Err(c, http.StatusInternalServerError, "unexpected error")
}

func (a *requestsAPI) listServices(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	svcs, err := a.store.ListServices(c.Request().Context(), u.TenantID)
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not load catalog")
	}
	return httpx.OK(c, map[string]any{"services": svcs})
}

type submitReq struct {
	ServiceID string            `json:"service_id"`
	Priority  string            `json:"priority"`
	Fields    map[string]string `json:"fields"`
}

func (a *requestsAPI) submit(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	var r submitReq
	if err := c.Bind(&r); err != nil {
		return httpx.Err(c, http.StatusBadRequest, "invalid body")
	}
	jc, err := a.lc.Submit(c.Request().Context(), u, lifecycle.SubmitInput{
		ServiceID: r.ServiceID, Priority: r.Priority, Fields: r.Fields,
	})
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(http.StatusCreated, jc)
}

func (a *requestsAPI) myRequests(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	jcs, err := a.store.ListJobCardsByRequester(c.Request().Context(), u.ID)
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not load requests")
	}
	return httpx.OK(c, map[string]any{"requests": jcs})
}

func (a *requestsAPI) getRequest(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	jc, err := a.store.GetJobCard(c.Request().Context(), c.Param("ref"))
	if err != nil || jc == nil {
		return httpx.Err(c, http.StatusNotFound, "no such request")
	}
	// Requester sees their own; staff roles see any within scope.
	if jc.RequesterID != u.ID && u.Role == models.RoleEmployee {
		return httpx.Err(c, http.StatusForbidden, "not your request")
	}
	return httpx.OK(c, jc)
}

func (a *requestsAPI) queue(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	if u.Role == models.RoleEmployee {
		return httpx.Err(c, http.StatusForbidden, "queues are for staff")
	}
	scope := u.TenantID
	if u.Role == models.RoleGroupSuperAdmin {
		scope = ""
	}
	jcs, err := a.store.ListJobCardsByQueue(c.Request().Context(), scope, models.Queue(c.Param("queue")))
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not load queue")
	}
	return httpx.OK(c, map[string]any{"queue": c.Param("queue"), "requests": jcs})
}

// --- transition handlers ---

type noteReq struct {
	Note string `json:"note"`
}
type approveReq struct {
	Decision string `json:"decision"`
	Comment  string `json:"comment"`
}
type csatReq struct {
	Rating  int    `json:"rating"`
	Comment string `json:"comment"`
}

func (a *requestsAPI) approve(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	var r approveReq
	_ = c.Bind(&r)
	jc, err := a.lc.Approve(c.Request().Context(), u, c.Param("ref"), r.Decision, r.Comment)
	if err != nil {
		return fail(c, err)
	}
	return httpx.OK(c, jc)
}

func (a *requestsAPI) acknowledge(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	jc, err := a.lc.Acknowledge(c.Request().Context(), u, c.Param("ref"))
	if err != nil {
		return fail(c, err)
	}
	return httpx.OK(c, jc)
}

func (a *requestsAPI) start(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	jc, err := a.lc.Start(c.Request().Context(), u, c.Param("ref"))
	if err != nil {
		return fail(c, err)
	}
	return httpx.OK(c, jc)
}

func (a *requestsAPI) forward(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	var r noteReq
	_ = c.Bind(&r)
	jc, err := a.lc.Forward(c.Request().Context(), u, c.Param("ref"), r.Note)
	if err != nil {
		return fail(c, err)
	}
	return httpx.OK(c, jc)
}

func (a *requestsAPI) reject(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	var r noteReq
	_ = c.Bind(&r)
	jc, err := a.lc.RejectReview(c.Request().Context(), u, c.Param("ref"), r.Note)
	if err != nil {
		return fail(c, err)
	}
	return httpx.OK(c, jc)
}

func (a *requestsAPI) complete(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	var r noteReq
	_ = c.Bind(&r)
	jc, err := a.lc.Complete(c.Request().Context(), u, c.Param("ref"), r.Note)
	if err != nil {
		return fail(c, err)
	}
	return httpx.OK(c, jc)
}

func (a *requestsAPI) csat(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	var r csatReq
	if err := c.Bind(&r); err != nil {
		return httpx.Err(c, http.StatusBadRequest, "invalid body")
	}
	jc, err := a.lc.SubmitCSAT(c.Request().Context(), u, c.Param("ref"), r.Rating, r.Comment)
	if err != nil {
		return fail(c, err)
	}
	return httpx.OK(c, jc)
}
