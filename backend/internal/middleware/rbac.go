package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"lyceumconnect/backend/internal/httpx"
	"lyceumconnect/backend/internal/models"
)

// RequireRole guards a route to the given roles. GroupSuperAdmin always passes,
// reflecting spec §9 (full access across all companies and modules). Must be
// mounted after Auth.
func RequireRole(allowed ...models.Role) echo.MiddlewareFunc {
	set := make(map[models.Role]bool, len(allowed))
	for _, r := range allowed {
		set[r] = true
	}
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			u, ok := CurrentUser(c)
			if !ok {
				return httpx.Err(c, http.StatusUnauthorized, "authentication required")
			}
			if u.Role == models.RoleGroupSuperAdmin || set[u.Role] {
				return next(c)
			}
			return httpx.Err(c, http.StatusForbidden, "insufficient role")
		}
	}
}
