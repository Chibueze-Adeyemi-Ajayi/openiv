CREATE TABLE customers (
    id              BIGSERIAL    PRIMARY KEY,
    institution_id  BIGINT       NOT NULL REFERENCES institutions(id),
    external_id     VARCHAR(100) NOT NULL, -- The user_id or customer_id from source
    name            VARCHAR(200),
    email           VARCHAR(255),
    phone           VARCHAR(50),
    risk_score      INT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (institution_id, external_id)
);

CREATE INDEX ON customers(institution_id, external_id);

-- Migration to link existing transactions to customers? 
-- The user said "anytime I beam anything; it should create the customer record"
-- So we'll focus on the live data flow first as requested.
