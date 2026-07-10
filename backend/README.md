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

## Phase 3 — Meeting transcription → Tasks pipeline (done)
- `meetingai/`: pluggable **Analyzer** (heuristic now; **NVIDIA Nemotron via NIM**
  behind the config seam) + a Pipeline that turns a transcript into summary +
  key points + action items and auto-creates linked **Tasks**. Browser Web Speech
  API stays as the live STT front end (English + Sinhala).
- Transcript is PII-masked before storage; analysis runs on the raw text so
  assignee names survive for auto-assignment.
- `POST /meetings` (run pipeline), `GET /meetings`, `GET /meetings/:id`,
  `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id`. Schema `0004_meetings_tasks.sql`.
- Frontend: `meeting-transcription` "Generate Minutes" runs the pipeline;
  `tasks.html` Task Manager loads live tasks and syncs status back.

## Phase 4 — Slack Integration Hub (done)
- `slack/`: an event-driven Hub (spec §6). Publishers emit `slack.Event`s; the
  Hub **routes** to the right channel (`#it-requests`, `#hr-requests`,
  `#approvals`, `#announcements`, …) and delivers via a pluggable **Transport**
  (log by default; real bot / webhook behind config) with **bounded retry**.
- Wired into the notifier as an extra channel, so every portal notification
  flows through the Hub. Lifecycle events carry a routing category + interactive
  **actions** (Approve / Forward to ZTE).
- **Bidirectional** (spec §6.2): `POST /api/slack/interactions` performs portal
  actions from Slack (approve / reject / forward), signature-verified when
  `SLACK_SIGNING_SECRET` is set. `GET /admin/slack/hub` shows transport +
  channels. Unit tests cover routing + retry.

## Phase 5 — Dashboards & Reports + Portal Bot (done)
- **Dashboards & Reporting** (`internal/analytics`, spec §13.6): a `Builder` rolls
  the transactional data (Job Cards, Tasks, CSAT, documents, announcements) up
  into a `Report` of aggregate metrics — SLA compliance, request volume/day,
  category & status breakdowns, the two-tier LGH IT → ZTE turnaround, CSAT by
  category, task-completion, KB engagement. A `Narrator` layers natural-language
  insight on top (heuristic by default; **GLM-5.1 / Nemotron via NIM** behind the
  config seam), **grounded** in the report's own numbers — the model explains
  figures, it never invents them. Charts render client-side (`js/charts.js`).
  RBAC-scoped: HOD/Company Admin see their tenant, Group Super Admin sees all.
  `GET /reports/overview`, `GET /reports/insights`, `POST /reports/ask` (ad-hoc
  NL Q&A, e.g. "why did CSAT drop for ZTE?"). Restricted to HOD/admin roles.
- **Portal Bot** (`internal/bot`, spec §13.5): a grounded, tool-calling assistant.
  It has **no direct DB access** — it selects one of a fixed tool set
  (`my_requests`, `request_status`, `my_tasks`, `search_knowledge`,
  `queue_summary`, `navigation`), each of which calls the store through the
  RBAC-scoped seam, and the answer is composed in Go from the tool's real results
  — so a reported ticket status is always a real one. The routing model plugs in
  behind the same seam (keyword Heuristic default; **GLM-5.1 via NIM** when
  configured). RBAC is enforced above the tools (an Employee only ever reaches
  their own data; queue summaries need a staff/admin role). `POST /bot/ask`; each
  exchange is logged PII-masked as a `BotConversationLog` (`GET /admin/bot/logs`).
  Frontend: the `js/bot.js` chat widget is available portal-wide; `dashboards.html`
  is the reporting UI. Unit tests cover bot grounding + RBAC. Schema
  `0005_reporting_bot.sql` (bot log + reporting materialized-view seam).

## Next (beyond Phase 5)
- Company (tenant) mapping from Entra claims (currently defaults to `lgh`)
- Real adapters behind the seams: Microsoft Graph (OneDrive), Nemotron/GLM (NIM),
  Slack bot token / signing secret, Google Translate (Sinhala bot queries)
- Persist to Postgres (schema + parity already written)
