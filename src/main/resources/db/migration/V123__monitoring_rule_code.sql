-- AI-generated JavaScript function for complex rule evaluation.
-- NULL = use legacy field/op/value evaluator; non-null = execute via Rhino.
ALTER TABLE monitoring_rules ADD COLUMN IF NOT EXISTS code TEXT;
