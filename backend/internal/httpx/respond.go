// Package httpx holds small HTTP response helpers so handlers stay uniform.
package httpx

import "github.com/labstack/echo/v4"

// Err writes a consistent JSON error envelope.
func Err(c echo.Context, code int, message string) error {
	return c.JSON(code, map[string]any{"error": message})
}

// OK writes a 200 JSON payload.
func OK(c echo.Context, data any) error {
	return c.JSON(200, data)
}
