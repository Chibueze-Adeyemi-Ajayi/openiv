-- V133: Demo institution seed — Bank of Nigeria.
--
-- Creates a fully-provisioned demo environment for client presentations.
--   Institution : Bank of Nigeria
--   Admin       : admin@bank-of-nigeria.com        / BonAdmin2026!
--   CCO         : cco@bank-of-nigeria.com          / BonCco2026!
--   Analyst     : analyst@bank-of-nigeria.com      / BonAnalyst2026!
--   Developer   : developer@bank-of-nigeria.com    / BonDev2026!
--   Beam key    : oivsk_xjsF_ZznsGWZjiOEsDm7ClHlVLMvdhHfz63okS4ae4g
--   Wallet      : ₦500,000 demo credit (90-day validity)
--
-- Runs automatically on startup via Flyway. Safe to run multiple times —
-- guarded by the institution name uniqueness check.

DO $$
DECLARE
  inst_id   BIGINT;
  admin_id  BIGINT;
  cco_id    BIGINT;
  analyst_id BIGINT;
  dev_id    BIGINT;
  wallet_id BIGINT;
BEGIN

  -- ── Guard: skip if already seeded ────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM institutions WHERE name = 'Bank of Nigeria') THEN
    RETURN;
  END IF;

  -- ── Institution ──────────────────────────────────────────────────────────
  INSERT INTO institutions (name, type, status, industry)
  VALUES ('Bank of Nigeria', 'COMPANY', 'active', 'banking')
  RETURNING id INTO inst_id;

  -- ── Users ─────────────────────────────────────────────────────────────────
  -- Admin  (BonAdmin2026!)
  INSERT INTO users (
    email, full_name, email_verified, password_hash,
    must_change_password, status, role, account_type, institution_id
  ) VALUES (
    'admin@bank-of-nigeria.com',
    'BON Admin',
    TRUE,
    '$argon2id$v=19$m=19456,t=2,p=1$Y4y98wkmTouZwuYsrA1J6w$2rqGQLmmuz0wVH+z4WaNJCBDFSvTkOoLCnk1QSDgDKI',
    FALSE, 'active', 'admin', 'COMPANY', inst_id
  ) RETURNING id INTO admin_id;

  -- CCO  (BonCco2026!)
  INSERT INTO users (
    email, full_name, email_verified, password_hash,
    must_change_password, status, role, account_type, institution_id
  ) VALUES (
    'cco@bank-of-nigeria.com',
    'BON Compliance Officer',
    TRUE,
    '$argon2id$v=19$m=19456,t=2,p=1$bak6PSS71FjxIVuBNMn/7g$xGEfMDtD+xM1vFOoNcYQPFsw3xh6TiBL3OH38DVO8Xs',
    FALSE, 'active', 'cco', 'COMPANY', inst_id
  ) RETURNING id INTO cco_id;

  -- Analyst  (BonAnalyst2026!)
  INSERT INTO users (
    email, full_name, email_verified, password_hash,
    must_change_password, status, role, account_type, institution_id
  ) VALUES (
    'analyst@bank-of-nigeria.com',
    'BON Analyst',
    TRUE,
    '$argon2id$v=19$m=19456,t=2,p=1$j2hqJQan+7KPY8qcc3NS2Q$brXLo21bSUF1GULSRt1h4n9Vt2WBVOZctlaAVFOqPJ0',
    FALSE, 'active', 'analyst', 'COMPANY', inst_id
  ) RETURNING id INTO analyst_id;

  -- Developer  (BonDev2026!)
  INSERT INTO users (
    email, full_name, email_verified, password_hash,
    must_change_password, status, role, account_type, institution_id
  ) VALUES (
    'developer@bank-of-nigeria.com',
    'BON Developer',
    TRUE,
    '$argon2id$v=19$m=19456,t=2,p=1$llZC4aRFt+IZLvcSJpRt+Q$LRGVbhz/KF6ZhY9ZiRSHmQG9x5X3IEavnrU+MW2LMqA',
    FALSE, 'active', 'developer', 'COMPANY', inst_id
  ) RETURNING id INTO dev_id;

  -- ── Billing wallet (₦500,000 demo credit) ─────────────────────────────────
  INSERT INTO billing_wallets (institution_id, balance_units, credit_expires_at)
  VALUES (inst_id, 5000000000, now() + INTERVAL '90 days')
  RETURNING id INTO wallet_id;

  INSERT INTO billing_ledger (
    institution_id, wallet_id, type, category,
    amount_units, balance_units, description, ref
  ) VALUES (
    inst_id, wallet_id, 'credit', 'demo_grant',
    5000000000, 5000000000,
    'Demo credit grant — Bank of Nigeria onboarding · ₦500,000',
    'DEMO-GRANT-BON-001'
  );

  -- ── AML settings ──────────────────────────────────────────────────────────
  INSERT INTO aml_settings (institution_id, auto_open_case)
  VALUES (inst_id, TRUE)
  ON CONFLICT (institution_id) DO NOTHING;

  -- ── Beam API key ──────────────────────────────────────────────────────────
  -- Full key : oivsk_xjsF_ZznsGWZjiOEsDm7ClHlVLMvdhHfz63okS4ae4g
  -- SHA-256  : f1840cc208232e6b8872265d730fb4cad3da32b6c78972130513592cf2472f7c
  -- Prefix   : oivsk_xjsF_Zzn
  INSERT INTO institution_beam_keys (institution_id, key_hash, prefix)
  VALUES (
    inst_id,
    'f1840cc208232e6b8872265d730fb4cad3da32b6c78972130513592cf2472f7c',
    'oivsk_xjsF_Zzn'
  )
  ON CONFLICT (institution_id) DO NOTHING;

  -- ── Custom roles (Team & Roles page) ──────────────────────────────────────
  INSERT INTO custom_roles (id, institution_id, name, description, color, permissions) VALUES
  (
    'bon-role-senior-investigator',
    inst_id,
    'Senior Investigator',
    'Handles complex AML cases, escalated alerts, and coordinates STR/SAR filings with the CCO.',
    '#7c3aed',
    '{
      "viewTransactions": true,
      "flagTransactions": true,
      "viewCases": true,
      "manageCases": true,
      "viewCustomers": true,
      "viewReports": true,
      "fileReports": true,
      "viewAlerts": true,
      "manageAlerts": true
    }'::jsonb
  ),
  (
    'bon-role-compliance-manager',
    inst_id,
    'Compliance Manager',
    'Reviews and approves NFIU filings, oversees CDD workflow results, and signs off on policy changes.',
    '#0369a1',
    '{
      "viewTransactions": true,
      "viewCases": true,
      "viewCustomers": true,
      "viewReports": true,
      "fileReports": true,
      "approveReports": true,
      "viewWorkflows": true,
      "manageWorkflows": true,
      "viewAlerts": true
    }'::jsonb
  ),
  (
    'bon-role-it-security',
    inst_id,
    'IT Security',
    'Manages system integration keys, reviews monitoring pipeline rules, and supports IT vetting for deployed AML rules.',
    '#b91c1c',
    '{
      "viewTransactions": true,
      "viewCases": true,
      "viewCustomers": false,
      "viewReports": false,
      "viewWorkflows": true,
      "viewPipelines": true,
      "managePipelines": true,
      "itVetRules": true
    }'::jsonb
  );

END $$;
