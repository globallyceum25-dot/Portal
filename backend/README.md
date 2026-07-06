# Lyceum Connect — Backend (Phase 0: Foundation)

The Go API spine for Lyceum Connect. This is **Phase 0** of the build plan: the
foundation every later feature attaches to — API gateway, identity, multi-tenant
data layer, RBAC, and the audit primitive. No product features live here yet.

## Stack
- **Go + [Echo](https://echo.labstack.com/)** — HTTP + the API Gateway middleware chain
- **PostgreSQL** via `pgx` — multi-tenant data layer (`tenant_id` on every row)
- **JWT (HS256)** sessions; **Microsoft Entra ID** SSO scaffolded (dev-login for now)
- In-memory store fallback so it runs with **zero external dependencies**

## Run

```bash
cd backend
cp .env.example .env      # optional; sane defaults work out of the box
make run                  # or: go run ./cmd/server
```

Starts on `:8090` with the in-memory store. Set `DATABASE_URL` to switch to
Postgres, then `make migrate DATABASE_URL=...` to apply the schema.

## Try the spine

```bash
# health (public)
curl localhost:8090/healthz

# dev login → JWT (only when DEV_AUTH=true)
TOKEN=$(curl -s -X POST localhost:8090/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@lyceum.edu","role":"group_super_admin"}' | jq -r .token)

curl localhost:8090/api/me           -H "Authorization: Bearer $TOKEN"
curl localhost:8090/api/admin/ping   -H "Authorization: Bearer $TOKEN"
curl localhost:8090/api/admin/audit  -H "Authorization: Bearer $TOKEN"
```

## Layout

```
cmd/server            entrypoint; picks Postgres or in-memory store
internal/
  config              env-driven config (secrets stay server-side)
  server              API Gateway wiring: middleware chain + routes
  middleware          Auth (JWT) + RBAC role guards
  auth                JWT issue/parse; dev-login + Entra SSO handlers
  store               Store interface + memory and postgres impls
  audit               single write-path for the audit trail (spec §3.9)
  pii                 regex PII masker (PDPA pre-storage layer, spec §13.1)
  models              domain types: User, Tenant, AuditEntry, Role
db/migrations         SQL schema (multi-tenant, audit_log)
```

## RBAC roles (spec §9)
`employee` · `dept_staff` · `lgh_it_reviewer` · `zte_technician` ·
`hod_manager` · `company_admin` · `group_super_admin`
(Group Super Admin bypasses role checks and sees all tenants.)

## Phase 1 — Service Request lifecycle (done)
The core workflow is live end-to-end (spec §3): submission → Job Card → routing →
optional approval → acknowledge → in-progress → complete → CSAT, each step
audited and notified across three channels.

Key pieces: `internal/routing` (the Routing Engine — two-tier LGH IT → ZTE),
`internal/lifecycle` (the state machine), `internal/notify` (concurrent fan-out),
`internal/pii` (masking on submit). Job Card model in `models/jobcard.go`;
schema in `db/migrations/0002_service_requests.sql`.

Endpoints (all under `/api`, JWT-protected):

```
GET  /services                    catalog (routing flags per service)
POST /requests                    submit → creates Job Card, routes it
GET  /requests                    my requests
GET  /requests/:ref               one request + timeline
POST /requests/:ref/approve       HOD approval gate {decision, comment}
POST /requests/:ref/acknowledge   assignee picks up
POST /requests/:ref/start         → in progress
POST /requests/:ref/forward       LGH IT → ZTE {note}
POST /requests/:ref/reject        reject during LGH IT review {note}
POST /requests/:ref/complete      {note}
POST /requests/:ref/csat          {rating 1-5, comment}
GET  /queues/:queue               staff queue view (lgh_it_review | zte | department)
```

## Microsoft Entra ID SSO (done)
Real OIDC authorization-code flow with PKCE lives in `auth/oidc.go`:
`GET /api/auth/login` → Microsoft → `GET /api/auth/callback` → issues our JWT →
redirects to `FRONTEND_URL#token=…`. Roles map from the Entra **app roles**
claim (falling back to `employee`). Set `ENTRA_TENANT_ID / ENTRA_CLIENT_ID /
ENTRA_CLIENT_SECRET` to enable it; unset, the endpoints return 501 and
`dev-login` is used instead. The frontend's "Sign in with Microsoft" button and
`#token` handler complete the round-trip.

## Phase 2 — Knowledge Center + Announcements (done)
- **Knowledge Center** (`knowledge/sync.go`): pluggable document Source (seed now,
  Microsoft Graph/OneDrive the seam), a Syncer that caches metadata into the DB
  on startup and on-demand. Documents carry type/tags/version/expiry and track
  read-confirmations. `GET /documents`, `POST /documents/:id/read`,
  `POST /admin/kb/sync`.
- **Announcements** (`server/content.go`): scoped feed (group/company), admin
  publishing with category + priority, notification fan-out (Urgent = immediate),
  read tracking. `GET /announcements`, `POST /announcements` (admin),
  `POST /announcements/:id/read`.
- Schema in `db/migrations/0003_content.sql`.

## Next (Phase 2 → beyond)
- Company (tenant) mapping from Entra claims (currently defaults to `lgh`)
- Microsoft Graph adapter for real OneDrive sync (behind the `knowledge.Source` seam)
- Phase 3: Meeting transcription → Tasks pipeline; Phase 4: Slack Hub
