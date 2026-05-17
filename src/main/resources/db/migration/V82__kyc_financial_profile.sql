ALTER TABLE kyc_pipeline_results
    ADD COLUMN IF NOT EXISTS monthly_inflow  BIGINT,
    ADD COLUMN IF NOT EXISTS monthly_outflow BIGINT;
