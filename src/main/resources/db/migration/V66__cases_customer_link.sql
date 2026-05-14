ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS customer_id   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_cases_customer_id ON cases (customer_id) WHERE customer_id IS NOT NULL;
