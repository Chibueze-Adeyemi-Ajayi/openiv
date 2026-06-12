-- ─────────────────────────────────────────────────────────────────────────────
-- V108 — Four-plan model (Starter / Growth / Scale / Enterprise)
--
-- Reshapes the plan grid around four tiers at ₦500k / ₦1m / ₦1.5m / ₦3m+.
-- Inserts a new `scale` tier between Growth and Enterprise, rebalances every
-- cap (transactions, KYC pipelines, NFIU filings, cases, seats, rate limit,
-- AML rules), adds monthly cap columns for NFIU and cases, drops the
-- ai_features_enabled column (Eureka AI is not shipped — flag removed from
-- the Java model and frontend in the prior cleanup pass).
--
-- Per-call wallet billing for transactions/cases/NFIU is intentionally NOT
-- re-introduced here: plan price covers everything within the cap; wallet
-- pays only for Dojah-passthrough KYC steps when those are wired through.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  starter_id    UUID;
  growth_id     UUID;
  scale_id      UUID;
  enterprise_id UUID;
BEGIN

  -- ── Self-healing bootstrap ────────────────────────────────────────────────
  -- A prior Migrations.repairStaleHistory bug could leave the schema baselined
  -- at V106 without actually having applied V102–V105. Recreate the table and
  -- catch up missing columns + base seed rows so V108's own work below can run.
  -- Safe on already-correct DBs because everything is IF NOT EXISTS / ON CONFLICT.
  CREATE TABLE IF NOT EXISTS subscription_plans (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                        TEXT        NOT NULL,
    slug                        TEXT        NOT NULL UNIQUE,
    monthly_price_ngn           NUMERIC(14,2) NOT NULL DEFAULT 0,
    max_users                   INTEGER     NOT NULL DEFAULT -1,
    max_monthly_transactions    BIGINT      NOT NULL DEFAULT -1,
    max_active_cases            INTEGER     NOT NULL DEFAULT -1,
    ai_features_enabled         BOOLEAN     NOT NULL DEFAULT false,
    api_rate_limit_per_min      INTEGER     NOT NULL DEFAULT 60,
    included_transaction_units  BIGINT      NOT NULL DEFAULT 0,
    features                    TEXT[]      NOT NULL DEFAULT '{}',
    is_active                   BOOLEAN     NOT NULL DEFAULT true,
    sort_order                  INTEGER     NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Catch-up columns from V103 (feature flags + max_aml_rules)
  ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS feature_kyc_enabled        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS feature_webhooks_enabled   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS feature_network_enabled    BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS feature_behavioral_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS feature_reports_export     BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS max_aml_rules              INTEGER NOT NULL DEFAULT 10;

  -- Catch-up column from V104 (KYC cap)
  ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS max_monthly_kyc_lookups    INTEGER NOT NULL DEFAULT -1;

  -- Catch-up columns on institutions from V102/V104 (subscription lifecycle + counters)
  ALTER TABLE institutions
    ADD COLUMN IF NOT EXISTS plan_id                UUID        REFERENCES subscription_plans(id),
    ADD COLUMN IF NOT EXISTS subscription_status    TEXT        NOT NULL DEFAULT 'trial',
    ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS trial_ends_at          TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),
    ADD COLUMN IF NOT EXISTS subscription_renews_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),
    ADD COLUMN IF NOT EXISTS monthly_txn_used       INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS monthly_kyc_used       INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS usage_period_start     TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS subscription_blocked   BOOLEAN     NOT NULL DEFAULT FALSE;

  -- Seed the three base plans if they're not already present (V102's original INSERT).
  -- V108's UPDATEs below need these rows to exist by slug.
  INSERT INTO subscription_plans
    (name, slug, monthly_price_ngn, max_users, max_monthly_transactions,
     max_active_cases, api_rate_limit_per_min, included_transaction_units,
     features, sort_order)
  VALUES
    ('Starter',    'starter',    50000.00,  5,  10000,  20,  30,   10000000,  ARRAY[]::TEXT[], 1),
    ('Growth',     'growth',     150000.00, 20, 100000, 200, 120,  100000000, ARRAY[]::TEXT[], 2),
    ('Enterprise', 'enterprise', 500000.00, -1, -1,     -1,  600,  1000000000,ARRAY[]::TEXT[], 3)
  ON CONFLICT (slug) DO NOTHING;

  -- Catch-up V106 (subscription_invoices + subscription_reminder_log).
  -- RenewalReminderScheduler queries these tables on a Vertx timer; missing the
  -- tables produces 42P01 errors every interval. Recreate idempotently.
  CREATE TABLE IF NOT EXISTS subscription_invoices (
    id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id        BIGINT        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    plan_id               UUID          NOT NULL REFERENCES subscription_plans(id),
    invoice_type          VARCHAR(20)   NOT NULL CHECK (invoice_type IN ('upgrade','downgrade','renewal')),
    amount_ngn            NUMERIC(12,2) NOT NULL,
    discount_percent      NUMERIC(4,2)  NOT NULL DEFAULT 0,
    discounted_amount_ngn NUMERIC(12,2) NOT NULL,
    coupon_code           VARCHAR(64)   UNIQUE,
    coupon_expires_at     TIMESTAMPTZ,
    paystack_reference    VARCHAR(100),
    status                VARCHAR(20)   NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','paid','expired','cancelled')),
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
    paid_at               TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_sub_invoices_institution ON subscription_invoices(institution_id);
  CREATE INDEX IF NOT EXISTS idx_sub_invoices_reference   ON subscription_invoices(paystack_reference)
    WHERE paystack_reference IS NOT NULL;

  CREATE TABLE IF NOT EXISTS subscription_reminder_log (
    id               BIGSERIAL   PRIMARY KEY,
    institution_id   BIGINT      NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    reminder_type    VARCHAR(10) NOT NULL CHECK (reminder_type IN ('7d','3d','24h')),
    for_renewal_date DATE        NOT NULL,
    invoice_id       UUID        REFERENCES subscription_invoices(id),
    sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (institution_id, reminder_type, for_renewal_date)
  );

  -- ── New cap columns (original V108 work starts here) ──────────────────────
  ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS max_monthly_nfiu_filings INTEGER NOT NULL DEFAULT -1,
    ADD COLUMN IF NOT EXISTS max_monthly_cases        INTEGER NOT NULL DEFAULT -1;

  -- ── Drop the legacy AI flag ───────────────────────────────────────────────
  -- Eureka AI was never shipped; the field was removed from the SubscriptionPlan
  -- Java record and the frontend. The column is the last reference.
  ALTER TABLE subscription_plans
    DROP COLUMN IF EXISTS ai_features_enabled;

  -- ── Counter columns on institutions ───────────────────────────────────────
  -- Reset lazily on first event per period (mirrors monthly_txn_used /
  -- monthly_kyc_used pattern from V104).
  ALTER TABLE institutions
    ADD COLUMN IF NOT EXISTS monthly_nfiu_used  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS monthly_cases_used INTEGER NOT NULL DEFAULT 0;

  -- ── Insert Scale plan (slots between Growth and Enterprise) ───────────────
  INSERT INTO subscription_plans
    (name, slug, monthly_price_ngn, max_users, max_monthly_transactions,
     max_active_cases, api_rate_limit_per_min, included_transaction_units,
     features, sort_order)
  VALUES
    ('Scale', 'scale', 1500000.00, 50, 1000000, 2500, 300, 1000000000,
     ARRAY[
       'Everything in Growth',
       '1,000,000 transactions / month',
       '10,000 KYC pipelines / month',
       '200 NFIU filings / month',
       '50 team members',
       '300 req/min API rate limit',
       'Priority support'
     ], 3)
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO starter_id    FROM subscription_plans WHERE slug = 'starter';
  SELECT id INTO growth_id     FROM subscription_plans WHERE slug = 'growth';
  SELECT id INTO scale_id      FROM subscription_plans WHERE slug = 'scale';
  SELECT id INTO enterprise_id FROM subscription_plans WHERE slug = 'enterprise';

  -- ── Starter (₦500k) ───────────────────────────────────────────────────────
  UPDATE subscription_plans SET
    name                      = 'Starter',
    monthly_price_ngn         = 500000.00,
    max_users                 = 5,
    max_monthly_transactions  = 50000,
    max_active_cases          = 100,
    max_monthly_kyc_lookups   = 0,
    max_monthly_nfiu_filings  = 10,
    max_monthly_cases         = 100,
    api_rate_limit_per_min    = 30,
    max_aml_rules             = 10,
    feature_kyc_enabled       = false,
    feature_webhooks_enabled  = false,
    feature_network_enabled   = false,
    feature_behavioral_enabled= false,
    feature_reports_export    = false,
    sort_order                = 1,
    features                  = ARRAY[
      'Core AML rule engine (10 rules)',
      '50,000 transactions / month',
      'NFIU STR / CTR filing',
      '5 team members',
      'Email support'
    ]
  WHERE slug = 'starter';

  -- ── Growth (₦1m) — repriced from ₦750k, caps raised ──────────────────────
  UPDATE subscription_plans SET
    name                      = 'Growth',
    monthly_price_ngn         = 1000000.00,
    max_users                 = 20,
    max_monthly_transactions  = 250000,
    max_active_cases          = 500,
    max_monthly_kyc_lookups   = 2500,
    max_monthly_nfiu_filings  = 50,
    max_monthly_cases         = 500,
    api_rate_limit_per_min    = 120,
    max_aml_rules             = 29,
    feature_kyc_enabled       = true,
    feature_webhooks_enabled  = true,
    feature_network_enabled   = true,
    feature_behavioral_enabled= true,
    feature_reports_export    = true,
    sort_order                = 2,
    features                  = ARRAY[
      'Full 29-rule AML engine',
      '250,000 transactions / month',
      '2,500 KYC pipelines / month',
      'NFIU filing (all types)',
      'Webhooks + network logs',
      'Behavioral analytics',
      'Report export',
      '20 team members',
      'Priority support'
    ]
  WHERE slug = 'growth';

  -- ── Scale (₦1.5m) — set above as INSERT defaults, ensure full-feature ────
  UPDATE subscription_plans SET
    max_monthly_kyc_lookups   = 10000,
    max_monthly_nfiu_filings  = 200,
    max_monthly_cases         = 2500,
    max_aml_rules             = 29,
    feature_kyc_enabled       = true,
    feature_webhooks_enabled  = true,
    feature_network_enabled   = true,
    feature_behavioral_enabled= true,
    feature_reports_export    = true
  WHERE slug = 'scale';

  -- ── Enterprise (from ₦3m) — was ₦0 placeholder, now real floor price ────
  UPDATE subscription_plans SET
    name                      = 'Enterprise',
    monthly_price_ngn         = 3000000.00,
    max_users                 = -1,
    max_monthly_transactions  = -1,
    max_active_cases          = -1,
    max_monthly_kyc_lookups   = -1,
    max_monthly_nfiu_filings  = -1,
    max_monthly_cases         = -1,
    api_rate_limit_per_min    = 600,
    max_aml_rules             = 29,
    feature_kyc_enabled       = true,
    feature_webhooks_enabled  = true,
    feature_network_enabled   = true,
    feature_behavioral_enabled= true,
    feature_reports_export    = true,
    sort_order                = 4,
    features                  = ARRAY[
      'Everything in Scale',
      'Unlimited transactions / KYC / cases',
      'Unlimited team members',
      '600 req/min API rate limit',
      'Custom integrations',
      'Dedicated success manager',
      'From ₦3,000,000 / month — contact sales'
    ]
  WHERE slug = 'enterprise';

END $$;
