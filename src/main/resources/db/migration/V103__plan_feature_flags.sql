DO $$
BEGIN

  -- ── Feature flag columns ──────────────────────────────────────────────────
  ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS feature_kyc_enabled        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS feature_webhooks_enabled   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS feature_network_enabled    BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS feature_behavioral_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS feature_reports_export     BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS max_aml_rules              INTEGER NOT NULL DEFAULT 10;

  -- ── Starter — basic AML + NFIU only ──────────────────────────────────────
  UPDATE subscription_plans SET
    feature_kyc_enabled        = false,
    feature_webhooks_enabled   = false,
    feature_network_enabled    = false,
    feature_behavioral_enabled = false,
    feature_reports_export     = false,
    max_aml_rules              = 10
  WHERE slug = 'starter';

  -- ── Growth — full feature set ─────────────────────────────────────────────
  UPDATE subscription_plans SET
    feature_kyc_enabled        = true,
    feature_webhooks_enabled   = true,
    feature_network_enabled    = true,
    feature_behavioral_enabled = true,
    feature_reports_export     = true,
    max_aml_rules              = 29
  WHERE slug = 'growth';

  -- ── Enterprise — full feature set ────────────────────────────────────────
  UPDATE subscription_plans SET
    feature_kyc_enabled        = true,
    feature_webhooks_enabled   = true,
    feature_network_enabled    = true,
    feature_behavioral_enabled = true,
    feature_reports_export     = true,
    max_aml_rules              = 29
  WHERE slug = 'enterprise';

END $$;
