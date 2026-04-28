-- ─────────────────────────────────────────────────────────────────────────────
-- Billing: wallet, ledger, payment methods
-- Amount precision: 1 unit = ₦0.0001  (1 NGN = 10,000 units)
--   BEAM_INGEST        8 units  = ₦0.0008
--   WEBHOOK_DELIVERY   1 unit   = ₦0.0001
--   KYC_LOOKUP     250,000 units = ₦25.00
--   Welcome credit 5,000,000,000 units = ₦500,000
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE billing_wallets (
    id                BIGSERIAL     PRIMARY KEY,
    institution_id    BIGINT        NOT NULL UNIQUE REFERENCES institutions(id),
    balance_units     BIGINT        NOT NULL DEFAULT 0,
    credit_expires_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE billing_ledger (
    id              BIGSERIAL   PRIMARY KEY,
    institution_id  BIGINT      NOT NULL REFERENCES institutions(id),
    wallet_id       BIGINT      NOT NULL REFERENCES billing_wallets(id),
    type            TEXT        NOT NULL CHECK (type IN ('credit', 'debit')),
    category        TEXT        NOT NULL,
    amount_units    BIGINT      NOT NULL CHECK (amount_units > 0),
    balance_units   BIGINT      NOT NULL,
    description     TEXT        NOT NULL,
    ref             TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_billing_ledger_institution ON billing_ledger(institution_id, created_at DESC);

CREATE TABLE payment_methods (
    id              BIGSERIAL   PRIMARY KEY,
    institution_id  BIGINT      NOT NULL REFERENCES institutions(id),
    provider        TEXT        NOT NULL,
    provider_ref    TEXT        NOT NULL,
    type            TEXT        NOT NULL CHECK (type IN ('card', 'bank')),
    display_name    TEXT        NOT NULL,
    last4           TEXT,
    is_default      BOOLEAN     NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_payment_methods_institution ON payment_methods(institution_id);

-- ── Bootstrap existing institutions with 500k NGN welcome credit ──────────────

INSERT INTO billing_wallets (institution_id, balance_units, credit_expires_at)
SELECT id, 5000000000, now() + INTERVAL '30 days'
FROM institutions
ON CONFLICT (institution_id) DO NOTHING;

INSERT INTO billing_ledger
    (institution_id, wallet_id, type, category, amount_units, balance_units, description, ref)
SELECT i.id, bw.id,
       'credit', 'welcome_credit',
       5000000000, 5000000000,
       '30-day welcome credit · ₦500,000',
       'WELCOME-CREDIT'
FROM institutions i
JOIN billing_wallets bw ON bw.institution_id = i.id;
