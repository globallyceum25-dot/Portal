-- Lyceum Connect — Phase 1 schema: the Service Request lifecycle.
-- Job Cards keep queried/filtered fields as real columns; the full aggregate
-- (timeline, approval, csat, form fields) rides in a JSONB `doc`.

-- Service catalog. Routing flags live here so routing is config-driven (§3.3).
CREATE TABLE IF NOT EXISTS services (
    id                       TEXT PRIMARY KEY,
    tenant_id                TEXT NOT NULL,          -- 'lgh' => group-wide
    name                     TEXT NOT NULL,
    category                 TEXT NOT NULL DEFAULT '',
    department               TEXT NOT NULL DEFAULT '',
    sla_hours                INT  NOT NULL DEFAULT 24,
    lgh_it_review_required   BOOLEAN NOT NULL DEFAULT false,
    approval_required        BOOLEAN NOT NULL DEFAULT false
);

-- Reference-number sequence (REQ-YYYY-NNNN).
CREATE SEQUENCE IF NOT EXISTS job_ref_seq START 1;

CREATE TABLE IF NOT EXISTS job_cards (
    ref          TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    requester_id TEXT NOT NULL,
    queue        TEXT NOT NULL,
    status       TEXT NOT NULL,
    doc          JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobcards_requester_idx ON job_cards (requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobcards_queue_idx     ON job_cards (queue, tenant_id, created_at DESC);

-- Demo catalog: both routing branches + the approval gate.
INSERT INTO services (id, tenant_id, name, category, department, sla_hours, lgh_it_review_required, approval_required) VALUES
  ('it-support',      'lgh', 'IT Support',              'IT Support',                           'IT',                8,  true,  false),
  ('email-account',   'lgh', 'Email Account',           'Email Accounts',                       'IT',                24, true,  false),
  ('new-website',     'lgh', 'New Website / App Build', 'Websites & Applications Development',   'IT',                72, true,  true),
  ('vehicle-booking', 'lgh', 'Company Vehicle Booking', 'Facility',                             'Facility',          24, false, false),
  ('leave-request',   'lgh', 'Leave Request',           'HR',                                   'Human Resources',   48, false, true)
ON CONFLICT (id) DO NOTHING;
