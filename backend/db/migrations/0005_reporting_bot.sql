-- Lyceum Connect — Phase 5 schema: Portal Bot conversation logs (spec §13.5).
-- JSONB-aggregate pattern, matching meetings/tasks; queried columns promoted.
--
-- Note on the Dashboards & Reporting module (spec §13.6): reporting reads are
-- computed on demand from the existing transactional tables (job_cards, tasks,
-- audit_log, documents, announcements). The production data pipeline promotes
-- these to reporting-optimized MATERIALIZED VIEWs (refreshed off the write path)
-- so dashboard aggregation never contends with transactional load — the two
-- views below are the seam for that. They are read-only and additive.

CREATE SEQUENCE IF NOT EXISTS bot_seq START 1;
CREATE TABLE IF NOT EXISTS bot_conversation_log (
    id         TEXT PRIMARY KEY,
    tenant_id  TEXT NOT NULL,
    actor_id   TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    doc        JSONB NOT NULL   -- PII-masked turns (question/answer/tools)
);
CREATE INDEX IF NOT EXISTS bot_log_tenant_idx ON bot_conversation_log (tenant_id, created_at DESC);

-- Reporting-optimized rollups (spec §13.6 data pipeline). REFRESH on a schedule
-- (e.g. every few minutes) rather than per request so dashboards stay cheap.
CREATE MATERIALIZED VIEW IF NOT EXISTS report_jobcard_daily AS
    SELECT tenant_id,
           date_trunc('day', created_at)                          AS day,
           (doc->>'category')                                     AS category,
           (doc->>'status')                                       AS status,
           (doc->>'queue')                                        AS queue,
           count(*)                                               AS volume,
           avg((doc#>>'{csat,rating}')::numeric)                  AS avg_csat
      FROM job_cards
     GROUP BY tenant_id, day, category, status, queue;

CREATE MATERIALIZED VIEW IF NOT EXISTS report_task_completion AS
    SELECT tenant_id,
           status,
           count(*) AS volume
      FROM tasks
     GROUP BY tenant_id, status;
