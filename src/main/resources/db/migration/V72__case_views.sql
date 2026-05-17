CREATE TABLE IF NOT EXISTS case_views (
    case_id        TEXT        NOT NULL,
    institution_id BIGINT      NOT NULL,
    user_id        BIGINT      NOT NULL,
    viewed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT case_views_pkey PRIMARY KEY (case_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_case_views_institution ON case_views (institution_id, user_id);
