-- KYC endpoint configuration per institution
CREATE TABLE kyc_config (
  id               BIGSERIAL PRIMARY KEY,
  institution_id   BIGINT NOT NULL UNIQUE REFERENCES institutions(id),
  lookup_url       TEXT,                    -- OpenIV calls GET {url}/{ref} for customer KYC
  lookup_api_key   TEXT,                    -- OpenIV sends as Authorization: Bearer on each request
  lookup_timeout   INTEGER NOT NULL DEFAULT 10,
  listener_url     TEXT,                    -- OpenIV POSTs KYC events (re-verify, watchlist hit, etc.)
  listener_api_key TEXT,                    -- OpenIV sends in X-OpenIV-Api-Key header
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Log of all KYC lookups OpenIV has performed
CREATE TABLE kyc_lookup_log (
  id              BIGSERIAL PRIMARY KEY,
  institution_id  BIGINT NOT NULL REFERENCES institutions(id),
  customer_ref    TEXT NOT NULL,
  trigger_source  TEXT NOT NULL DEFAULT 'manual',  -- manual | tx_flag | aml_case
  status          TEXT NOT NULL,                   -- success | failed | timeout
  response_code   INTEGER,
  duration_ms     INTEGER,
  kyc_tier        INTEGER,
  kyc_status      TEXT,
  error_message   TEXT,
  performed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kyc_lookup_log_inst ON kyc_lookup_log (institution_id, performed_at DESC);
