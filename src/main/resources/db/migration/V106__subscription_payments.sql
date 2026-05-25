-- Invoice/payment tracking for subscription lifecycle
CREATE TABLE subscription_invoices (
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

CREATE INDEX idx_sub_invoices_institution ON subscription_invoices(institution_id);
CREATE INDEX idx_sub_invoices_reference   ON subscription_invoices(paystack_reference)
  WHERE paystack_reference IS NOT NULL;

-- Prevents sending the same reminder twice per renewal cycle
CREATE TABLE subscription_reminder_log (
  id               BIGSERIAL   PRIMARY KEY,
  institution_id   BIGINT      NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  reminder_type    VARCHAR(10) NOT NULL CHECK (reminder_type IN ('7d','3d','24h')),
  for_renewal_date DATE        NOT NULL,
  invoice_id       UUID        REFERENCES subscription_invoices(id),
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, reminder_type, for_renewal_date)
);

-- Block expired accounts
ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS subscription_blocked BOOLEAN NOT NULL DEFAULT FALSE;
