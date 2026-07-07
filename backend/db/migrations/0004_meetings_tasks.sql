-- Lyceum Connect — Phase 3 schema: Meetings + Tasks (spec §5).
-- JSONB-aggregate pattern; queried columns promoted.

CREATE SEQUENCE IF NOT EXISTS mtg_seq START 1;
CREATE TABLE IF NOT EXISTS meetings (
    id         TEXT PRIMARY KEY,
    tenant_id  TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    doc        JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS meetings_tenant_idx ON meetings (tenant_id, created_at DESC);

CREATE SEQUENCE IF NOT EXISTS task_seq START 1;
CREATE TABLE IF NOT EXISTS tasks (
    id         TEXT PRIMARY KEY,
    tenant_id  TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'todo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    doc        JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_tenant_idx ON tasks (tenant_id, created_at DESC);
