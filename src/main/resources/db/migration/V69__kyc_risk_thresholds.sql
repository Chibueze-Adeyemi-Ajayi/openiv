ALTER TABLE aml_settings
  ADD COLUMN IF NOT EXISTS kyc_risk_normal_threshold INT NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS kyc_risk_case_threshold   INT NOT NULL DEFAULT 75;
