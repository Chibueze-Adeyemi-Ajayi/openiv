-- Workflows: institution-defined KYC re-screening pipelines.
-- A workflow is an ordered list of blocks (screening steps) plus a per-institution
-- schedule. Editing an active workflow creates a new version; runs always record
-- the version that executed (CBN 5.12.a.iv change control, 5.9 traceability).

CREATE TABLE workflow_definitions (
  id               BIGSERIAL PRIMARY KEY,
  institution_id   BIGINT      NOT NULL,
  name             TEXT        NOT NULL,
  version          INT         NOT NULL DEFAULT 1,
  -- draft -> pending_approval -> active -> retired
  status           TEXT        NOT NULL DEFAULT 'draft',
  -- ordered block list: [{"type":"pep_sanctions_screen","config":{},"onFail":"open_case"}, ...]
  blocks           JSONB       NOT NULL DEFAULT '[]',
  -- per-institution re-screening cadence, in days, per customer risk tier:
  -- {"highDays":30,"mediumDays":90,"lowDays":365}
  schedule         JSONB       NOT NULL DEFAULT '{"highDays":30,"mediumDays":90,"lowDays":365}',
  schedule_enabled BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by       BIGINT      NOT NULL REFERENCES users(id),
  -- maker-checker: approver must differ from created_by (enforced in service)
  approved_by      BIGINT      REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institution_id, name, version)
);

CREATE INDEX ON workflow_definitions(institution_id, status);

-- One row per execution (scheduled tick, manual trigger, or batch import).
-- This table is the regulator-facing evidence of continuous screening (CBN 5.3.b.i/iii).
CREATE TABLE workflow_runs (
  id                     BIGSERIAL PRIMARY KEY,
  workflow_definition_id BIGINT      NOT NULL REFERENCES workflow_definitions(id),
  workflow_version       INT         NOT NULL,
  institution_id         BIGINT      NOT NULL,
  trigger                TEXT        NOT NULL,            -- scheduled | manual | import
  status                 TEXT        NOT NULL DEFAULT 'running',  -- running | completed | failed
  total_customers        INT         NOT NULL DEFAULT 0,
  clear_count            INT         NOT NULL DEFAULT 0,
  match_count            INT         NOT NULL DEFAULT 0,
  error_count            INT         NOT NULL DEFAULT 0,
  started_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at            TIMESTAMPTZ
);

CREATE INDEX ON workflow_runs(institution_id, started_at DESC);

-- Per-customer outcome inside a run.
CREATE TABLE workflow_run_items (
  id           BIGSERIAL PRIMARY KEY,
  run_id       BIGINT      NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  customer_id  TEXT        NOT NULL,
  -- per-block results: [{"type":"pep_sanctions_screen","status":"pass","detail":"...","ms":412}, ...]
  step_results JSONB       NOT NULL DEFAULT '[]',
  outcome      TEXT        NOT NULL,                      -- clear | match | error | skipped
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON workflow_run_items(run_id);
CREATE INDEX ON workflow_run_items(customer_id);
