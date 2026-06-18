-- Transaction Monitoring: pipelines + rules
-- A pipeline is a named, ordered set of conditions evaluated against every incoming transaction.
-- Pipelines replace the ad-hoc rule concept; rules live exclusively inside a pipeline.

CREATE TABLE monitoring_pipelines (
    id              BIGSERIAL PRIMARY KEY,
    institution_id  BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    logic           CHAR(3) NOT NULL DEFAULT 'AND' CHECK (logic IN ('AND','OR')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','inactive')),
    created_by      VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE monitoring_rules (
    id              BIGSERIAL PRIMARY KEY,
    pipeline_id     BIGINT NOT NULL REFERENCES monitoring_pipelines(id) ON DELETE CASCADE,
    institution_id  BIGINT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    field           VARCHAR(100) NOT NULL,
    op              VARCHAR(20) NOT NULL
                        CHECK (op IN ('GT','LT','GTE','LTE','EQ','NEQ',
                                      'CONTAINS','NOT_CONTAINS','IN','NOT_IN')),
    value           TEXT NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    position        INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_monitoring_pipelines_inst ON monitoring_pipelines(institution_id);
CREATE INDEX idx_monitoring_rules_pipeline ON monitoring_rules(pipeline_id);
CREATE INDEX idx_monitoring_rules_inst     ON monitoring_rules(institution_id);
