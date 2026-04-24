-- V8: Custom roles table for per-institution permission overrides.
CREATE TABLE custom_roles (
    id             TEXT         PRIMARY KEY,
    institution_id BIGINT       NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name           TEXT         NOT NULL,
    description    TEXT,
    color          TEXT         NOT NULL,
    permissions    JSONB        NOT NULL, -- Serialized permission matrix
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_custom_roles_institution_id ON custom_roles(institution_id);
