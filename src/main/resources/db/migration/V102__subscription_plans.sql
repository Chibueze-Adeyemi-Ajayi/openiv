DO $$
DECLARE
  starter_id UUID;
  growth_id  UUID;
  enterprise_id UUID;
BEGIN

  -- ── subscription_plans ────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS subscription_plans (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                        TEXT        NOT NULL,
    slug                        TEXT        NOT NULL UNIQUE,
    monthly_price_ngn           NUMERIC(14,2) NOT NULL DEFAULT 0,
    max_users                   INTEGER     NOT NULL DEFAULT -1,       -- -1 = unlimited
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

  -- ── institutions columns ──────────────────────────────────────────────────
  ALTER TABLE institutions
    ADD COLUMN IF NOT EXISTS plan_id                UUID        REFERENCES subscription_plans(id),
    ADD COLUMN IF NOT EXISTS subscription_status    TEXT        NOT NULL DEFAULT 'trial',
    ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS trial_ends_at          TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),
    ADD COLUMN IF NOT EXISTS subscription_renews_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days');

  ALTER TABLE institutions
    DROP CONSTRAINT IF EXISTS institutions_subscription_status_check;
  ALTER TABLE institutions
    ADD CONSTRAINT institutions_subscription_status_check
    CHECK (subscription_status IN ('trial','active','past_due','cancelled'));

  -- ── seed plans ────────────────────────────────────────────────────────────
  INSERT INTO subscription_plans
    (name, slug, monthly_price_ngn, max_users, max_monthly_transactions,
     max_active_cases, ai_features_enabled, api_rate_limit_per_min,
     included_transaction_units, features, sort_order)
  VALUES
    ('Starter', 'starter', 50000.00, 5, 10000, 20, false, 30, 10000000,
     ARRAY[
       'AML Rules Engine (10 rules)',
       'NFIU Filing (STR / CTR)',
       'Basic Reports',
       'Up to 5 team members',
       'Email support'
     ], 1),
    ('Growth', 'growth', 150000.00, 20, 100000, 200, true, 120, 100000000,
     ARRAY[
       'Full 29-rule AML Engine',
       'NFIU Filing (all types)',
       'Advanced Analytics',
       'KYC Lookup',
       'Eureka AI Assistant',
       'Up to 20 team members',
       'Priority support',
       'Custom rule configuration'
     ], 2),
    ('Enterprise', 'enterprise', 500000.00, -1, -1, -1, true, 600, 1000000000,
     ARRAY[
       'Everything in Growth',
       'Unlimited team members',
       'Dedicated account manager',
       'Custom integrations & API',
       'White-label option',
       'Audit log export',
       'SLA guarantee',
       'On-site onboarding'
     ], 3)
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO starter_id    FROM subscription_plans WHERE slug = 'starter';
  SELECT id INTO growth_id     FROM subscription_plans WHERE slug = 'growth';
  SELECT id INTO enterprise_id FROM subscription_plans WHERE slug = 'enterprise';

  -- ── assign existing institutions to Growth trial ──────────────────────────
  UPDATE institutions SET
    plan_id                = growth_id,
    subscription_status    = 'trial',
    subscription_starts_at = now(),
    trial_ends_at          = now() + INTERVAL '30 days',
    subscription_renews_at = now() + INTERVAL '30 days'
  WHERE plan_id IS NULL AND growth_id IS NOT NULL;

END $$;
