# Lyceum Connect — Employee Portal

A premium digital workplace portal for Lyceum Global Holdings and its subsidiary companies. Built as a static HTML/CSS/JS frontend with an optional Go backend and Supabase database layer.

---

## Overview

Lyceum Connect is an internal employee portal that centralises IT service requests, company hierarchy, task management, meeting transcription, announcements, document tools, and analytics into a single unified workspace.

- **Frontend:** Vanilla HTML, CSS, JavaScript (no framework)
- **Dev server:** `live-server` (port 8080)
- **Backend (optional):** Go — `backend/`
- **Database (optional):** Supabase (PostgreSQL)
- **PWA:** Installable on mobile via `manifest.webmanifest` + `sw.js`

---

## Getting Started

```bash
npm run dev        # starts live-server on http://localhost:8080
```

Login with the demo account shown on the login screen, or use the "Demo Account" autofill button.

---

## Pages

| File | Page | Description |
|---|---|---|
| `login.html` | Login | Auth screen with demo account autofill |
| `index.html` | Dashboard | Personalised bento widget dashboard (drag, resize, reorder tiles) |
| `service-catalog.html` | Service Catalog | Browse & request IT, HR, FM, Admin services by category/company |
| `request-form.html` | Raise a Request | Service request form with dynamic fields |
| `request-tracking.html` | Track Tickets | Live ticket status tracker |
| `tasks.html` | Task Manager | Bilingual tasks & action items with AI outcome prediction |
| `meeting-transcription.html` | Meeting Transcription | Audio recording → auto-transcribed action items |
| `knowledge-center.html` | Knowledge Center | Internal wiki and document library |
| `announcements.html` | Announcements | Company-wide news feed |
| `employee-directory.html` | Employee Directory | Search and browse all staff |
| `employee.html` | Employee Profile | Individual staff profile card |
| `sectors.html` | Company Hierarchy | 3D sector tabs with holding company logos |
| `dashboards.html` | Analytics Dashboards | Company performance and KPI charts |
| `document-tools.html` | Document Tools | Client-side document preparation & conversion |
| `profile.html` | My Profile | Edit personal details (persisted across pages) |
| `offline.html` | Offline | PWA offline fallback page |

---

## JavaScript Modules

| File | Purpose |
|---|---|
| `js/auth.js` | Session auth, login/logout, profile persistence |
| `js/main.js` | Global nav, dark mode, search, notifications |
| `js/dashboard-widgets.js` | Bento tile system — drag, resize, widget rendering |
| `js/tasks.js` | Task CRUD, AI outcome prediction engine, auto-reminders |
| `js/transcription.js` | Audio recording, live transcription, action item extraction |
| `js/sectors.js` | Company hierarchy tabs with official holding logos |
| `js/sectors-data.js` | Sector & company metadata (logos, descriptions, employees) |
| `js/directory.js` | Employee directory search and filtering |
| `js/employee.js` | Individual employee profile rendering |
| `js/kc.js` | Knowledge center search and document rendering |
| `js/charts.js` | Chart helpers (used by dashboards) |
| `js/company-perf.js` | Company performance analytics |
| `js/reports.js` | Reporting module |
| `js/hierarchy.js` | 3D company hierarchy visualisation |
| `js/doctools.js` | Document tools (convert, merge, compress) |
| `js/bot.js` | AI assistant chatbot (bot.js) |
| `js/api.js` | Supabase/backend API abstraction layer |
| `js/data.js` | Shared seed data |
| `js/motion.js` | Page transition and animation utilities |
| `js/photos.js` | Avatar/photo utilities |

---

## CSS

| File | Purpose |
|---|---|
| `css/styles.css` | Global design system — variables, layout, components |
| `css/company-perf.css` | Company performance dashboard styles |

---

## AI Features

### Task Outcome Prediction (`js/tasks.js`)
Rule-based engine that analyses each task and returns:
- **Overdue** — past due date
- **Critical Risk** — High priority, ≤2 days left
- **At Risk** — High priority, ≤5 days, no reminders sent
- **Due Soon** — due today or tomorrow
- **Monitor** — ≤7 days remaining
- **On Track** — well within deadline

Each prediction shows a confidence % and tooltip reasoning. An AI Insights summary panel above the task list shows counts by category.

---

## Company Hierarchy

Eight Lyceum Global Holdings sectors with official logos sourced from `lyceumglobal.co`:

| Key | Sector | Theme |
|---|---|---|
| `corporate` | Lyceum Global Holdings | Holding Company |
| `education` | Education Sector | Education Services |
| `speed` | Speed Sector | Automotive & Logistics |
| `read` | Read Sector | Publications & Stationery |
| `build` | Build Sector | Infrastructure & Facility |
| `tech` | Tech Sector | Software & Event Media |
| `kit` | Kit Sector | Uniforms & Merchandising |
| `heracle` | Heracle Sector | Sports, Care & Wellness |

---

## PWA (Mobile App)

The portal is installable as a mobile app:
- `manifest.webmanifest` — app name, icons, theme colour
- `sw.js` — service worker with offline caching
- `offline.html` — shown when network is unavailable
- Icons: `assets/icon-192.png`, `assets/icon-512.png`, `assets/icon-maskable-512.png`

---

## Backend (Optional)

A Go REST API lives in `backend/`. It is **not required** for the frontend — the portal runs fully client-side using localStorage and Supabase direct.

```
backend/
  cmd/server/main.go        # entry point
  internal/
    auth/                   # JWT + OIDC
    server/                 # HTTP handlers
    store/                  # memory + postgres stores
    bot/                    # AI assistant
    meetingai/              # meeting analysis pipeline
    analytics/              # reporting & narrator
    slack/                  # Slack integration
    directory/              # employee directory
    notify/                 # notifications
  db/migrations/            # SQL migration files
```

### Run the backend
```bash
cd backend
cp .env.example .env        # fill in your values
make run
```

---

## Database (Supabase)

Migrations in `supabase/migrations/`:

| File | Tables |
|---|---|
| `0001_portal_core.sql` | users, companies, service_requests, announcements |
| `0002_portal_ops.sql` | tickets, comments, attachments |
| `0003_announcement_images.sql` | announcement_images |

---

## Git Repository

**GitHub:** https://github.com/globallyceum25-dot/Portal

```bash
git clone git@github.com:globallyceum25-dot/Portal.git
cd Portal
npm run dev
```

---

## Project Structure

```
Lyceum Connect/
├── index.html                  # Dashboard
├── login.html
├── service-catalog.html
├── tasks.html
├── sectors.html
├── meeting-transcription.html
├── knowledge-center.html
├── announcements.html
├── employee-directory.html
├── employee.html
├── dashboards.html
├── document-tools.html
├── request-form.html
├── request-tracking.html
├── profile.html
├── offline.html
├── manifest.webmanifest        # PWA manifest
├── sw.js                       # Service worker
├── css/
│   ├── styles.css
│   └── company-perf.css
├── js/                         # All JS modules
├── assets/                     # Icons, logos
├── backend/                    # Go backend (optional)
├── supabase/                   # DB migrations
└── docs/                       # Architecture docs
```

---

*Lyceum Global Holdings — Internal use only*
