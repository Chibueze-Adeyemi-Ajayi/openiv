-- Direction on per-customer rules (does this rule apply to inward, outward, or both?)
ALTER TABLE customer_transaction_rules
    ADD COLUMN IF NOT EXISTS direction VARCHAR(10) NOT NULL DEFAULT 'both'
    CONSTRAINT chk_ctr_direction CHECK (direction IN ('inward', 'outward', 'both'));

-- Category tag on transactions (optional; provided by beaming client)
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS category     VARCHAR(50),
    ADD COLUMN IF NOT EXISTS direction    VARCHAR(10) NOT NULL DEFAULT 'outward'
                                          CONSTRAINT chk_txn_direction CHECK (direction IN ('inward', 'outward')),
    ADD COLUMN IF NOT EXISTS flag_reasons JSONB;

-- Per-customer behavioral profiles for deviation detection
CREATE TABLE IF NOT EXISTS customer_behavioral_profiles (
    id                 BIGSERIAL PRIMARY KEY,
    institution_id     BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    customer_id        VARCHAR(255) NOT NULL,
    avg_amount         NUMERIC(20,4) NOT NULL DEFAULT 0,
    stddev_amount      NUMERIC(20,4) NOT NULL DEFAULT 0,
    typical_channels   JSONB NOT NULL DEFAULT '[]',
    typical_hour_min   INT   NOT NULL DEFAULT 8,
    typical_hour_max   INT   NOT NULL DEFAULT 20,
    typical_days       JSONB NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
    typical_banks      JSONB NOT NULL DEFAULT '[]',
    typical_categories JSONB NOT NULL DEFAULT '[]',
    transaction_count  INT   NOT NULL DEFAULT 0,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_cbp_inst_customer
    ON customer_behavioral_profiles(institution_id, customer_id);
