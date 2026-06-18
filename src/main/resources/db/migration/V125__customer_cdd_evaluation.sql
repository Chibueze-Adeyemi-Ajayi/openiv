-- CDD workflow evaluation results stored directly on the customer record.
-- cdd_risk_score  : 0-100 risk score derived from the last workflow run (null = never run).
-- cdd_concerns    : JSONB array of {step,type,field,message,resolveAction} for 404 gaps and warnings.
-- cdd_step_scores : JSONB array of enriched step results including per-step authenticity scores.
ALTER TABLE customers
  ADD COLUMN cdd_risk_score  INT,
  ADD COLUMN cdd_concerns    JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN cdd_step_scores JSONB NOT NULL DEFAULT '[]';
