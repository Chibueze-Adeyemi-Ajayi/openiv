CREATE TABLE case_interests (
  id             BIGSERIAL PRIMARY KEY,
  case_id        TEXT        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  institution_id BIGINT      NOT NULL,
  user_id        BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name      TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(case_id, user_id)
);

CREATE INDEX ON case_interests(case_id, institution_id);
CREATE INDEX ON case_interests(institution_id, user_id);
