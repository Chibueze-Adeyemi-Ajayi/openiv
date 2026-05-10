-- Add Micro-Timing Anomaly detection rule
-- This is a critical security rule that detects transaction registration timing attacks
-- (transactions that occurred within ±5 seconds of system time, indicating API injection/manipulation)

INSERT INTO detection_thresholds
  (institution_id, rule_id, name, description, tag, threshold_value, unit, min_value, max_value, step_value, is_active, fired_count, created_at, updated_at)
SELECT
  id,
  'micro-timing-anomaly',
  'Micro-Timing Anomaly',
  'Detects transactions that occurred within ±5 seconds of registration, indicating potential API injection or system clock manipulation attacks.',
  'Fraud',
  96,
  'risk%',
  90,
  100,
  1,
  true,
  0,
  NOW(),
  NOW()
FROM institutions;
