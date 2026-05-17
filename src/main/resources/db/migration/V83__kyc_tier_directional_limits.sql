ALTER TABLE threshold_by_kyc_tier
    ADD COLUMN IF NOT EXISTS daily_limit_wire_inward    BIGINT,
    ADD COLUMN IF NOT EXISTS daily_limit_wire_outward   BIGINT,
    ADD COLUMN IF NOT EXISTS daily_limit_mobile_inward  BIGINT,
    ADD COLUMN IF NOT EXISTS daily_limit_mobile_outward BIGINT,
    ADD COLUMN IF NOT EXISTS daily_limit_ussd_inward    BIGINT,
    ADD COLUMN IF NOT EXISTS daily_limit_ussd_outward   BIGINT,
    ADD COLUMN IF NOT EXISTS daily_limit_bdc_inward     BIGINT,
    ADD COLUMN IF NOT EXISTS daily_limit_bdc_outward    BIGINT,
    ADD COLUMN IF NOT EXISTS daily_limit_other_inward   BIGINT,
    ADD COLUMN IF NOT EXISTS daily_limit_other_outward  BIGINT;

-- Seed existing rows from current undirected values:
-- inward = existing limit, outward = 60% of existing limit (outward typically more restricted)
UPDATE threshold_by_kyc_tier SET
    daily_limit_wire_inward    = daily_limit_wire,
    daily_limit_wire_outward   = ROUND(daily_limit_wire   * 0.6),
    daily_limit_mobile_inward  = daily_limit_mobile,
    daily_limit_mobile_outward = ROUND(daily_limit_mobile * 0.6),
    daily_limit_ussd_inward    = daily_limit_ussd,
    daily_limit_ussd_outward   = ROUND(daily_limit_ussd   * 0.6),
    daily_limit_bdc_inward     = daily_limit_bdc,
    daily_limit_bdc_outward    = ROUND(daily_limit_bdc    * 0.6),
    daily_limit_other_inward   = daily_limit_other,
    daily_limit_other_outward  = ROUND(daily_limit_other  * 0.6)
WHERE daily_limit_wire_inward IS NULL;
