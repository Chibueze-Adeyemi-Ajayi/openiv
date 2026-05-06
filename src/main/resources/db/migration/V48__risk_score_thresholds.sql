ALTER TABLE aml_settings 
ADD COLUMN IF NOT EXISTS risk_score_flag_threshold INT DEFAULT 51,
ADD COLUMN IF NOT EXISTS risk_score_case_threshold INT DEFAULT 81;
