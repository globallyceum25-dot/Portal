// Command server is the Lyceum Connect backend entrypoint (Phase 0 spine).
// It selects a Postgres store when DATABASE_URL is set, otherwise an in-memory
// store so the API runs with zero external dependencies for local development.
package main

import (
	"context"
	"log"

	"lyceumconnect/backend/internal/config"
	"lyceumconnect/backend/internal/server"
	"lyceumconnect/backend/internal/store"
)

func main() {
	cfg := config.Load()

	var s store.Store
	if cfg.DatabaseURL != "" {
		pg, err := store.NewPostgres(context.Background(), cfg.DatabaseURL)
		if err != nil {
			log.Fatalf("postgres: %v", err)
		}
		s = pg
		log.Printf("store: postgres")
	} else {
		s = store.NewMemory()
		log.Printf("store: in-memory (set DATABASE_URL for Postgres)")
	}
	defer s.Close()

	if cfg.DevAuth {
		log.Printf("dev auth ENABLED — POST /api/auth/dev-login is available")
	}
	if !cfg.Entra.Configured() {
		log.Printf("Entra ID SSO not configured — SSO endpoints return 501")
	}

	e := server.New(cfg, s)
	log.Printf("Lyceum Connect API on :%s", cfg.Port)
	if err := e.Start(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
