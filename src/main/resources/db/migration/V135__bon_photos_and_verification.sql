-- V135: Fix BON customer photos + populate verification check data.
--
-- 1. Updates customer.photo URLs from the stale randomuser.me URLs (which ran
--    from the old JAR before V134 was rebuilt with pravatar.cc URLs) to the
--    correct pravatar.cc portrait URLs.
-- 2. Populates selfie_photo on customers (simulating a submitted selfie).
-- 3. Inserts kyc_pipeline_results rows so the Verification Checks section
--    in UserProfilePage shows real pass/fail/review data for each BON customer.

DO $$
DECLARE
  inst_id BIGINT;
BEGIN

  SELECT id INTO inst_id FROM institutions WHERE name = 'Bank of Nigeria';
  IF inst_id IS NULL THEN RETURN; END IF;

  -- ── 1. Fix customer photo URLs ──────────────────────────────────────────────
  UPDATE customers SET
    photo       = 'https://i.pravatar.cc/300?img=44',
    selfie_photo = 'https://i.pravatar.cc/300?img=44'
  WHERE institution_id = inst_id AND external_id = 'BON-CUST-001';

  UPDATE customers SET
    photo       = 'https://i.pravatar.cc/300?img=48',
    selfie_photo = 'https://i.pravatar.cc/300?img=48'
  WHERE institution_id = inst_id AND external_id = 'BON-CUST-002';

  UPDATE customers SET
    photo       = 'https://i.pravatar.cc/300?img=32',
    selfie_photo = 'https://i.pravatar.cc/300?img=32'
  WHERE institution_id = inst_id AND external_id = 'BON-CUST-003';

  UPDATE customers SET
    photo       = 'https://i.pravatar.cc/300?img=29',
    selfie_photo = 'https://i.pravatar.cc/300?img=29'
  WHERE institution_id = inst_id AND external_id = 'BON-CUST-004';

  UPDATE customers SET
    photo       = 'https://i.pravatar.cc/300?img=57',
    selfie_photo = 'https://i.pravatar.cc/300?img=57'
  WHERE institution_id = inst_id AND external_id = 'BON-CUST-005';

  UPDATE customers SET
    photo       = 'https://i.pravatar.cc/300?img=66',
    selfie_photo = 'https://i.pravatar.cc/300?img=66'
  WHERE institution_id = inst_id AND external_id = 'BON-CUST-006';

  UPDATE customers SET
    photo       = 'https://i.pravatar.cc/300?img=33',
    selfie_photo = 'https://i.pravatar.cc/300?img=33'
  WHERE institution_id = inst_id AND external_id = 'BON-CUST-007';

  UPDATE customers SET
    photo       = 'https://i.pravatar.cc/300?img=20',
    selfie_photo = 'https://i.pravatar.cc/300?img=20'
  WHERE institution_id = inst_id AND external_id = 'BON-CUST-008';

  UPDATE customers SET
    photo       = 'https://i.pravatar.cc/300?img=70',
    selfie_photo = 'https://i.pravatar.cc/300?img=70'
  WHERE institution_id = inst_id AND external_id = 'BON-CUST-009';

  UPDATE customers SET
    photo       = 'https://i.pravatar.cc/300?img=58',
    selfie_photo = 'https://i.pravatar.cc/300?img=58'
  WHERE institution_id = inst_id AND external_id = 'BON-CUST-010';

  UPDATE customers SET
    photo       = 'https://i.pravatar.cc/300?img=65',
    selfie_photo = 'https://i.pravatar.cc/300?img=65'
  WHERE institution_id = inst_id AND external_id = 'BON-CUST-011';

  -- BON-CUST-012 and BON-CUST-013 are corporate — no photo needed.

  UPDATE customers SET
    photo       = 'https://i.pravatar.cc/300?img=12',
    selfie_photo = 'https://i.pravatar.cc/300?img=12'
  WHERE institution_id = inst_id AND external_id = 'BON-CUST-014';

  UPDATE customers SET
    photo       = 'https://i.pravatar.cc/300?img=5',
    selfie_photo = 'https://i.pravatar.cc/300?img=5'
  WHERE institution_id = inst_id AND external_id = 'BON-CUST-015';

  -- ── 2. KYC pipeline results (verification checks) ────────────────────────────
  -- identity_photo_b64 stores the NIN/BVN record photo URL (used as fallback
  -- identity photo in UserProfilePage; frontend now handles both URL and base64).
  --
  -- Status values: 'pass' | 'match' (fail) | 'not_found' (warn)
  -- knowledge_level: 't1' | 't2' | 't3'
  -- overall_status: 'clear' | 'flagged' | 'case_opened'
  -- action_taken: 'clear' | 'flagged' | 'case_opened'

  -- BON-CUST-001  Ngozi Adebayo — fully verified, clean
  INSERT INTO kyc_pipeline_results (
    institution_id, customer_id, run_at, overall_risk_score, knowledge_level,
    overall_status, action_taken,
    bvn_nin_status, bvn_nin_score, bvn_nin_detail,
    phone_status,   phone_score,   phone_detail,
    liveness_status, liveness_score, liveness_detail,
    pep_status,     pep_score,     pep_detail,
    duration_ms,    identity_photo_b64
  ) VALUES (
    inst_id, 'BON-CUST-001', now() - INTERVAL '10 days', 15, 't2',
    'clear', 'clear',
    'pass', 96, 'BVN and NIN records match — full name, DOB and address confirmed',
    'pass', 91, 'MTN subscriber since 2018 — identity linked',
    'pass', 94, 'Selfie biometric matched BVN photo with 94% confidence',
    'pass', 98, 'No PEP or sanctions entries found',
    1840, 'https://i.pravatar.cc/300?img=44'
  ) ON CONFLICT (institution_id, customer_id) DO NOTHING;

  -- BON-CUST-002  Amaka Eze — fully verified, clean
  INSERT INTO kyc_pipeline_results (
    institution_id, customer_id, run_at, overall_risk_score, knowledge_level,
    overall_status, action_taken,
    bvn_nin_status, bvn_nin_score, bvn_nin_detail,
    phone_status,   phone_score,   phone_detail,
    liveness_status, liveness_score, liveness_detail,
    pep_status,     pep_score,     pep_detail,
    duration_ms,    identity_photo_b64
  ) VALUES (
    inst_id, 'BON-CUST-002', now() - INTERVAL '8 days', 19, 't2',
    'clear', 'clear',
    'pass', 93, 'BVN and NIN match — identity confirmed across both registries',
    'pass', 88, 'Airtel subscriber — number linked to registered BVN',
    'pass', 91, 'Selfie matched NIN record photo — biometric check passed',
    'pass', 97, 'No PEP listings or sanctions hits',
    1720, 'https://i.pravatar.cc/300?img=48'
  ) ON CONFLICT (institution_id, customer_id) DO NOTHING;

  -- BON-CUST-003  Halima Sule — fully verified, clean (lowest risk)
  INSERT INTO kyc_pipeline_results (
    institution_id, customer_id, run_at, overall_risk_score, knowledge_level,
    overall_status, action_taken,
    bvn_nin_status, bvn_nin_score, bvn_nin_detail,
    phone_status,   phone_score,   phone_detail,
    liveness_status, liveness_score, liveness_detail,
    pep_status,     pep_score,     pep_detail,
    duration_ms,    identity_photo_b64
  ) VALUES (
    inst_id, 'BON-CUST-003', now() - INTERVAL '15 days', 8, 't2',
    'clear', 'clear',
    'pass', 98, 'Full match — BVN and NIN verified, DOB confirmed',
    'pass', 95, 'Glo subscriber — SIM registered to matching ID',
    'pass', 96, 'High-confidence biometric match — 96% similarity',
    'pass', 99, 'PEP and sanctions: no matches',
    1560, 'https://i.pravatar.cc/300?img=32'
  ) ON CONFLICT (institution_id, customer_id) DO NOTHING;

  -- BON-CUST-004  Chidinma Obi — verified, clean
  INSERT INTO kyc_pipeline_results (
    institution_id, customer_id, run_at, overall_risk_score, knowledge_level,
    overall_status, action_taken,
    bvn_nin_status, bvn_nin_score, bvn_nin_detail,
    phone_status,   phone_score,   phone_detail,
    liveness_status, liveness_score, liveness_detail,
    pep_status,     pep_score,     pep_detail,
    duration_ms,    identity_photo_b64
  ) VALUES (
    inst_id, 'BON-CUST-004', now() - INTERVAL '12 days', 11, 't2',
    'clear', 'clear',
    'pass', 94, 'BVN and NIN verified — name and address match',
    'pass', 89, 'MTN subscriber — phone linked to verified BVN',
    'pass', 92, 'Liveness check passed — selfie biometric confirmed',
    'pass', 97, 'No PEP or sanctions matches',
    1680, 'https://i.pravatar.cc/300?img=29'
  ) ON CONFLICT (institution_id, customer_id) DO NOTHING;

  -- BON-CUST-005  Kelechi Nwosu — verified, minor DOB discrepancy flagged
  INSERT INTO kyc_pipeline_results (
    institution_id, customer_id, run_at, overall_risk_score, knowledge_level,
    overall_status, action_taken,
    bvn_nin_status, bvn_nin_score, bvn_nin_detail,
    phone_status,   phone_score,   phone_detail,
    liveness_status, liveness_score, liveness_detail,
    pep_status,     pep_score,     pep_detail,
    duration_ms,    identity_photo_b64
  ) VALUES (
    inst_id, 'BON-CUST-005', now() - INTERVAL '7 days', 24, 't2',
    'clear', 'clear',
    'pass', 87, 'BVN verified — NIN DOB differs by 1 day (likely data-entry error in NIN registry)',
    'pass', 84, 'Airtel subscriber — phone identity linked',
    'pass', 88, 'Selfie matched BVN photo — biometric passed',
    'pass', 95, 'No PEP or watchlist entries',
    1920, 'https://i.pravatar.cc/300?img=57'
  ) ON CONFLICT (institution_id, customer_id) DO NOTHING;

  -- BON-CUST-006  Chidi Okeke — medium risk; liveness flagged (poor image quality)
  INSERT INTO kyc_pipeline_results (
    institution_id, customer_id, run_at, overall_risk_score, knowledge_level,
    overall_status, action_taken,
    bvn_nin_status, bvn_nin_score, bvn_nin_detail,
    phone_status,   phone_score,   phone_detail,
    liveness_status, liveness_score, liveness_detail,
    pep_status,     pep_score,     pep_detail,
    duration_ms,    identity_photo_b64
  ) VALUES (
    inst_id, 'BON-CUST-006', now() - INTERVAL '5 days', 47, 't2',
    'flagged', 'flagged',
    'pass', 90, 'BVN and NIN match — identity confirmed',
    'pass', 86, 'Glo subscriber — linked to BVN record',
    'match', 51, 'Selfie quality low — partial biometric match only; manual review recommended',
    'pass', 93, 'No PEP or sanctions entries',
    2340, 'https://i.pravatar.cc/300?img=66'
  ) ON CONFLICT (institution_id, customer_id) DO NOTHING;

  -- BON-CUST-007  Babatunde Okonkwo — medium risk; PEP flag (domestic exposure)
  INSERT INTO kyc_pipeline_results (
    institution_id, customer_id, run_at, overall_risk_score, knowledge_level,
    overall_status, action_taken,
    bvn_nin_status, bvn_nin_score, bvn_nin_detail,
    phone_status,   phone_score,   phone_detail,
    liveness_status, liveness_score, liveness_detail,
    pep_status,     pep_score,     pep_detail,
    duration_ms,    identity_photo_b64
  ) VALUES (
    inst_id, 'BON-CUST-007', now() - INTERVAL '3 days', 55, 't3',
    'flagged', 'flagged',
    'pass', 92, 'BVN and NIN match — full identity confirmed',
    'pass', 88, 'MTN subscriber since 2012 — long-standing identity link',
    'pass', 89, 'Selfie biometric check passed — liveness confirmed',
    'match', 42, 'Domestic PEP — former Lagos State Government contractor (2019-2022); enhanced due diligence required',
    2780, 'https://i.pravatar.cc/300?img=33'
  ) ON CONFLICT (institution_id, customer_id) DO NOTHING;

  -- BON-CUST-008  Blessing Ogundipe — medium risk; verified with address discrepancy
  INSERT INTO kyc_pipeline_results (
    institution_id, customer_id, run_at, overall_risk_score, knowledge_level,
    overall_status, action_taken,
    bvn_nin_status, bvn_nin_score, bvn_nin_detail,
    phone_status,   phone_score,   phone_detail,
    liveness_status, liveness_score, liveness_detail,
    pep_status,     pep_score,     pep_detail,
    duration_ms,    identity_photo_b64
  ) VALUES (
    inst_id, 'BON-CUST-008', now() - INTERVAL '9 days', 41, 't2',
    'clear', 'clear',
    'pass', 88, 'BVN verified — NIN address differs from submitted address (customer relocated)',
    'pass', 85, 'Airtel subscriber — phone linked to BVN',
    'pass', 90, 'Liveness check passed — biometric match confirmed',
    'pass', 96, 'No PEP or sanctions entries',
    1890, 'https://i.pravatar.cc/300?img=20'
  ) ON CONFLICT (institution_id, customer_id) DO NOTHING;

  -- BON-CUST-009  Emeka Ejike — high-medium risk; NIN not found, BVN partial
  INSERT INTO kyc_pipeline_results (
    institution_id, customer_id, run_at, overall_risk_score, knowledge_level,
    overall_status, action_taken,
    bvn_nin_status, bvn_nin_score, bvn_nin_detail,
    phone_status,   phone_score,   phone_detail,
    liveness_status, liveness_score, liveness_detail,
    pep_status,     pep_score,     pep_detail,
    duration_ms,    identity_photo_b64
  ) VALUES (
    inst_id, 'BON-CUST-009', now() - INTERVAL '4 days', 63, 't1',
    'flagged', 'flagged',
    'not_found', 38, 'NIN not found in NIMC registry; BVN partial match — name mismatch on middle name',
    'pass', 72, 'MTN subscriber — phone linked to BVN record',
    'match', 48, 'Selfie biometric failed — face does not match BVN record photo; re-submission required',
    'pass', 91, 'No PEP or sanctions hits',
    3120, 'https://i.pravatar.cc/300?img=70'
  ) ON CONFLICT (institution_id, customer_id) DO NOTHING;

  -- BON-CUST-010  Ibrahim Musa — high risk; multiple check failures
  INSERT INTO kyc_pipeline_results (
    institution_id, customer_id, run_at, overall_risk_score, knowledge_level,
    overall_status, action_taken,
    bvn_nin_status, bvn_nin_score, bvn_nin_detail,
    phone_status,   phone_score,   phone_detail,
    liveness_status, liveness_score, liveness_detail,
    pep_status,     pep_score,     pep_detail,
    duration_ms,    identity_photo_b64
  ) VALUES (
    inst_id, 'BON-CUST-010', now() - INTERVAL '2 days', 76, 't1',
    'flagged', 'case_opened',
    'match', 31, 'BVN name does not match submitted name — possible alias; NIN lookup returned no record',
    'not_found', 45, 'Number registered to a different identity — SIM ownership mismatch detected',
    'match', 29, 'Biometric match failed — selfie does not correspond to BVN photo; liveness score below threshold',
    'not_found', 55, 'Subject name appears on CBN domestic watchlist — further investigation required',
    3890, 'https://i.pravatar.cc/300?img=58'
  ) ON CONFLICT (institution_id, customer_id) DO NOTHING;

  -- BON-CUST-011  Yusuf Dantata — highest risk; PEP + NIN mismatch
  INSERT INTO kyc_pipeline_results (
    institution_id, customer_id, run_at, overall_risk_score, knowledge_level,
    overall_status, action_taken,
    bvn_nin_status, bvn_nin_score, bvn_nin_detail,
    phone_status,   phone_score,   phone_detail,
    liveness_status, liveness_score, liveness_detail,
    pep_status,     pep_score,     pep_detail,
    duration_ms,    identity_photo_b64
  ) VALUES (
    inst_id, 'BON-CUST-011', now() - INTERVAL '1 day', 88, 't1',
    'flagged', 'case_opened',
    'match', 28, 'BVN name matches but NIN DOB and address strongly diverge — possible identity layering',
    'not_found', 40, 'Phone not linked to any registered national identity — number likely prepaid unregistered',
    'match', 22, 'Liveness check critical failure — photo spoofing indicator detected; biometric match 22%',
    'match', 18, 'High-risk PEP: international exposure — matches OFAC SDN list and EU financial sanctions list',
    4210, 'https://i.pravatar.cc/300?img=65'
  ) ON CONFLICT (institution_id, customer_id) DO NOTHING;

  -- BON-CUST-014  James Richardson — foreign (no BVN/NIN), passport verified
  INSERT INTO kyc_pipeline_results (
    institution_id, customer_id, run_at, overall_risk_score, knowledge_level,
    overall_status, action_taken,
    bvn_nin_status, bvn_nin_score, bvn_nin_detail,
    phone_status,   phone_score,   phone_detail,
    liveness_status, liveness_score, liveness_detail,
    pep_status,     pep_score,     pep_detail,
    duration_ms,    identity_photo_b64
  ) VALUES (
    inst_id, 'BON-CUST-014', now() - INTERVAL '6 days', 14, 't2',
    'clear', 'clear',
    'not_found', NULL, 'BVN/NIN not applicable — foreign national; UK passport verified via third-party document check',
    'pass', 82, 'UK roaming subscriber — phone linked to passport identity record',
    'pass', 90, 'Selfie biometric matched passport photo — liveness check passed',
    'pass', 96, 'No PEP entries or international sanctions hits',
    2010, 'https://i.pravatar.cc/300?img=12'
  ) ON CONFLICT (institution_id, customer_id) DO NOTHING;

  -- BON-CUST-015  Elena Marchetti — foreign (no BVN/NIN), passport verified
  INSERT INTO kyc_pipeline_results (
    institution_id, customer_id, run_at, overall_risk_score, knowledge_level,
    overall_status, action_taken,
    bvn_nin_status, bvn_nin_score, bvn_nin_detail,
    phone_status,   phone_score,   phone_detail,
    liveness_status, liveness_score, liveness_detail,
    pep_status,     pep_score,     pep_detail,
    duration_ms,    identity_photo_b64
  ) VALUES (
    inst_id, 'BON-CUST-015', now() - INTERVAL '11 days', 38, 't2',
    'clear', 'clear',
    'not_found', NULL, 'BVN/NIN not applicable — Italian national; passport and residency permit verified',
    'pass', 79, 'Subscriber identity verified via EU roaming data',
    'pass', 87, 'Selfie biometric matched Italian passport photo — liveness confirmed',
    'pass', 94, 'No PEP or EU/UN sanctions hits',
    1940, 'https://i.pravatar.cc/300?img=5'
  ) ON CONFLICT (institution_id, customer_id) DO NOTHING;

END $$;
