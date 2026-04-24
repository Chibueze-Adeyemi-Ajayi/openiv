CREATE TABLE IF NOT EXISTS institution_beam_keys (
  id              BIGSERIAL PRIMARY KEY,
  institution_id  BIGINT NOT NULL UNIQUE REFERENCES institutions(id),
  key_hash        TEXT NOT NULL,
  prefix          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_institution_beam_keys_hash ON institution_beam_keys (key_hash);

CREATE TABLE IF NOT EXISTS beam_records (
  id              BIGSERIAL PRIMARY KEY,
  institution_id  BIGINT NOT NULL REFERENCES institutions(id),
  stream          TEXT NOT NULL,
  idempotency_key TEXT,
  payload         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'received',
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beam_records_institution ON beam_records (institution_id, received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_beam_records_idempotency
  ON beam_records (institution_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
