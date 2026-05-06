ALTER TABLE aml_settings 
ADD COLUMN beh_risk_score_flag_threshold INT NOT NULL DEFAULT 60,
ADD COLUMN beh_risk_score_case_threshold INT NOT NULL DEFAULT 85;
