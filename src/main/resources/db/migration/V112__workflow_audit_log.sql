CREATE TABLE workflow_audit_log (
  id             BIGSERIAL   PRIMARY KEY,
  institution_id BIGINT      NOT NULL,
  workflow_id    BIGINT,                -- null after a delete
  workflow_name  TEXT        NOT NULL,
  action         TEXT        NOT NULL
                             CHECK (action IN ('create','update','delete','submit','approve','retire','new_version','run_now','import')),
  actor_id       BIGINT,               -- null for API-key-authenticated calls
  detail         JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX workflow_audit_log_institution_idx ON workflow_audit_log (institution_id, created_at DESC);
CREATE INDEX workflow_audit_log_workflow_idx    ON workflow_audit_log (workflow_id) WHERE workflow_id IS NOT NULL;
