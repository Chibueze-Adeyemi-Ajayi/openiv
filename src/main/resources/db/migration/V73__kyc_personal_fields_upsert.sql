-- De-duplicate: keep the latest row per (institution_id, customer_id)
DELETE FROM kyc_pipeline_results a
USING kyc_pipeline_results b
WHERE a.id < b.id
  AND a.institution_id = b.institution_id
  AND a.customer_id    = b.customer_id;

-- Enforce one row per customer so future saves are upserts
ALTER TABLE kyc_pipeline_results
  ADD CONSTRAINT kyc_pipeline_results_inst_cust_unique
  UNIQUE (institution_id, customer_id);

-- Personal identity fields sourced from BVN / NIN lookup
ALTER TABLE kyc_pipeline_results
  ADD COLUMN IF NOT EXISTS first_name    TEXT,
  ADD COLUMN IF NOT EXISTS last_name     TEXT,
  ADD COLUMN IF NOT EXISTS phone         TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
