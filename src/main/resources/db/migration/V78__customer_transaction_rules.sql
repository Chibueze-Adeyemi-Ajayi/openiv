CREATE TABLE IF NOT EXISTS customer_transaction_rules (
    id              BIGSERIAL PRIMARY KEY,
    institution_id  BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    customer_id     BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    rule_type       VARCHAR(50) NOT NULL,
    params          JSONB NOT NULL DEFAULT '{}',
    action          VARCHAR(20) NOT NULL DEFAULT 'block',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    description     TEXT,
    created_by      BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ctr_customer_active ON customer_transaction_rules(customer_id, is_active);
CREATE INDEX idx_ctr_institution      ON customer_transaction_rules(institution_id);
