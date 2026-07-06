.PHONY: run build tidy test migrate

# Run the API (in-memory store unless DATABASE_URL is set).
run:
	go run ./cmd/server

build:
	go build -o bin/server ./cmd/server

tidy:
	go mod tidy

test:
	go test ./...

# Apply the schema. Requires psql and DATABASE_URL, e.g.:
#   make migrate DATABASE_URL=postgres://lyceum:lyceum@localhost:5432/lyceum_connect?sslmode=disable
migrate:
	psql "$(DATABASE_URL)" -f db/migrations/0001_init.sql
