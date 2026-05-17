ALTER TABLE customers ADD COLUMN IF NOT EXISTS overall_risk_score INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_customers_overall_risk_score ON customers (institution_id, overall_risk_score DESC);
