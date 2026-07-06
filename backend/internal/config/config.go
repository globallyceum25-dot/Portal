// Package config loads runtime configuration from the environment.
// The API Gateway (spec §13.3) never lets secrets reach the client — they live
// here, server-side, sourced from env / a secrets manager in production.
package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port          string
	DatabaseURL   string // empty => in-memory dev store (no Postgres required)
	JWTSecret     string
	JWTTTLMinutes int
	DevAuth       bool // enables /api/auth/dev-login for local development
	AllowedOrigin string
	Entra         Entra
}

// Entra holds Microsoft Entra ID (Azure AD) OIDC settings. When unset, SSO
// endpoints return 501 and the dev-login path is used instead.
type Entra struct {
	TenantID     string
	ClientID     string
	ClientSecret string
	RedirectURL  string
}

func (e Entra) Configured() bool {
	return e.TenantID != "" && e.ClientID != "" && e.ClientSecret != ""
}

func Load() Config {
	return Config{
		Port:          getenv("PORT", "8090"),
		DatabaseURL:   getenv("DATABASE_URL", ""),
		JWTSecret:     getenv("JWT_SECRET", "dev-insecure-change-me"),
		JWTTTLMinutes: getenvInt("JWT_TTL_MINUTES", 60),
		DevAuth:       getenvBool("DEV_AUTH", true),
		AllowedOrigin: getenv("ALLOWED_ORIGIN", "http://localhost:8085"),
		Entra: Entra{
			TenantID:     getenv("ENTRA_TENANT_ID", ""),
			ClientID:     getenv("ENTRA_CLIENT_ID", ""),
			ClientSecret: getenv("ENTRA_CLIENT_SECRET", ""),
			RedirectURL:  getenv("ENTRA_REDIRECT_URL", "http://localhost:8090/api/auth/callback"),
		},
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func getenvInt(k string, def int) int {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func getenvBool(k string, def bool) bool {
	if v := os.Getenv(k); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return def
}
