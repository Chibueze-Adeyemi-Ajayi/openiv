-- Update risk score threshold column defaults: Normal/Flag boundary = 45, Case = 85
ALTER TABLE aml_settings
  ALTER COLUMN risk_score_normal_threshold SET DEFAULT 45,
  ALTER COLUMN risk_score_flag_threshold SET DEFAULT 45,
  ALTER COLUMN risk_score_case_threshold SET DEFAULT 85,
  ALTER COLUMN beh_risk_score_normal_threshold SET DEFAULT 45,
  ALTER COLUMN beh_risk_score_flag_threshold SET DEFAULT 45,
  ALTER COLUMN beh_risk_score_case_threshold SET DEFAULT 85;

-- Backfill existing institutions that still carry the old migration defaults
UPDATE aml_settings
SET
  risk_score_normal_threshold = 45,
  risk_score_flag_threshold   = 45,
  risk_score_case_threshold   = 85,
  beh_risk_score_normal_threshold = 45,
  beh_risk_score_flag_threshold   = 45,
  beh_risk_score_case_threshold   = 85
WHERE
  risk_score_normal_threshold IN (30)
  AND risk_score_flag_threshold IN (30, 51)
  AND risk_score_case_threshold IN (30, 81)
  AND beh_risk_score_normal_threshold IN (30)
  AND beh_risk_score_flag_threshold IN (30, 60)
  AND beh_risk_score_case_threshold IN (30, 85);
