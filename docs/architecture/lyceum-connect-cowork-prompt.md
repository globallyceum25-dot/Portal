# Lyceum Connect — System Architecture Design
## Cowork Prompt (Copy and paste this entire document as your first message)

---

## TASK OVERVIEW

Design the complete, production-grade **system architecture** for **Lyceum Connect**, the intranet employee portal for Lyceum Global Holdings (LGH) Group. Deliver the following six artefacts, all styled to match the existing Lyceum Connect portal design system (tokens provided below):

**A.** Interactive HTML System Architecture Diagram (layered, swimlane, component-level)
**B.** Animated Service Request Flow Diagram (separate HTML)
**C.** Technology Stack Recommendation (structured markdown table)
**D.** Integration Specifications per system
**E.** Entity-Relationship / Data Model Overview
**F.** Phased Implementation Roadmap

Artefacts A and B must be delivered as **self-contained interactive HTML files** using the exact Lyceum Connect design tokens listed at the bottom of this prompt. The diagrams must be browser-presentable — suitable for a board stakeholder meeting and for developer handoff.

---

## 1. ORGANISATIONAL CONTEXT

**Lyceum Global Holdings (LGH)** is the mother holding company with approximately **50 subsidiary companies** across sectors including education, transport, hospitality, facilities, and technology. The intranet portal is called **Lyceum Connect** and serves all employees across the entire group.

Key entities:

| Entity | Role |
|---|---|
| **LGH** | Mother holding company, Group IT owner, policy authority |
| **Zuse Technologies Pvt Ltd (ZTE)** | Dedicated IT execution arm for the entire group |
| **NCG Holdings** | Operates NCG Express (luxury bus hire) + NCG Automotives |
| **Dynamic Labs** | Technology subsidiary |
| **Company A … Company N** | ~46 other subsidiaries (education, hospitality, facilities, etc.) |

**Critical routing rule — model this as a first-class architecture concern:**
Certain IT service requests must be reviewed by **LGH Group IT** before being forwarded to **ZTE** for execution. Other requests route directly to the relevant company or department. This two-tier IT routing logic must be a named component in the architecture — not just a note.

---

## 2. PORTAL MODULES (Frontend already built)

The frontend exists as static HTML/CSS. The architecture defines the backend, APIs, integrations, data flows, and infrastructure. All pages below must have their backing services designed:

| Page | Function |
|---|---|
| `login.html` | Authentication / SSO entry point |
| `service-catalog.html` | Browse services by company/department; initiate requests |
| `request-form.html` | Multi-step dynamic form for submitting service requests |
| `request-tracking.html` | Track status of submitted requests (My Requests) |
| `knowledge-center.html` | Surface SOPs, policies, memos from OneDrive |
| `announcements.html` | Group-wide and company-specific announcements feed |
| `employee-directory.html` | Search staff across all ~50 group companies |
| `meeting-transcription.html` | Real-time speech-to-text, English + Sinhala |
| `tasks.html` | Task manager — tasks auto-generated from meeting transcripts |
| `sectors.html` | Bento grid: LGH group hierarchy + subsidiary details |
| `profile.html` | Employee profile, preferences, request history, CSAT history |

---

## 3. SERVICE REQUEST LIFECYCLE (Most Critical Module)

This is the core workflow. Design every component and data flow for the full lifecycle:

### 3.1 Submission
- Employee selects Company → selects Service → fills dynamic form → submits
- Form fields are service-type-driven (configurable per service in admin)

### 3.2 Auto Job Card Creation
- System auto-generates a structured **Job Card** with: unique reference number, timestamp, requester details, service type, SLA deadline, assigned queue
- Job Card schema must be defined in the data model

### 3.3 Routing Engine (Two-Tier IT Logic)
```
IF service.flag == "LGH_IT_REVIEW_REQUIRED":
    → Route to LGH Group IT Queue
    → LGH IT reviews → approve / reject / annotate → forward to ZTE Queue
    → ZTE picks up and executes
ELSE:
    → Route directly to relevant Company/Department Queue
```
The Routing Engine must be a named, standalone component (not implicit logic buried in a controller).

**Confirmed service categories that carry the `LGH_IT_REVIEW_REQUIRED` flag:**

| # | Service Category | Sub-types | Routing | Notes |
|---|---|---|---|---|
| 1 | **IT Support** | Device faults, software issues, slow performance, printer/scanner, MFA/password reset, IT onboarding support, equipment relocation | LGH IT Review → ZTE | ZTE is a third-party company — all requests gate through LGH Group IT first before forwarding, including routine helpdesk |
| 2 | **IT Services** | **Server & Infrastructure** (provisioning, decommission, cloud resources, backup, SSL, DNS); **Network & Connectivity** (LAN, Wi-Fi, VPN, firewall, static IP); **Software & Licensing** (install, license purchase/renewal/reallocation) | LGH IT Review → ZTE | Infrastructure-level decisions require LGH IT security and architecture review |
| 3 | **Websites & Applications Development** | New website/app builds, internal tools, API/integration development, system decommissions | LGH IT Review → ZTE | Renamed from "Apps, Websites & Systems Development"; HOD approval for projects above budget threshold |
| 4 | **Websites & Applications Changes** | Content updates, bug fixes, UI/UX changes, feature modifications, performance improvements, config changes to live systems | LGH IT Review → ZTE | Distinct from new development; minor content-only changes may be fast-tracked by LGH IT Reviewer |
| 5 | **Incidents & Breach Reports** | Security incidents, data breaches, system outages, malware events | LGH IT Review → ZTE | CRITICAL priority — immediate Slack alert; data breaches trigger PDPA 72-hour DPA notification |
| 6 | **SIM Card & eSIM Requests** | New SIM, replacement, eSIM provisioning, deactivation on exit | LGH IT Review → ZTE | ZTE coordinates with carrier; HR offboarding auto-triggers deactivation |
| 7 | **Foreign Travel — Data Roaming & Visa Support** | Roaming activation/deactivation, visa support, IT equipment clearance letters | LGH IT Review → ZTE / Admin | Line manager approval required; roaming auto-deactivated on travel end date |
| 8 | **Social Media Accounts — Creation & Access** | New account creation, admin/editor access, access removal on exit | LGH IT Review → Brand/Comms + ZTE | LGH IT gates for brand, security (2FA + vault), and PDPA; Brand/Comms executes; ZTE vaults credentials |
| 9 | **CCTV** | New installation, footage access requests, system maintenance, expansion | LGH IT Review → ZTE / Facility | Footage access is PDPA-sensitive — HOD/security officer authorisation required; all access logged to audit trail |
| 10 | **Email Accounts** | New account creation, alias/name changes, mailbox config, distribution groups, calendar delegation, storage increase, deactivation | LGH IT Review → ZTE | Linked to Azure AD/Entra ID provisioning; naming convention compliance enforced by LGH IT |
| 11 | **Assets Management** | New hardware allocation, asset transfer between employees/departments, asset return on exit, disposal/decommission (secure wipe), replacement for faulty equipment | LGH IT Review → ZTE + System A | Integrates with System A (Asset Management System) via Slack Hub; HR offboarding auto-triggers return request |
| 12 | **Internet Packages** | New connection for office/branch, speed/bandwidth upgrade, package/plan change, additional static IP, backup/failover link, ISP fault escalation | LGH IT Review → ZTE + ISP | Involves carrier-level coordination; LGH IT reviews network architecture impact and budget before ZTE engages ISP |

**Note on routing:** All 12 service categories carry the `LGH_IT_REVIEW_REQUIRED` flag — including IT Support. Because ZTE is a third-party company, every request (including routine helpdesk) must be reviewed and approved by LGH Group IT before being forwarded to ZTE for execution. Additional service types may be flagged by the Group Super Admin via the admin panel — the routing flag is configurable, not hard-coded.

### 3.4 Acknowledgement
- Assigned party clicks Acknowledge in their queue
- System auto-sends templated acknowledgement message to requester
- Channels: in-portal notification + email + Slack

### 3.5 Work In Progress
- Assignee updates status to "In Progress"
- Requester notified across all three channels

### 3.6 Approval Gates
- Certain services (configurable per service type) require HOD / Manager approval
- Approval workflow: Approve / Reject / Request More Info / Comment
- Approval request sent to approver; outcome triggers next step or rejection flow

### 3.7 Completion
- Assignee marks job complete with completion notes
- Requester notified with job summary and completion details

### 3.8 CSAT Collection
- Requester receives CSAT prompt: 1–5 star rating + free-text comment
- CSAT data feeds analytics dashboard (admin view)

### 3.9 Full Audit Trail
- Every status change, comment, approval decision, and notification must be logged with actor + timestamp
- Audit log must be queryable per Job Card

---

## 4. KNOWLEDGE CENTER / DOCUMENT MANAGEMENT

- Source: **Microsoft OneDrive shared folder** (already in use across LGH Group)
- Portal surfaces documents via **OneDrive / SharePoint API**
- Documents must be searchable by: title, category, company, tags, document type (SOP / Policy / Memo / Form / Template)
- Support: version history display, document expiry alerts, read-confirmation tracking
- Integration pattern: scheduled sync + on-demand fetch; cache indexed metadata in portal DB

---

## 5. MEETING TRANSCRIPTION → TASK PIPELINE

- Real-time speech-to-text supporting **English and Sinhala**
- Post-transcription AI pipeline:
  1. Generate structured meeting summary
  2. Extract action items
  3. Auto-create Tasks in Task Manager
  4. Auto-assign tasks to mentioned employees
  5. Link tasks back to source meeting transcript
- Tasks module: status (To Do / In Progress / Done), due date, priority, assignee, source link
- Design the AI pipeline components: STT engine selection, LLM summarisation/extraction, task creation API

---

## 6. SLACK INTEGRATION HUB

Slack is the **primary notification and cross-system integration bus** for the organisation. Design a named **Slack Integration Hub** as an extensible event-driven layer:

### 6.1 Systems to integrate via Slack Hub:

| System | Ref | Type |
|---|---|---|
| Lyceum Connect Portal | Core | Request updates, approvals, task assignments, announcements |
| Microsoft OneDrive/SharePoint | MS365 | Document upload alerts, expiry notifications |
| Asset Management System | System A | Asset requests, allocation alerts |
| Facility Management System | System B | Facility bookings, maintenance alerts |
| Kitchen / Canteen Management | System C | Meal orders, canteen alerts |
| Future System D | System D | Placeholder |
| Future System E | System E | Placeholder |
| Future System F | System F | Placeholder |

### 6.2 Architecture requirements for the Hub:
- **Webhook/event-bus pattern** — new systems pluggable without core re-architecture
- Each system publishes events to the Hub; Hub routes to correct Slack channels
- Dedicated channels: `#it-requests`, `#hr-requests`, `#approvals`, `#announcements`, `#facilities`, `#assets`, `#kitchen`, `#system-alerts`
- Bidirectional where needed: Slack slash commands / interactive buttons trigger portal actions (e.g., approve a request from Slack)
- Define: event schema, channel routing rules, failure handling, retry logic

---

## 7. ANNOUNCEMENTS MODULE

- Admins (per-company or group-wide) publish announcements via portal admin panel
- Scope: Group-wide / Company-specific / Department-specific
- Categories: HR Policy, IT Maintenance, Event, Achievement, Emergency
- Delivery: in-portal feed, email digest, Slack channel push
- Priority levels: Normal, Important, Urgent (urgent overrides digest, sends immediately)

---

## 8. EMPLOYEE DIRECTORY

- Centralised directory spanning all ~50 group companies
- Fields: Name, Designation, Department, Company, Email, Phone, Office Location, Profile Photo, Employee ID, Reporting Manager
- Sync source: HRIS integration (or manual admin entry for Phase 1)
- Search and filter: by company, department, location, name
- Privacy: phone/email visibility configurable per role (PDPA-compliant)

---

## 9. AUTHENTICATION & RBAC

- **SSO via Microsoft Entra ID (Azure AD)** — leverages existing Microsoft 365 investment
- Role-Based Access Control matrix:

| Role | Permissions |
|---|---|
| Employee | Submit requests, view own tickets, use knowledge center, directory |
| Department Staff | Manage incoming queue for their department |
| LGH IT Reviewer | Access LGH Group IT review queue; forward or reject to ZTE |
| ZTE Technician | Execute IT jobs in ZTE queue |
| HOD / Manager | Approval authority for configured services in their scope |
| Company Admin | Manage announcements + service catalog for their company |
| Group Super Admin | Full access across all companies and all modules |

---

## 10. CONSTRAINTS & NON-NEGOTIABLES

- **Geography:** Sri Lanka-based organisation; prefer AWS `ap-south-1` (Mumbai) or Azure Southeast Asia for lowest latency
- **Language:** Sinhala language support required in meeting transcription STT
- **Microsoft 365 already in use:** Leverage existing Azure AD, OneDrive, and potentially Teams where it reduces integration cost
- **Slack already adopted:** Slack is the communication standard — do not replace it, integrate with it
- **Multi-tenancy:** ~50 companies must have data isolation with group-level visibility for LGH Super Admins. Design a multi-tenant data strategy (schema-per-tenant OR row-level isolation with tenant_id — justify your choice)
- **PDPA Compliance:** Sri Lanka Personal Data Protection Act No. 9 of 2022 (Amendment No. 22 of 2025). All employee PII (directory, HR requests, CSAT) must have: data minimisation, consent tracking, access logging, right-to-erasure support, and data retention policies baked into the architecture — not bolted on
- **Scale:** Design for 500 employees now, architected to scale to 5,000 without re-platforming

---

## 11. DELIVERABLE SPECIFICATIONS

### A. System Architecture Diagram — Interactive HTML
Produce a **single self-contained HTML file** with:
- **Swimlane zones** (colour-coded): Portal Frontend | API/Backend | LGH Group IT | ZTE | Other Companies/Depts | Slack Integration Hub | Microsoft 365 | External Systems A–F | Data Layer | Infrastructure
- **Clickable components:** each node expands a tooltip/side panel showing: component name, tech, responsibility, connected systems
- **Animated directional arrows** showing data flow between components (CSS/SVG animation)
- **Layer toggle:** buttons to show/hide layers (e.g., "Show Infrastructure", "Show Data Layer")
- **Dark mode toggle** matching portal behaviour
- **Legend** explaining zones, line types (sync/async/webhook), and component types
- Styled exactly to Lyceum Connect design tokens (see Section 12)

### B. Service Request Flow Diagram — Animated HTML
Produce a **separate self-contained HTML file** showing:
- The complete request lifecycle from submission to CSAT as a **step-by-step animated flow**
- The two-tier LGH IT → ZTE routing branch clearly visualised as a decision fork
- Each step: actor, action, system involved, notification triggered
- Play/Pause control for the animation
- Ability to click any step to freeze and read details
- Styled to the same Lyceum Connect design tokens

### C. Technology Stack Recommendation
Structured markdown table with: Layer | Technology | Justification | Alternatives Considered

Cover: Frontend framework, Backend/API, Primary database, Secondary/cache, File storage, Auth/SSO, Real-time (WebSocket/SSE), STT engine (Sinhala), LLM (summarisation/task extraction), Hosting/infra, CI/CD, Monitoring

### D. Integration Specifications
For each integration (OneDrive, Slack Hub, Systems A–F), specify:
- Connection method (REST / Webhook / SDK / Event Bus)
- Auth mechanism
- Data exchanged (schema summary)
- Trigger events (what causes data to flow)
- Direction (push / pull / bidirectional)
- Failure handling and retry strategy
- SLA / rate limit considerations

### E. Data Model Overview
Entity-Relationship description covering at minimum:
`User`, `Company`, `Department`, `Service`, `JobCard`, `JobCardStatusLog`, `Notification`, `ApprovalRequest`, `Document`, `Task`, `Meeting`, `Announcement`, `CsatResponse`, `AuditLog`

For each entity: key fields, primary relationships, tenant isolation strategy

### F. Phased Implementation Roadmap
Phased plan with: Phase name, Duration estimate, Deliverables, Dependencies, Team required

Suggested phases:
- **Phase 1:** Core portal + authentication + service request lifecycle (submission → completion)
- **Phase 2:** Knowledge Center + OneDrive integration + Announcements
- **Phase 3:** Meeting Transcription + Tasks pipeline
- **Phase 4:** Slack Hub + Systems A–F integrations
- **Phase 5:** Advanced analytics, CSAT dashboards, mobile PWA, HRIS sync for directory

---

## 12. LYCEUM CONNECT DESIGN TOKENS (Use these exactly — do not substitute)

Apply these in all HTML deliverables (Artefacts A and B). Import the same Google Fonts.

```css
/* FONTS — import these */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

:root {
  /* Brand Blue */
  --primary:              #3B7BF8;
  --primary-dark:         #2563EB;
  --primary-light:        #6B9FFA;
  --primary-50:           #EEF3FF;
  --primary-100:          #DBEAFE;
  --primary-200:          #BFDBFE;
  --primary-gradient:     linear-gradient(135deg, #3B7BF8 0%, #2563EB 100%);

  /* Neutrals */
  --gray-50:  #F8FAFC;
  --gray-100: #F1F5F9;
  --gray-200: #E2E8F0;
  --gray-300: #CBD5E1;
  --gray-400: #94A3B8;
  --gray-500: #64748B;
  --gray-600: #475569;
  --gray-700: #334155;
  --gray-800: #1E293B;
  --gray-900: #0F172A;

  /* Semantic */
  --success-light: #DCFCE7;
  --success:       #22C55E;
  --success-dark:  #15803D;
  --warning-light: #FEF9C3;
  --warning:       #EAB308;
  --warning-dark:  #A16207;
  --error-light:   #FEE2E2;
  --error:         #EF4444;
  --error-dark:    #B91C1C;

  /* Surfaces — Glassmorphism */
  --bg-page:        #F3F5F9;
  --bg-primary:     #F3F5F9;
  --bg-secondary:   rgba(248, 250, 253, 0.45);
  --bg-tertiary:    rgba(233, 239, 246, 0.65);
  --surface:        rgba(255, 255, 255, 0.55);
  --surface-raised: rgba(255, 255, 255, 0.75);
  --glass-blur:     blur(20px);
  --glass-blur-sm:  blur(10px);
  --glass-shadow:   0 8px 32px 0 rgba(31, 38, 135, 0.04), 0 1px 3px 0 rgba(31, 38, 135, 0.02);
  --glass-border:   rgba(255, 255, 255, 0.4);

  /* Text */
  --text-primary:   #1E2538;
  --text-secondary: #5C6A85;
  --text-tertiary:  #92A1BA;
  --text-inverse:   #FFFFFF;
  --text-link:      #3B7BF8;

  /* Borders */
  --border-light:  rgba(59, 123, 248, 0.04);
  --border:        rgba(59, 123, 248, 0.12);
  --border-strong: rgba(59, 123, 248, 0.22);

  /* Shadows */
  --shadow-xs:   0 1px 3px rgba(30, 40, 80, 0.01);
  --shadow-sm:   0 4px 12px rgba(30, 40, 80, 0.02);
  --shadow-md:   0 8px 24px rgba(30, 40, 80, 0.03);
  --shadow-lg:   0 12px 32px rgba(30, 40, 80, 0.05);
  --shadow-xl:   0 20px 48px rgba(30, 40, 80, 0.07);
  --shadow-2xl:  0 32px 72px rgba(30, 40, 80, 0.10);
  --shadow-card: 0 8px 30px rgba(30, 40, 80, 0.035), 0 1px 3px rgba(30, 40, 80, 0.015);
  --shadow-glow: 0 0 0 3px rgba(59, 123, 248, 0.15);

  /* Spacing */
  --space-1:  4px;  --space-2:  8px;  --space-3: 12px;
  --space-4: 16px;  --space-5: 20px;  --space-6: 24px;
  --space-8: 32px;  --space-10: 40px; --space-12: 48px;
  --space-16: 64px;

  /* Border Radius */
  --radius-sm:   8px;
  --radius-md:   12px;
  --radius-lg:   18px;
  --radius-xl:   24px;
  --radius-2xl:  32px;
  --radius-full: 9999px;

  /* Typography */
  --font-sans:    'Inter', system-ui, -apple-system, sans-serif;
  --font-display: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;

  /* Transitions */
  --transition-fast:   150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base:   250ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow:   400ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-spring: 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Dark Mode */
[data-theme="dark"] {
  --bg-page:        #0A0D14;
  --bg-primary:     #0A0D14;
  --bg-secondary:   rgba(17, 22, 34, 0.45);
  --bg-tertiary:    rgba(23, 30, 46, 0.6);
  --surface:        rgba(17, 22, 34, 0.55);
  --surface-raised: rgba(23, 30, 46, 0.7);
  --text-primary:   #E4E9F2;
  --text-secondary: #8E9DB8;
  --text-tertiary:  #5D6E8B;
  --border-light:   rgba(255, 255, 255, 0.03);
  --border:         rgba(255, 255, 255, 0.09);
  --border-strong:  rgba(255, 255, 255, 0.18);
  --glass-border:   rgba(255, 255, 255, 0.08);
  --shadow-card:    0 8px 30px rgba(0,0,0,0.35);
}

/* Body background — radial gradient with fixed attachment (match portal exactly) */
body {
  background:
    radial-gradient(circle at 10% 20%, rgba(59,123,248,0.05) 0%, transparent 45%),
    radial-gradient(circle at 90% 80%, rgba(236,72,153,0.04) 0%, transparent 45%),
    radial-gradient(circle at 50% 50%, rgba(6,182,212,0.03) 0%, transparent 55%),
    var(--bg-page);
  background-attachment: fixed;
}

[data-theme="dark"] body {
  background:
    radial-gradient(circle at 10% 20%, rgba(59,123,248,0.12) 0%, transparent 45%),
    radial-gradient(circle at 90% 80%, rgba(236,72,153,0.08) 0%, transparent 45%),
    radial-gradient(circle at 50% 50%, rgba(6,182,212,0.06) 0%, transparent 55%),
    var(--bg-page);
  background-attachment: fixed;
}

/* Glass card pattern (use for all diagram nodes/tiles) */
.glass-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-card);
}

/* Primary button pattern */
.btn-primary {
  background: var(--primary-gradient);
  color: #fff;
  border-radius: var(--radius-full);
  font-family: var(--font-display);
  font-weight: 600;
  box-shadow: 0 4px 14px rgba(59,123,248,0.35);
  transition: all var(--transition-base);
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59,123,248,0.45);
}

/* Active nav / selected state */
.active-state {
  background: var(--primary-gradient);
  color: #fff;
  box-shadow: 0 4px 14px rgba(59, 123, 248, 0.35);
}
```

### Swimlane zone colour coding for the architecture diagram:

| Zone | Background | Border Accent |
|---|---|---|
| Portal Frontend | `rgba(59,123,248,0.06)` | `#3B7BF8` |
| API / Backend | `rgba(34,197,94,0.06)` | `#22C55E` |
| LGH Group IT | `rgba(234,179,8,0.08)` | `#EAB308` |
| ZTE | `rgba(168,85,247,0.07)` | `#A855F7` |
| Other Companies/Depts | `rgba(6,182,212,0.06)` | `#06B6D4` |
| Slack Integration Hub | `rgba(74,21,75,0.07)` | `#4A154B` (Slack purple) |
| Microsoft 365 / OneDrive | `rgba(0,120,212,0.06)` | `#0078D4` |
| External Systems A–F | `rgba(249,115,22,0.06)` | `#F97316` |
| Data Layer | `rgba(239,68,68,0.05)` | `#EF4444` |
| Infrastructure | `rgba(148,163,184,0.08)` | `#64748B` |

---

---

## ADDENDUM — ARCHITECTURE UPDATE (Paste this as a follow-up message in the same Cowork session, after the agent has produced the original six artefacts)

> We are refining the Lyceum Connect system architecture you already produced. Update **all six artefacts** (A–F) to incorporate the following decisions and new components. Do not discard prior work — extend and revise it. Where a new component changes the swimlane diagram (Artefact A) or the data model (Artefact E), update those files directly; do not just describe the change in prose.

### 13.1 Confirmed AI Model Decisions (replaces the open AI stack questions from the original prompt)

| Capability | Decision | Notes |
|---|---|---|
| Scanned document OCR | **NVIDIA Nemotron OCR v2** | Use for English-language scanned documents (forms, contracts, printed memos). Does not cover Sinhala — Sinhala-language scanned documents route through Google Cloud Vision/Document AI instead, or are flagged for manual entry. Document this limitation explicitly in Artefact D. |
| Meeting transcript → task/action-item extraction | **NVIDIA Nemotron (reasoning-tier text model)** | Operates on already-transcribed English text output from the STT stage. |
| Sinhala speech-to-text & Sinhala translation | **Google Cloud APIs** (Speech-to-Text `si-LK` + Cloud Translation API) | Confirmed decision — do not use NVIDIA for Sinhala in any module. English transcription stays on the originally chosen STT engine; Sinhala segments are routed to Google APIs, with Google Translate used to produce an English working copy for downstream AI processing (task extraction, RAG indexing) where needed. |
| PII detection & masking | **NVIDIA `llama-3.1-nemotron-safety-guard-8b-v3`** (or GLiNER-PII as a lighter-weight alternative) | Apply as a pre-processing layer before: (a) storing request form free-text fields, (b) indexing meeting transcripts into the Knowledge Center, (c) surfacing CSAT comments in admin dashboards. Mask PII (names, emails, phone numbers, NIC numbers, addresses) rather than blocking outright, unless the field is explicitly meant to capture contact details (e.g., the requester's own profile). |
| Portal conversational bot / agentic assistant | **GLM-5.1 (via NVIDIA NIM, Z.ai)** | See Section 13.5 below for full bot specification. |
| Dashboard/report insight generation | **NVIDIA NIM (GLM-5.1 or a Nemotron reasoning model)** | Generates natural-language summaries and insights on top of structured portal data (e.g., SLA breach trends, recurring issue categories, CSAT sentiment summaries). Chart/graph rendering itself is done by a standard frontend charting library, not by the LLM — the LLM's job is narrative insight, anomaly flagging, and natural-language Q&A over the data, not visual rendering. |

### 13.2 Document Preparation & Conversion Module (New)

A new module allows employees to **create and convert documents** (SOPs, memos, policies, forms) directly within the portal, including a lightweight document-conversion utility similar to SmallPDF/iLovePDF.

**Critical architectural constraint:** The conversion utility (PDF↔Word, image↔PDF, merge/split/compress) must run **entirely client-side, in the browser, using in-memory/cache storage only**. No uploaded or converted file may touch the backend server or any persistent database/storage layer. This is a deliberate privacy and liability boundary — draft SOPs, policies, and memos in progress should never be persisted server-side during the conversion step.

Specify in Artefact A and D:
- Client-side processing approach (e.g., WASM-based libraries such as `pdf-lib`, `pdf.js`, or equivalent — agent should recommend the most production-suitable option)
- Explicit note that this module has **no backend API calls and no database writes** during conversion — it is a pure frontend utility
- Once a user explicitly chooses to **save** a finished document (not just convert it), only then does it get uploaded through the normal authenticated upload flow into the Knowledge Center / OneDrive, going through the standard backend, virus scanning, and PII-masking pipeline
- This module should be clearly marked in the swimlane diagram as a **client-only zone** with a dotted boundary, distinct from all other swimlanes which involve backend interaction

### 13.3 API Gateway / API Masking Layer (New, Security-Critical)

Introduce a dedicated **API Gateway layer** sitting between the frontend and all backend/external services. This is a security requirement, not optional.

Requirements:
- All frontend calls to backend services, NVIDIA NIM endpoints, Google Cloud APIs, Slack, OneDrive/SharePoint, and Systems A–F must route through this gateway — **the frontend never holds or calls external API keys/secrets directly**
- The gateway is responsible for: API key/secret vaulting (e.g., via a secrets manager), request authentication and authorization (validating the user's session/JWT before forwarding), rate limiting per user/role, request/response logging for audit purposes, and masking of internal service URLs and infrastructure topology from the client
- Recommend a specific implementation pattern (e.g., a Go-based API Gateway service, or a managed gateway like Kong/AWS API Gateway/Azure API Management — agent should weigh against the Go-centric backend decision in 13.4 and recommend the most coherent option)
- Update Artefact A to show this gateway as a distinct layer between Frontend and all backend/integration zones
- Update Artefact D (Integration Specifications) so every integration explicitly states "routed via API Gateway" as its connection method

### 13.4 Backend Technology Decision: Go (Golang)

The backend connecting frontend to data/services must be built in **Go (Golang)**.

- Update Artefact C (Technology Stack Recommendation) to specify Go as the backend language, with a recommended web framework (e.g., Gin, Echo, or Fiber — agent should recommend based on performance and ecosystem fit for this use case) and recommended patterns for: REST/gRPC API design, concurrency handling (relevant given multiple simultaneous notification channels — email/Slack/in-portal — per job card event), and database driver/ORM choice compatible with the chosen database
- Justify why Go is well-suited here: strong concurrency primitives for the notification fan-out pattern (Section 3 of the original prompt), good performance for an API Gateway layer, strong typing for a system with many structured entities (Job Cards, Tasks, Approvals)
- Revise any prior stack recommendation that assumed a different backend language

### 13.5 Portal Bot / Conversational Assistant (New)

Design a **conversational bot** embedded in the portal (accessible from any page, likely as a persistent chat widget) that can answer employee questions by pulling live data from the portal itself — not just static knowledge.

**Capabilities required:**
- Answer status queries about the requester's own job cards/tickets ("What's the status of my IT request from last week?", "Has my facility booking been approved?")
- Surface relevant Knowledge Center documents in response to policy questions ("What's the procedure for requesting a company vehicle?")
- Summarize a requester's open tasks (from the Tasks module, including those auto-generated from meeting transcripts)
- Answer general portal navigation questions ("How do I submit an IT request to ZTE?")
- For admins/department staff: surface queue summaries ("How many unacknowledged requests are in the LGH IT queue right now?")

**Architecture requirements:**
- Powered by **GLM-5.1 via NVIDIA NIM**, using a tool-calling/function-calling pattern: the bot does not have direct database access — it calls defined backend API functions (via the Go backend, through the API Gateway) to fetch the requester's own job cards, tasks, and permitted Knowledge Center content
- Must respect RBAC: the bot can only return data the requesting user is authorized to see (e.g., an Employee cannot ask the bot for another employee's ticket status; an HOD can ask for their department's queue summary)
- Should be **grounded** — answers about portal data must come from actual API calls, not the LLM's general knowledge, to avoid hallucinated ticket statuses. Recommend NeMo Guardrails or an equivalent grounding/validation layer to enforce this
- Should support both English and Sinhala employee queries — clarify that Sinhall query understanding may route through Google Translate to/from English before reaching GLM-5.1, consistent with the Section 13.1 decision to keep Sinhala on Google's stack
- Update Artefact A to add the bot as a component connected to: API Gateway, Go backend (via defined tool-call endpoints), GLM-5.1 (NVIDIA NIM), and Google Translation API (for Sinhala query handling)
- Update Artefact E to note any new entities needed (e.g., `BotConversationLog` for audit/improvement purposes — should also pass through the PII masking layer before storage)

### 13.6 Dashboards & Reporting Module (New)

Add a dedicated **Dashboards & Reports module**, accessible primarily to admins, HODs, and Group Super Admins, surfacing analytics across the portal's data.

**Suggested dashboard views (agent should refine/expand):**
- Service request volume and SLA performance by company/department over time
- LGH IT → ZTE routing volume and review turnaround time (specific to the two-tier IT flow)
- CSAT trends by service type and company
- Task completion rates from the meeting-transcription-to-task pipeline
- Knowledge Center document engagement (most-viewed SOPs/policies)
- Announcement reach/engagement

**Architecture requirements:**
- Standard frontend charting library renders the visuals (e.g., Recharts, Chart.js, or equivalent — agent should recommend based on consistency with the Lyceum Connect design tokens)
- NVIDIA NIM (GLM-5.1 or a Nemotron reasoning model) is layered on top to generate natural-language insight summaries and answer ad hoc questions about the underlying data (e.g., an admin types "why did CSAT drop for ZTE in May?" and the model queries aggregated data via the Go backend and responds in plain language)
- Specify the data pipeline: how operational data (Job Cards, Tasks, CSAT, Audit Logs) flows from the primary transactional database into a reporting-optimized store (e.g., a read replica, materialized views, or a lightweight analytics database) so dashboard queries don't impact transactional performance
- Update Artefact E to reflect any new reporting-specific data structures

### 13.7 Required Output

Re-deliver:
- **Artefact A** (System Architecture Diagram, HTML) — fully revised to include: API Gateway layer, Go backend labeling, client-only Document Conversion zone, Portal Bot component, Dashboards & Reports module, and the finalized AI model assignments from 13.1
- **Artefact B** (Service Request Flow, HTML) — revised only if the API Gateway or PII masking layer changes any step in the flow (e.g., PII masking now occurs at form submission, before the Job Card is created)
- **Artefact C** (Technology Stack) — revised to reflect Go as backend language, finalized AI model decisions, and the API Gateway technology choice
- **Artefact D** (Integration Specifications) — add new entries for: Google Cloud Speech-to-Text, Google Cloud Translation API, NVIDIA NIM (Nemotron OCR v2, Nemotron reasoning, Safety Guard/GLiNER-PII, GLM-5.1), and revise all existing entries to note "routed via API Gateway"
- **Artefact E** (Data Model) — add `BotConversationLog`, any reporting-specific entities, and confirm PII-masking touchpoints per entity
- **Artefact F** (Roadmap) — re-sequence phases to reasonably place: Document Conversion module, API Gateway (should likely move earlier, as it's foundational), Portal Bot, and Dashboards/Reports module

Continue applying the Lyceum Connect design tokens from Section 12 to all HTML artefacts.

---

*End of prompt. Produce all six artefacts. Artefacts A and B as self-contained HTML files. Artefacts C–F as structured markdown. Apply the design tokens exactly as specified.*
