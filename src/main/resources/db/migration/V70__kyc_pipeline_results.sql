CREATE TABLE kyc_pipeline_results (
    id                 BIGSERIAL PRIMARY KEY,
    institution_id     BIGINT NOT NULL,
    customer_id        TEXT NOT NULL,
    run_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    overall_risk_score INT NOT NULL,
    kyc_tier           INT NOT NULL,
    overall_status     TEXT NOT NULL,
    action_taken       TEXT NOT NULL,
    bvn_nin_status     TEXT,
    bvn_nin_score      INT,
    bvn_nin_detail     TEXT,
    phone_status       TEXT,
    phone_score        INT,
    phone_detail       TEXT,
    liveness_status    TEXT,
    liveness_score     INT,
    liveness_detail    TEXT,
    pep_status         TEXT,
    pep_score          INT,
    pep_detail         TEXT,
    duration_ms        BIGINT
);
CREATE INDEX ON kyc_pipeline_results (institution_id, customer_id, run_at DESC);
