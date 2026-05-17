-- Replace single threshold_value + direction with per-direction thresholds.
-- NULL means the rule does not fire for that direction.

ALTER TABLE detection_thresholds
    ADD COLUMN threshold_outward BIGINT,
    ADD COLUMN threshold_inward  BIGINT;

-- Migrate existing data: direction 'both' copies value to both columns,
-- 'outward'/'inward' sets only the matching column.
UPDATE detection_thresholds SET
    threshold_outward = CASE WHEN direction IN ('both', 'outward') THEN threshold_value ELSE NULL END,
    threshold_inward  = CASE WHEN direction IN ('both', 'inward')  THEN threshold_value ELSE NULL END;

-- direction column is now superseded by NULL/non-NULL per-direction thresholds
ALTER TABLE detection_thresholds DROP COLUMN direction;
