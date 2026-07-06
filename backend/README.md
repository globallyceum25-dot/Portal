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

## Next (Phase 0 → Phase 1)
- Wire real Entra ID OIDC in `auth/oidc` (replace dev-login)
- `Service`, `JobCard`, `JobCardStatusLog`, `ApprovalRequest`, `CsatResponse`
- The **Routing Engine** (two-tier LGH IT → ZTE) as its own module
- Point the static frontend's `request-form` / `request-tracking` at these APIs
