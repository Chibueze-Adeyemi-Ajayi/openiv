-- Rename kyc_tier → knowledge_level (string enum t1/t2/t3) in kyc_pipeline_results.
-- The institution-passed tier is stored as institution_kyc_tier (nullable INT).
-- customers gains last_evaluated_at for re-evaluation scheduling.

ALTER TABLE kyc_pipeline_results
    ADD COLUMN knowledge_level    VARCHAR(3),
    ADD COLUMN institution_kyc_tier INT;

UPDATE kyc_pipeline_results
SET knowledge_level = CASE kyc_tier
    WHEN 1 THEN 't1'
    WHEN 2 THEN 't2'
    WHEN 3 THEN 't3'
    ELSE 't1'
END;

ALTER TABLE kyc_pipeline_results
    ALTER COLUMN knowledge_level SET NOT NULL,
    DROP COLUMN kyc_tier;

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMPTZ;

-- Evaluation scheduling config per institution.
CREATE TABLE IF NOT EXISTS kyc_evaluation_config (
    id             BIGSERIAL    PRIMARY KEY,
    institution_id BIGINT       NOT NULL UNIQUE REFERENCES institutions(id) ON DELETE CASCADE,
    interval_days  INT          NOT NULL DEFAULT 30 CHECK (interval_days IN (7, 14, 21, 31)),
    enabled        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
