// Package auth issues and validates the portal's session tokens and holds the
// authentication handlers. Tokens are HS256 JWTs carrying the claims every
// downstream RBAC check reads: tenant + role (spec §9, §10).
package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"

	"lyceumconnect/backend/internal/config"
	"lyceumconnect/backend/internal/models"
)

// Claims is the JWT payload. TenantID scopes multi-tenant data access; Role
// drives authorization.
type Claims struct {
	Email    string      `json:"email"`
	Name     string      `json:"name"`
	TenantID string      `json:"tenant_id"`
	Role     models.Role `json:"role"`
	jwt.RegisteredClaims
}

// Issue mints a signed token for an authenticated user.
func Issue(cfg config.Config, u models.User) (string, time.Time, error) {
	exp := time.Now().Add(time.Duration(cfg.JWTTTLMinutes) * time.Minute)
	claims := Claims{
		Email:    u.Email,
		Name:     u.Name,
		TenantID: u.TenantID,
		Role:     u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   u.ID,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(exp),
			Issuer:    "lyceum-connect",
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString([]byte(cfg.JWTSecret))
	return signed, exp, err
}

// Parse validates a token string and returns its claims.
func Parse(secret, tokenStr string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrTokenSignatureInvalid
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	return claims, nil
}

// User reconstructs a domain User from validated claims.
func (c *Claims) User() models.User {
	return models.User{
		ID:       c.Subject,
		Email:    c.Email,
		Name:     c.Name,
		TenantID: c.TenantID,
		Role:     c.Role,
	}
}
