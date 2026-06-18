ALTER TABLE workflow_definitions
  ADD COLUMN IF NOT EXISTS case_risk_threshold INTEGER NOT NULL DEFAULT 75;
