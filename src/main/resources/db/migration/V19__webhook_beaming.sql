-- Extend delivery log with full request/response capture and tracing
ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS delivery_id       TEXT,
  ADD COLUMN IF NOT EXISTS request_headers   TEXT,
  ADD COLUMN IF NOT EXISTS request_body      TEXT,
  ADD COLUMN IF NOT EXISTS response_headers  TEXT,
  ADD COLUMN IF NOT EXISTS response_body     TEXT,
  ADD COLUMN IF NOT EXISTS duration_ms       INTEGER,
  ADD COLUMN IF NOT EXISTS error_message     TEXT;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivery_id
  ON webhook_deliveries (delivery_id);

-- Per-endpoint security configuration
CREATE TABLE IF NOT EXISTS webhook_security_rules (
  id              BIGSERIAL PRIMARY KEY,
  endpoint_id     BIGINT  NOT NULL UNIQUE REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  institution_id  BIGINT  NOT NULL REFERENCES institutions(id),
  api_key         TEXT,            -- sent as X-OpenIV-Api-Key header; null = disabled
  ip_allowlist    TEXT,            -- comma-separated CIDRs; null = all IPs allowed
  timeout_seconds INTEGER NOT NULL DEFAULT 10,
  max_retries     INTEGER NOT NULL DEFAULT 3,
  require_ack     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
