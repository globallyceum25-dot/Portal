package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"

	"lyceumconnect/backend/internal/config"
	"lyceumconnect/backend/internal/models"
)

// Authenticator wraps the Microsoft Entra ID OIDC provider and the OAuth2 client
// for the authorization-code flow (with PKCE). Built only when Entra is
// configured; nil otherwise.
type Authenticator struct {
	provider *oidc.Provider
	verifier *oidc.IDTokenVerifier
	oauth    oauth2.Config
	secure   bool // Secure cookies when the redirect URL is https
}

// NewAuthenticator performs OIDC discovery against the tenant's issuer.
func NewAuthenticator(ctx context.Context, cfg config.Config) (*Authenticator, error) {
	issuer := "https://login.microsoftonline.com/" + cfg.Entra.TenantID + "/v2.0"
	provider, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, err
	}
	return &Authenticator{
		provider: provider,
		verifier: provider.Verifier(&oidc.Config{ClientID: cfg.Entra.ClientID}),
		oauth: oauth2.Config{
			ClientID:     cfg.Entra.ClientID,
			ClientSecret: cfg.Entra.ClientSecret,
			Endpoint:     provider.Endpoint(),
			RedirectURL:  cfg.Entra.RedirectURL,
			Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
		},
		secure: strings.HasPrefix(cfg.Entra.RedirectURL, "https://"),
	}, nil
}

// entraClaims is the subset of id_token claims we consume.
type entraClaims struct {
	Email             string   `json:"email"`
	PreferredUsername string   `json:"preferred_username"`
	Name              string   `json:"name"`
	OID               string   `json:"oid"`   // stable Entra object id
	Roles             []string `json:"roles"` // Entra app roles
}

// toUser maps verified Entra claims to a domain User. Role comes from the app
// roles claim (first value that matches one of ours), defaulting to employee.
// Tenant defaults to the group tenant; company mapping is a later refinement.
func (ec entraClaims) toUser() models.User {
	email := ec.Email
	if email == "" {
		email = ec.PreferredUsername
	}
	role := models.RoleEmployee
	for _, r := range ec.Roles {
		if models.Role(r).Valid() {
			role = models.Role(r)
			break
		}
	}
	name := ec.Name
	if name == "" {
		name = email
	}
	return models.User{Email: email, Name: name, TenantID: "lgh", Role: role}
}

// --- PKCE + one-time state helpers ---

func randToken() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func pkceChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func (a *Authenticator) setCookie(w http.ResponseWriter, name, value string) {
	http.SetCookie(w, &http.Cookie{
		Name: name, Value: value, Path: "/", MaxAge: 600,
		HttpOnly: true, Secure: a.secure, SameSite: http.SameSiteLaxMode,
	})
}

func (a *Authenticator) clearCookie(w http.ResponseWriter, name string) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
}

// authCodeURL builds the Entra authorize redirect with state, nonce and PKCE.
func (a *Authenticator) authCodeURL(state, nonce, challenge string) string {
	return a.oauth.AuthCodeURL(state,
		oidc.Nonce(nonce),
		oauth2.SetAuthURLParam("code_challenge", challenge),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
	)
}

// exchange swaps the code (with the PKCE verifier) for a verified id_token's
// claims.
func (a *Authenticator) exchange(ctx context.Context, code, verifier, nonce string) (*entraClaims, error) {
	tok, err := a.oauth.Exchange(ctx, code, oauth2.SetAuthURLParam("code_verifier", verifier))
	if err != nil {
		return nil, err
	}
	rawID, ok := tok.Extra("id_token").(string)
	if !ok {
		return nil, errNoIDToken
	}
	idt, err := a.verifier.Verify(ctx, rawID)
	if err != nil {
		return nil, err
	}
	if idt.Nonce != nonce {
		return nil, errBadNonce
	}
	var ec entraClaims
	if err := idt.Claims(&ec); err != nil {
		return nil, err
	}
	return &ec, nil
}

type oidcError string

func (e oidcError) Error() string { return string(e) }

const (
	errNoIDToken oidcError = "no id_token in token response"
	errBadNonce  oidcError = "nonce mismatch"
)

var _ = time.Now // reserved for future token-expiry handling
