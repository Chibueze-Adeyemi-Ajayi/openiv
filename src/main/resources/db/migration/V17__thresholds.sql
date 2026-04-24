CREATE TABLE detection_thresholds (
    id              BIGSERIAL    PRIMARY KEY,
    institution_id  BIGINT       NOT NULL,
    rule_id         VARCHAR(80)  NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT         NOT NULL,
    tag             VARCHAR(50)  NOT NULL,
    threshold_value BIGINT       NOT NULL,
    unit            VARCHAR(20)  NOT NULL DEFAULT '₦',
    min_value       BIGINT       NOT NULL DEFAULT 100000,
    max_value       BIGINT       NOT NULL DEFAULT 50000000,
    step_value      BIGINT       NOT NULL DEFAULT 100000,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    fired_count     INT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (institution_id, rule_id)
);

CREATE TABLE threshold_changes (
    id              BIGSERIAL    PRIMARY KEY,
    threshold_id    BIGINT       NOT NULL REFERENCES detection_thresholds(id),
    institution_id  BIGINT       NOT NULL,
    changed_by      BIGINT       NOT NULL,
    field           VARCHAR(50)  NOT NULL,
    old_value       VARCHAR(200),
    new_value       VARCHAR(200) NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ON detection_thresholds(institution_id);
CREATE INDEX ON threshold_changes(threshold_id, created_at DESC);
CREATE INDEX ON threshold_changes(institution_id, created_at DESC);
