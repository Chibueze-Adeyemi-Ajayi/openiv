-- V87: Per-institution configurable risk scores on detection thresholds
--      and per-transaction rules audit snapshot for legal/compliance purposes.

-- 1. Audit snapshot on every transaction
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS rules_snapshot JSONB DEFAULT NULL;

-- 2. Configurable risk score contribution per detection threshold rule.
--    NULL = use platform default (backwards compatible; service falls back to hardcoded values).
ALTER TABLE detection_thresholds
  ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT NULL;

-- 3. Backfill default risk scores for existing threshold rules
UPDATE detection_thresholds SET risk_score = 35 WHERE rule_id = 'high-value-wire'      AND risk_score IS NULL;
UPDATE detection_thresholds SET risk_score = 25 WHERE rule_id = 'velocity-cluster'     AND risk_score IS NULL;
UPDATE detection_thresholds SET risk_score = 30 WHERE rule_id = 'late-night-large'     AND risk_score IS NULL;
UPDATE detection_thresholds SET risk_score = 30 WHERE rule_id = 'cross-border-bdc'     AND risk_score IS NULL;
UPDATE detection_thresholds SET risk_score = 20 WHERE rule_id = 'dormant-reactivation' AND risk_score IS NULL;

-- 4. Add configurable velocity-spike rule for every institution that does not have it yet.
--    threshold_value = 130 means "flag when today's count > yesterday's * 1.30".
--    Institutions can adjust the ratio (e.g. 150 = 1.50) and risk_score via the Thresholds UI.
INSERT INTO detection_thresholds
  (institution_id, rule_id, name, description, tag,
   threshold_value, unit, min_value, max_value, step_value,
   is_active, threshold_outward, threshold_inward, risk_score)
SELECT DISTINCT
  institution_id,
  'velocity-spike',
  'Institution Volume Spike',
  'Flags when today''s institution-wide transaction count exceeds yesterday''s by the configured percentage. Set threshold_value to 130 for a 30% spike, 150 for a 50% spike, etc.',
  'AML',
  130, '%', 105, 400, 5,
  true, 130, 130, 20
FROM detection_thresholds
WHERE institution_id NOT IN (
  SELECT DISTINCT institution_id FROM detection_thresholds WHERE rule_id = 'velocity-spike'
)
ON CONFLICT DO NOTHING;
