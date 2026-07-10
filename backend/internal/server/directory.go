package server

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"lyceumconnect/backend/internal/directory"
	"lyceumconnect/backend/internal/httpx"
)

// directoryAPI serves the Employee Directory (spec §"Employee Directory"). The
// roster is read-only and visible to every authenticated user; search, filter
// and pagination happen server-side so the client only ships one page at a time.
type directoryAPI struct {
	dir *directory.Directory
}

// list handles GET /api/directory?q=&dept=&tag=&page=&page_size=
func (a *directoryAPI) list(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	size, _ := strconv.Atoi(c.QueryParam("page_size"))
	res := a.dir.Search(directory.Query{
		Q:        c.QueryParam("q"),
		Dept:     c.QueryParam("dept"),
		Tag:      c.QueryParam("tag"),
		Page:     page,
		PageSize: size,
	})
	return httpx.OK(c, res)
}

// get handles GET /api/directory/:id — a single employee for their dashboard.
func (a *directoryAPI) get(c echo.Context) error {
	e, ok := a.dir.Get(c.Param("id"))
	if !ok {
		return httpx.Err(c, http.StatusNotFound, "no such employee")
	}
	return httpx.OK(c, e)
}
