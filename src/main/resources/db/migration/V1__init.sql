-- Baseline migration. Keep migrations additive, idempotent, and PG-compatible.
-- The `health_check` table exists purely so the readiness probe can verify DB connectivity.

CREATE TABLE IF NOT EXISTS health_check (
    id          SMALLINT     PRIMARY KEY,
    checked_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO health_check (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
