DO $$
BEGIN

  -- ── Update plan pricing ───────────────────────────────────────────────────
  UPDATE subscription_plans SET monthly_price_ngn = 500000.00 WHERE slug = 'starter';
  UPDATE subscription_plans SET monthly_price_ngn = 750000.00 WHERE slug = 'growth';
  UPDATE subscription_plans SET monthly_price_ngn = 0.00      WHERE slug = 'enterprise'; -- custom / contact sales

  -- ── Calibrate transaction limits to match new pricing tiers ──────────────
  UPDATE subscription_plans SET max_monthly_transactions = 50000   WHERE slug = 'starter';
  UPDATE subscription_plans SET max_monthly_transactions = 500000  WHERE slug = 'growth';
  -- enterprise stays -1 (unlimited)

  -- ── Add monthly KYC lookup cap column ────────────────────────────────────
  ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS max_monthly_kyc_lookups INTEGER NOT NULL DEFAULT -1;

  UPDATE subscription_plans SET max_monthly_kyc_lookups = 200   WHERE slug = 'starter';
  UPDATE subscription_plans SET max_monthly_kyc_lookups = 2000  WHERE slug = 'growth';
  UPDATE subscription_plans SET max_monthly_kyc_lookups = -1    WHERE slug = 'enterprise';

  -- ── Monthly usage counters on institutions ────────────────────────────────
  -- usage_period_start marks when the current 30-day window began.
  -- Counters are reset lazily (on first request after period expires) rather
  -- than by a scheduled job, which removes the need for a cron and is safe
  -- under concurrent requests because the reset is done atomically with the
  -- increment in UsageRepository.checkAndIncrement().
  ALTER TABLE institutions
    ADD COLUMN IF NOT EXISTS monthly_txn_used    INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS monthly_kyc_used    INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS usage_period_start  TIMESTAMPTZ NOT NULL DEFAULT now();

END $$;
