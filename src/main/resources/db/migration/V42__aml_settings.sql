-- AML settings table for institution-level configurations
CREATE TABLE IF NOT EXISTS aml_settings (
    id              BIGSERIAL       PRIMARY KEY,
    institution_id  BIGINT          NOT NULL UNIQUE REFERENCES institutions(id) ON DELETE CASCADE,
    auto_open_case  BOOLEAN         NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX ON aml_settings(institution_id);
