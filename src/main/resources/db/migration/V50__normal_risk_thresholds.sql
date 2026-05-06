ALTER TABLE aml_settings 
ADD COLUMN risk_score_normal_threshold INT NOT NULL DEFAULT 30,
ADD COLUMN beh_risk_score_normal_threshold INT NOT NULL DEFAULT 30;
