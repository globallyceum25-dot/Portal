// Package middleware holds the API Gateway's cross-cutting request layers
// (spec §13.3): authentication and RBAC. All protected routes pass through here
// so identity and authorization are enforced in one place, never per-handler.
package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"lyceumconnect/backend/internal/auth"
	"lyceumconnect/backend/internal/httpx"
	"lyceumconnect/backend/internal/models"
)

const ctxUserKey = "lc_user"

// Auth validates the Bearer token and stores the resolved user in the context.
// Requests without a valid token are rejected with 401 before reaching handlers.
func Auth(secret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			h := c.Request().Header.Get("Authorization")
			if !strings.HasPrefix(h, "Bearer ") {
				return httpx.Err(c, http.StatusUnauthorized, "missing bearer token")
			}
			claims, err := auth.Parse(secret, strings.TrimPrefix(h, "Bearer "))
			if err != nil {
				return httpx.Err(c, http.StatusUnauthorized, "invalid or expired token")
			}
			c.Set(ctxUserKey, claims.User())
			return next(c)
		}
	}
}

// CurrentUser returns the authenticated user set by Auth. The bool is false on
// public routes where no user is present.
func CurrentUser(c echo.Context) (models.User, bool) {
	u, ok := c.Get(ctxUserKey).(models.User)
	return u, ok
}
