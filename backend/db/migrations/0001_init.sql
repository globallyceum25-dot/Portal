-- Lyceum Connect — Phase 0 foundation schema.
-- Multi-tenant by design: every business row carries tenant_id for row-level
-- isolation (spec §10). Group Super Admins query across tenants; all other
-- roles are scoped to their own tenant_id.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Subsidiary companies within LGH Group (the tenants).
CREATE TABLE IF NOT EXISTS tenants (
    id         TEXT PRIMARY KEY DEFAULT ('ten_' || encode(gen_random_bytes(8), 'hex')),
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The seven RBAC roles from spec §9.
CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY DEFAULT ('usr_' || encode(gen_random_bytes(8), 'hex')),
    email      TEXT NOT NULL,
    name       TEXT NOT NULL DEFAULT '',
    tenant_id  TEXT NOT NULL REFERENCES tenants(id),
    role       TEXT NOT NULL DEFAULT 'employee',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Case-insensitive unique email, used by the ON CONFLICT upsert.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uniq ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users (tenant_id);

-- Immutable audit trail (spec §3.9). Append-only; never updated or deleted.
CREATE TABLE IF NOT EXISTS audit_log (
    id         TEXT PRIMARY KEY DEFAULT ('aud_' || encode(gen_random_bytes(8), 'hex')),
    tenant_id  TEXT NOT NULL,
    actor_id   TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action     TEXT NOT NULL,
    target     TEXT NOT NULL DEFAULT '',
    meta       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_tenant_created_idx ON audit_log (tenant_id, created_at DESC);

-- Seed the group tenant so dev-login has a home tenant.
INSERT INTO tenants (id, name, slug)
VALUES ('lgh', 'Lyceum Global Holdings', 'lgh')
ON CONFLICT (slug) DO NOTHING;
