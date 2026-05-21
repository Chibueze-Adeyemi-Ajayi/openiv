-- V89: Institution-wide surge alerts and expected daily transaction baseline

-- 1. Expected daily transaction volume on AML settings
--    Used by the TRANSACTION_SURGE rule to compare today's count against the institution's normal baseline.
ALTER TABLE aml_settings ADD COLUMN IF NOT EXISTS expected_daily_txn_count INT NOT NULL DEFAULT 1000;

-- 2. Institution-wide platform alerts
CREATE TABLE IF NOT EXISTS institution_alerts (
    id              BIGSERIAL       PRIMARY KEY,
    institution_id  BIGINT          NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    alert_type      VARCHAR(50)     NOT NULL,
    title           VARCHAR(255)    NOT NULL,
    message         TEXT,
    severity        VARCHAR(20)     NOT NULL DEFAULT 'high',
    status          VARCHAR(20)     NOT NULL DEFAULT 'open',
    metadata        JSONB,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_institution_alerts_inst_status
    ON institution_alerts (institution_id, status, created_at DESC);
