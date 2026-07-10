package server

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"lyceumconnect/backend/internal/audit"
	"lyceumconnect/backend/internal/bot"
	"lyceumconnect/backend/internal/httpx"
	"lyceumconnect/backend/internal/middleware"
	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/pii"
	"lyceumconnect/backend/internal/store"
)

// botAPI serves the Portal Bot (spec §13.5). Every answer is produced by the
// grounded, RBAC-scoped Assistant, and each exchange is logged (PII-masked) as a
// BotConversationLog for audit and model improvement.
type botAPI struct {
	store     store.Store
	assistant *bot.Assistant
}

type botAskReq struct {
	Question string `json:"question"`
}

func (a *botAPI) ask(c echo.Context) error {
	u, _ := middleware.CurrentUser(c)
	var body botAskReq
	if err := c.Bind(&body); err != nil || body.Question == "" {
		return httpx.Err(c, http.StatusBadRequest, "question is required")
	}

	ans, err := a.assistant.Ask(c.Request().Context(), u, body.Question)
	if err != nil {
		return httpx.Err(c, http.StatusInternalServerError, "the assistant could not answer")
	}

	// Log the exchange, PII-masked, for audit/improvement (spec §13.5).
	_, _ = a.store.CreateBotLog(c.Request().Context(), &models.BotConversationLog{
		TenantID:  u.TenantID,
		ActorID:   u.ID,
		ActorRole: u.Role,
		Turns: []models.BotTurn{{
			Question: pii.Mask(body.Question),
			Answer:   pii.Mask(ans.Text),
			Tools:    ans.Tools,
			At:       time.Now().UTC(),
		}},
	})
	_ = audit.Record(c.Request().Context(), a.store, u, "bot.queried", "bot:"+u.ID,
		map[string]any{"tools": ans.Tools, "engine": ans.Engine})

	return httpx.OK(c, ans)
}
