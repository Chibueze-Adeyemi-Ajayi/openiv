-- KYC Tier-based transaction thresholds
-- Allows institutions to define different limits per customer KYC tier (0-3)
-- Tier 0: Unverified, Tier 1: Basic, Tier 2: Intermediate, Tier 3: Full

CREATE TABLE threshold_by_kyc_tier (
  id BIGSERIAL PRIMARY KEY,
  institution_id BIGINT NOT NULL,

  -- Tier classification (0 = unverified, 1 = basic, 2 = intermediate, 3 = full)
  kyc_tier INTEGER NOT NULL CHECK (kyc_tier >= 0 AND kyc_tier <= 3),

  -- Daily transaction limits by channel
  daily_limit_wire BIGINT DEFAULT 5000000,        -- ₦5M default
  daily_limit_mobile BIGINT DEFAULT 2000000,      -- ₦2M default
  daily_limit_ussd BIGINT DEFAULT 500000,         -- ₦500k default
  daily_limit_bdc BIGINT DEFAULT 10000000,        -- ₦10M default
  daily_limit_other BIGINT DEFAULT 1000000,       -- ₦1M default

  -- Single transaction limits
  single_txn_limit_wire BIGINT DEFAULT 2500000,   -- ₦2.5M default
  single_txn_limit_mobile BIGINT DEFAULT 1000000, -- ₦1M default
  single_txn_limit_ussd BIGINT DEFAULT 250000,    -- ₦250k default
  single_txn_limit_bdc BIGINT DEFAULT 5000000,    -- ₦5M default
  single_txn_limit_other BIGINT DEFAULT 500000,   -- ₦500k default

  -- Velocity limits (transactions per hour)
  max_txns_per_hour INTEGER DEFAULT 10,
  max_txns_per_day INTEGER DEFAULT 50,

  -- Risk scoring boost for tier (higher = riskier)
  risk_score_boost INTEGER DEFAULT 0,

  -- Whether transactions from this tier require additional verification
  requires_additional_verification BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT unique_institution_tier UNIQUE (institution_id, kyc_tier)
);

-- Index for fast lookups
CREATE INDEX idx_threshold_kyc_tier_lookup ON threshold_by_kyc_tier(institution_id, kyc_tier);

-- Insert default tier configurations for all institutions
-- This will be done per-institution during onboarding, but we provide templates
-- Tier 0: Unverified - most restrictive
-- Tier 1: Basic KYC - moderate limits
-- Tier 2: Intermediate - standard limits
-- Tier 3: Full KYC - highest limits

INSERT INTO threshold_by_kyc_tier
(institution_id, kyc_tier, daily_limit_wire, daily_limit_mobile, daily_limit_ussd, daily_limit_bdc, daily_limit_other,
 single_txn_limit_wire, single_txn_limit_mobile, single_txn_limit_ussd, single_txn_limit_bdc, single_txn_limit_other,
 max_txns_per_hour, max_txns_per_day, risk_score_boost, requires_additional_verification)
SELECT id, 0, 500000, 100000, 50000, 1000000, 100000, 250000, 50000, 25000, 500000, 50000, 5, 10, 20, TRUE
FROM institutions
ON CONFLICT DO NOTHING;

INSERT INTO threshold_by_kyc_tier
(institution_id, kyc_tier, daily_limit_wire, daily_limit_mobile, daily_limit_ussd, daily_limit_bdc, daily_limit_other,
 single_txn_limit_wire, single_txn_limit_mobile, single_txn_limit_ussd, single_txn_limit_bdc, single_txn_limit_other,
 max_txns_per_hour, max_txns_per_day, risk_score_boost, requires_additional_verification)
SELECT id, 1, 2000000, 500000, 200000, 3000000, 500000, 1000000, 250000, 100000, 1500000, 250000, 8, 30, 10, FALSE
FROM institutions
ON CONFLICT DO NOTHING;

INSERT INTO threshold_by_kyc_tier
(institution_id, kyc_tier, daily_limit_wire, daily_limit_mobile, daily_limit_ussd, daily_limit_bdc, daily_limit_other,
 single_txn_limit_wire, single_txn_limit_mobile, single_txn_limit_ussd, single_txn_limit_bdc, single_txn_limit_other,
 max_txns_per_hour, max_txns_per_day, risk_score_boost, requires_additional_verification)
SELECT id, 2, 5000000, 2000000, 500000, 10000000, 1000000, 2500000, 1000000, 250000, 5000000, 500000, 10, 50, 5, FALSE
FROM institutions
ON CONFLICT DO NOTHING;

INSERT INTO threshold_by_kyc_tier
(institution_id, kyc_tier, daily_limit_wire, daily_limit_mobile, daily_limit_ussd, daily_limit_bdc, daily_limit_other,
 single_txn_limit_wire, single_txn_limit_mobile, single_txn_limit_ussd, single_txn_limit_bdc, single_txn_limit_other,
 max_txns_per_hour, max_txns_per_day, risk_score_boost, requires_additional_verification)
SELECT id, 3, 50000000, 10000000, 2000000, 100000000, 5000000, 25000000, 5000000, 1000000, 50000000, 2000000, 20, 100, 0, FALSE
FROM institutions
ON CONFLICT DO NOTHING;
