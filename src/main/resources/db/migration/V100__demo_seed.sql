-- V100: Demo institution seed for client demonstrations.
--
-- Creates a fully-provisioned demo environment:
--   Institution : Vantage Microfinance Bank (demo)
--   Admin       : demo@vantage-mfb.com      / VantageDemo2026!
--   Analyst     : analyst@vantage-mfb.com   / Analyst@2026!
--   Auditor     : auditor@vantage-mfb.com   / Auditor@2026!
--   Beam key    : oivsk_ZSsuTtskqYTp5vv1hhvs2AU55p7Mfcu4X2bVOszBLbA
--   Wallet      : ₦500,000 demo credit (90-day validity)
--
-- All accounts are active with email verified. No TOTP is pre-configured —
-- users will be prompted to set it up on first login.
-- Skip this migration on production deployments (set flyway.locations to exclude
-- demo seeds, or delete this file before flyway runs).

DO $$
DECLARE
  inst_id  BIGINT;
  admin_id BIGINT;
  wallet_id BIGINT;
BEGIN

  -- ── Institution ──────────────────────────────────────────────────────────
  INSERT INTO institutions (name, type, status)
  VALUES ('Vantage Microfinance Bank', 'COMPANY', 'active')
  RETURNING id INTO inst_id;

  -- ── Users ─────────────────────────────────────────────────────────────────
  -- Admin
  INSERT INTO users (
    email, full_name, email_verified, password_hash,
    must_change_password, status, role, account_type, institution_id
  ) VALUES (
    'demo@vantage-mfb.com',
    'Vantage Demo Admin',
    TRUE,
    '$argon2id$v=19$m=19456,t=2,p=1$dRQ9BEy+RNjM/Z4l/oF4TQ$lmwtXnSO2XzuXG9Fqqjojf4CFiluvZ/HzetLSCU8vsU',
    FALSE, 'active', 'admin', 'COMPANY', inst_id
  ) RETURNING id INTO admin_id;

  -- Analyst
  INSERT INTO users (
    email, full_name, email_verified, password_hash,
    must_change_password, status, role, account_type, institution_id
  ) VALUES (
    'analyst@vantage-mfb.com',
    'Demo Analyst',
    TRUE,
    '$argon2id$v=19$m=19456,t=2,p=1$NF97gxzHzDVNSHWedb4vug$tRxOrcLn2187UhnCLF7uW6BxlPHknFVtEM8WchXOlc8',
    FALSE, 'active', 'analyst', 'COMPANY', inst_id
  );

  -- Auditor
  INSERT INTO users (
    email, full_name, email_verified, password_hash,
    must_change_password, status, role, account_type, institution_id
  ) VALUES (
    'auditor@vantage-mfb.com',
    'Demo Auditor',
    TRUE,
    '$argon2id$v=19$m=19456,t=2,p=1$RCnTR3xsX6RtCUnkc3zL5g$PMrsH+nOQMYkWLl82gMSeSyObe377ovaHnqGKg9P/rk',
    FALSE, 'active', 'auditor', 'COMPANY', inst_id
  );

  -- ── Billing wallet (₦500,000 demo credit = 5,000,000,000 units at 1 unit = ₦0.0001) ─
  INSERT INTO billing_wallets (institution_id, balance_units, credit_expires_at)
  VALUES (inst_id, 5000000000, now() + INTERVAL '90 days')
  RETURNING id INTO wallet_id;

  -- Seed ledger entry so the wallet history is not empty
  INSERT INTO billing_ledger (
    institution_id, wallet_id, type, category,
    amount_units, balance_units, description, ref
  ) VALUES (
    inst_id, wallet_id, 'credit', 'demo_grant',
    5000000000, 5000000000,
    'Demo credit grant — Vantage Microfinance Bank onboarding · ₦500,000',
    'DEMO-GRANT-VANTAGE-001'
  );

  -- ── AML settings (defaults sufficient; upserted here so dashboard loads clean) ──
  INSERT INTO aml_settings (institution_id, auto_open_case)
  VALUES (inst_id, TRUE)
  ON CONFLICT (institution_id) DO NOTHING;

  -- ── Beam API key ─────────────────────────────────────────────────────────
  -- Full key : oivsk_ZSsuTtskqYTp5vv1hhvs2AU55p7Mfcu4X2bVOszBLbA
  -- SHA-256  : f2cb033e1b713774669fede0fe51d52260a98a187ff2027821a1b75a770ea4f6
  -- Prefix   : oivsk_ZSsuTt
  INSERT INTO institution_beam_keys (institution_id, key_hash, prefix)
  VALUES (
    inst_id,
    'f2cb033e1b713774669fede0fe51d52260a98a187ff2027821a1b75a770ea4f6',
    'oivsk_ZSsuTt'
  )
  ON CONFLICT (institution_id) DO NOTHING;

END $$;
