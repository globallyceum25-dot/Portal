package server

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"lyceumconnect/backend/internal/audit"
	"lyceumconnect/backend/internal/httpx"
	"lyceumconnect/backend/internal/meetingai"
	"lyceumconnect/backend/internal/middleware"
	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/store"
)

// meetingsAPI serves the meeting → tasks pipeline and the Task Manager (spec §5).
type meetingsAPI struct {
	store    store.Store
	pipeline *meetingai.Pipeline
}

type ingestReq struct {
	Title      string `json:"title"`
	Language   string `json:"language"`
	Transcript string `json:"transcript"`
}

// ingest runs the AI pipeline on a transcript: summary + action items + tasks.
func (a *meetingsAPI) ingest(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	var r ingestReq
	if err := c.Bind(&r); err != nil || r.Transcript == "" {
		return httpx.Err(c, http.StatusBadRequest, "transcript is required")
	}
	if r.Title == "" {
		r.Title = "Untitled meeting"
	}
	if r.Language == "" {
		r.Language = "en"
	}
	meeting, tasks, err := a.pipeline.Process(c.Request().Context(), u, r.Title, r.Language, r.Transcript)
	if err != nil {
		return httpx.Err(c, http.StatusBadGateway, "analysis failed: "+err.Error())
	}
	_ = audit.Record(c.Request().Context(), a.store, u, "meeting.processed", "meeting:"+meeting.ID,
		map[string]any{"tasks": len(tasks), "analyzer": meeting.Analyzer})
	return c.JSON(http.StatusCreated, map[string]any{"meeting": meeting, "tasks": tasks})
}

func (a *meetingsAPI) listMeetings(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	ms, err := a.store.ListMeetings(c.Request().Context(), u.TenantID)
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not load meetings")
	}
	return httpx.OK(c, map[string]any{"meetings": ms})
}

func (a *meetingsAPI) getMeeting(c echo.Context) error {
	m, err := a.store.GetMeeting(c.Request().Context(), c.Param("id"))
	if err != nil || m == nil {
		return httpx.Err(c, http.StatusNotFound, "no such meeting")
	}
	return httpx.OK(c, m)
}

// --- Task Manager ---

func (a *meetingsAPI) listTasks(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	ts, err := a.store.ListTasks(c.Request().Context(), u.TenantID)
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not load tasks")
	}
	return httpx.OK(c, map[string]any{"tasks": ts})
}

type createTaskReq struct {
	Title    string `json:"title"`
	Priority string `json:"priority"`
	Assignee string `json:"assignee"`
}

func (a *meetingsAPI) createTask(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	var r createTaskReq
	if err := c.Bind(&r); err != nil || r.Title == "" {
		return httpx.Err(c, http.StatusBadRequest, "title is required")
	}
	if r.Priority == "" {
		r.Priority = "Normal"
	}
	t, err := a.store.CreateTask(c.Request().Context(), &models.Task{
		TenantID: u.TenantID, Title: r.Title, Priority: r.Priority,
		AssigneeName: r.Assignee, Status: models.TaskTodo, CreatedByID: u.ID,
	})
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not create task")
	}
	return c.JSON(http.StatusCreated, t)
}

type updateTaskReq struct {
	Status string `json:"status"`
}

func (a *meetingsAPI) updateTask(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	t, err := a.store.GetTask(c.Request().Context(), c.Param("id"))
	if err != nil || t == nil {
		return httpx.Err(c, http.StatusNotFound, "no such task")
	}
	var r updateTaskReq
	if err := c.Bind(&r); err != nil {
		return httpx.Err(c, http.StatusBadRequest, "invalid body")
	}
	status := models.TaskStatus(r.Status)
	if !status.Valid() {
		return httpx.Err(c, http.StatusBadRequest, "status must be todo, in_progress, or done")
	}
	t.Status = status
	if err := a.store.UpdateTask(c.Request().Context(), t); err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "could not update task")
	}
	_ = audit.Record(c.Request().Context(), a.store, u, "task.status_changed", "task:"+t.ID, map[string]any{"status": status})
	return httpx.OK(c, t)
}
