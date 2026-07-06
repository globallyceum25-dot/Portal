-- Lyceum Connect — Phase 2 schema: Knowledge Center + Announcements.
-- Both use the JSONB-aggregate pattern; queried columns are promoted.

-- Knowledge Center: cached metadata synced from OneDrive/SharePoint (§4).
CREATE TABLE IF NOT EXISTS documents (
    id        TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    title     TEXT NOT NULL,
    doc       JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_tenant_idx ON documents (tenant_id, title);

-- Announcements (§7).
CREATE SEQUENCE IF NOT EXISTS ann_seq START 1;
CREATE TABLE IF NOT EXISTS announcements (
    id         TEXT PRIMARY KEY,
    tenant_id  TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    doc        JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS announcements_tenant_idx ON announcements (tenant_id, created_at DESC);
