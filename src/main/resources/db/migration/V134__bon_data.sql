-- V134: Demo data for Bank of Nigeria.
-- Populates 15 customers, 43 transactions, 5 AML cases, 7 NFIU reports,
-- 2 CDD workflows with run history, 2 monitoring pipelines, and 4 alerts.
-- Depends on V133. No-op if institution is absent.

DO $$
DECLARE
  inst_id    BIGINT;
  admin_id   BIGINT;
  cco_id     BIGINT;
  analyst_id BIGINT;
  dev_id     BIGINT;
  wf1_id     BIGINT;
  wf2_id     BIGINT;
  run1_id    BIGINT;
  run2_id    BIGINT;
  run3_id    BIGINT;
  pipe1_id   BIGINT;
  pipe2_id   BIGINT;
BEGIN

  SELECT id INTO inst_id    FROM institutions WHERE name = 'Bank of Nigeria';
  SELECT id INTO admin_id   FROM users WHERE email = 'admin@bank-of-nigeria.com';
  SELECT id INTO cco_id     FROM users WHERE email = 'cco@bank-of-nigeria.com';
  SELECT id INTO analyst_id FROM users WHERE email = 'analyst@bank-of-nigeria.com';
  SELECT id INTO dev_id     FROM users WHERE email = 'developer@bank-of-nigeria.com';

  IF inst_id IS NULL THEN RETURN; END IF;

  -- ── Customers (15 total: 11 individuals Nigerian, 2 corporate, 2 foreign) ─
  -- photo column stores a public portrait URL for UI display.
  INSERT INTO customers (
    institution_id, external_id, name, email, phone,
    bvn, nin, account_number, subject_type, dob, address,
    photo,
    risk_score, risk_profile_score, transaction_risk_score, overall_risk_score
  ) VALUES
  -- Low-risk individuals ────────────────────────────────────────────────────
  (inst_id, 'BON-CUST-001', 'Ngozi Adebayo',
   'ngozi.adebayo@gmail.com',   '08031122334', '33211001122', '98011001122', '3301100001', 'individual', '1996-04-12',
   '14 Wuse Zone 6, Abuja',
   'https://i.pravatar.cc/300?img=44',
   15, 10, 20, 15),

  (inst_id, 'BON-CUST-002', 'Amaka Eze',
   'amaka.eze@yahoo.com',       '08054433221', '33222001133', '98022001133', '3302200002', 'individual', '1991-08-25',
   '7 Independence Layout, Enugu',
   'https://i.pravatar.cc/300?img=48',
   19, 14, 24, 19),

  (inst_id, 'BON-CUST-003', 'Halima Sule',
   'halima.sule@gmail.com',     '08077665544', '33233001144', '98033001144', '3303300003', 'individual', '2000-01-18',
   '22 Kawo GRA, Kaduna',
   'https://i.pravatar.cc/300?img=32',
   8,  5, 11,  8),

  (inst_id, 'BON-CUST-004', 'Chidinma Obi',
   'chidinma.obi@gmail.com',    '08099887766', '33244001155', '98044001155', '3304400004', 'individual', '1994-11-03',
   '9 Stadium Rd, Port Harcourt',
   'https://i.pravatar.cc/300?img=29',
   11,  8, 14, 11),

  (inst_id, 'BON-CUST-005', 'Kelechi Nwosu',
   'kelechi.nwosu@nwosu.ng',    '08021334455', '33255001166', '98055001166', '3305500005', 'individual', '1988-06-30',
   '31 Egbu Rd, Owerri',
   'https://i.pravatar.cc/300?img=57',
   24, 18, 30, 24),

  -- Medium-risk individuals ─────────────────────────────────────────────────
  (inst_id, 'BON-CUST-006', 'Chidi Okeke',
   'chidi.okeke@chidiokeke.ng', '08043556677', '33266001177', '98066001177', '3306600006', 'individual', '1986-02-14',
   '45 Oguta Rd, Onitsha',
   'https://i.pravatar.cc/300?img=66',
   47, 40, 55, 47),

  (inst_id, 'BON-CUST-007', 'Babatunde Okonkwo',
   'b.okonkwo@okonkwong.com',   '08065778899', '33277001188', '98077001188', '3307700007', 'individual', '1979-09-07',
   '88 Bode Thomas St, Surulere, Lagos',
   'https://i.pravatar.cc/300?img=33',
   55, 48, 63, 55),

  (inst_id, 'BON-CUST-008', 'Blessing Ogundipe',
   'b.ogundipe@gmail.com',      '08087990011', '33288001199', '98088001199', '3308800008', 'individual', '1983-05-19',
   '56 Mobolaji Bank Anthony Way, Ikeja, Lagos',
   'https://i.pravatar.cc/300?img=20',
   41, 35, 48, 41),

  -- Medium-to-high-risk individuals ─────────────────────────────────────────
  (inst_id, 'BON-CUST-009', 'Emeka Ejike',
   'emeka.ejike@ejike-ng.com',  '08019001122', '33299001200', '98099001200', '3309900009', 'individual', '1982-12-22',
   '17 Awka Rd, Onitsha',
   'https://i.pravatar.cc/300?img=70',
   63, 58, 70, 63),

  -- High-risk individuals ───────────────────────────────────────────────────
  (inst_id, 'BON-CUST-010', 'Ibrahim Musa',
   'ibrahim.musa@kanobiz.ng',   '08031223344', '33300112211', '98010112211', '3310001200', 'individual', '1970-07-04',
   '33 Ahmadu Bello Way, Kano',
   'https://i.pravatar.cc/300?img=58',
   76, 70, 83, 76),

  (inst_id, 'BON-CUST-011', 'Yusuf Dantata',
   'y.dantata@dantata-group.ng','08053334455', '33311223322', '98011223322', '3311002300', 'individual', '1965-03-28',
   '5 Kofar Wambai, Kano',
   'https://i.pravatar.cc/300?img=65',
   88, 82, 95, 88),

  -- Corporate entities ──────────────────────────────────────────────────────
  (inst_id, 'BON-CUST-012', 'Apex Minerals Nigeria Ltd',
   'compliance@apexminerals.ng','0112233445',  '88100001234', NULL, '2001001234', 'corporate', '2017-04-10',
   'Plot 7, Mining Crescent, Abuja FCT',
   NULL,
   91, 86, 96, 91),

  (inst_id, 'BON-CUST-013', 'Skyway Capital & Trust Ltd',
   'finance@skywaycapital.ng',  '0134455667',  '88200002345', NULL, '2002002345', 'corporate', '2014-11-01',
   '12th Floor, Plot 1684 Sanusi Fafunwa St, Victoria Island, Lagos',
   NULL,
   44, 38, 51, 44),

  -- Foreign customers (expat / investor) ────────────────────────────────────
  (inst_id, 'BON-CUST-014', 'James Richardson',
   'j.richardson@jrlaw.co.uk',  '07055678901', NULL, NULL, '3314567890', 'individual', '1977-10-11',
   'House 4, Banana Island, Lagos',
   'https://i.pravatar.cc/300?img=12',
   14, 10, 18, 14),

  (inst_id, 'BON-CUST-015', 'Elena Marchetti',
   'elena@marchetti-invest.it', '07099001122', NULL, NULL, '3315678901', 'individual', '1989-07-16',
   'Suite 5, Eko Atlantic, Victoria Island, Lagos',
   'https://i.pravatar.cc/300?img=5',
   38, 32, 45, 38);

  -- ── Transactions (43 total) ───────────────────────────────────────────────
  -- status        : payment outcome  → successful | pending | failed
  -- flagged_status: compliance state → flagged | blocked | cleared | review | NULL

  -- Ngozi Adebayo — clean history
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-001', inst_id, 'BON-CUST-001', 'Ngozi Adebayo',  45000.00, 'Mobile', 'MTN MoMo',    5, 'successful', NULL, NULL, 'Abuja',  9.0579,  7.4951, now() - INTERVAL '27 days', '3301100001', 'Bank of Nigeria', 'MTN Nigeria',               'MTN-08031122334', 'MTN MoMo',    'NGN', 'Airtime top-up',                                        'mob_ios_a1b2', '105.112.9.11'),
  ('BON-TXN-002', inst_id, 'BON-CUST-001', 'Ngozi Adebayo', 120000.00, 'NIP',    'GTBank',       7, 'successful', NULL, NULL, 'Abuja',  9.0579,  7.4951, now() - INTERVAL '14 days', '3301100001', 'Bank of Nigeria', 'Covenant University Nigeria', '0123456788',      'GTBank',      'NGN', 'School fees — 2026/2027 session',               'mob_ios_a1b2', '105.112.9.11');

  -- Amaka Eze — clean history
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-003', inst_id, 'BON-CUST-002', 'Amaka Eze',  30000.00, 'USSD', 'Enugu DISCO',   3, 'successful', NULL, NULL, 'Enugu',  6.4527,  7.5106, now() - INTERVAL '22 days', '3302200002', 'Bank of Nigeria', 'Enugu Electricity Distribution', 'EEDC-0088765', 'Enugu DISCO', 'NGN', 'Electricity bill — March 2026',                 'ussd_mob_b2c3', '196.2.145.30'),
  ('BON-TXN-004', inst_id, 'BON-CUST-002', 'Amaka Eze',  65000.00, 'NIP',  'First Bank',    6, 'successful', NULL, NULL, 'Enugu',  6.4527,  7.5106, now() - INTERVAL '9 days',  '3302200002', 'Bank of Nigeria', 'Eze Family Cooperative',         '0234567899',   'First Bank',  'NGN', 'Family contribution — April 2026',              'mob_and_b2c3',  '196.2.145.30');

  -- Halima Sule — clean history
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-005', inst_id, 'BON-CUST-003', 'Halima Sule',  25000.00, 'Mobile', 'Airtel',      4, 'successful', NULL, NULL, 'Kaduna', 10.5105, 7.4165, now() - INTERVAL '20 days', '3303300003', 'Bank of Nigeria', 'Airtel Nigeria',                 'AIRTEL-07076', 'Airtel',      'NGN', 'Monthly data subscription',                     'mob_ios_c3d4', '196.1.144.22'),
  ('BON-TXN-006', inst_id, 'BON-CUST-003', 'Halima Sule',  50000.00, 'NIP',    'UBA',         5, 'successful', NULL, NULL, 'Kaduna', 10.5105, 7.4165, now() - INTERVAL '6 days',  '3303300003', 'Bank of Nigeria', 'Sule Ahmed Stores',              '0345678902',  'UBA',         'NGN', 'Goods payment — April 2026',                    'mob_ios_c3d4', '196.1.144.22');

  -- Chidinma Obi — clean history
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-007', inst_id, 'BON-CUST-004', 'Chidinma Obi',  80000.00, 'POS',  'PoS Terminal', 5, 'successful', NULL, NULL, 'Port Harcourt', 4.8156, 7.0498, now() - INTERVAL '18 days', '3304400004', 'Bank of Nigeria', 'Polo Luxury Mall PH',    'TERM-00561234', 'PoS Terminal', 'NGN', 'PoS purchase — Polo Mall',                      'pos_terminal_002', '41.58.12.66'),
  ('BON-TXN-008', inst_id, 'BON-CUST-004', 'Chidinma Obi', 150000.00, 'NIP',  'Zenith Bank',  7, 'successful', NULL, NULL, 'Port Harcourt', 4.8156, 7.0498, now() - INTERVAL '5 days',  '3304400004', 'Bank of Nigeria', 'Obi Textile Supplies',  '0456789013',    'Zenith Bank',  'NGN', 'Goods payment — fabric supplies',               'mob_and_d4e5',     '105.113.92.20');

  -- Kelechi Nwosu — clean history
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-009', inst_id, 'BON-CUST-005', 'Kelechi Nwosu', 200000.00, 'NIP',    'First Bank', 10, 'successful', NULL, NULL, 'Owerri', 5.4836, 7.0345, now() - INTERVAL '24 days', '3305500005', 'Bank of Nigeria', 'Nwosu Electrical Supplies', '0567890124', 'First Bank',  'NGN', 'Business payment — electricals Q1',             'web_chrome_e5f6', '197.211.64.80'),
  ('BON-TXN-010', inst_id, 'BON-CUST-005', 'Kelechi Nwosu',  35000.00, 'Mobile', 'MTN MoMo',   4, 'successful', NULL, NULL, 'Owerri', 5.4836, 7.0345, now() - INTERVAL '11 days', '3305500005', 'Bank of Nigeria', 'EEDC Owerri',               'EEDC-00991234', 'EEDC',        'NGN', 'Electricity prepaid recharge',                  'mob_ios_e5f6',    '197.211.64.80');

  -- Chidi Okeke — medium risk, structuring pattern
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-011', inst_id, 'BON-CUST-006', 'Chidi Okeke', 350000.00, 'NIP',    'GTBank',       32, 'successful', NULL,     NULL,          'Onitsha', 6.1522, 6.7878, now() - INTERVAL '28 days', '3306600006', 'Bank of Nigeria', 'Okeke Trading Ltd',         '0678901235', 'GTBank',        'NGN', 'Business supplies payment',                     'mob_ios_f6g7',    '197.210.65.12'),
  ('BON-TXN-012', inst_id, 'BON-CUST-006', 'Chidi Okeke', 490000.00, 'NIP',    'Access Bank',  48, 'successful', 'review', 'structuring', 'Onitsha', 6.1522, 6.7878, now() - INTERVAL '20 days', '3306600006', 'Bank of Nigeria', 'Beneficiary Alpha Ltd',     '9001234567', 'Unknown Bank',  'NGN', 'Business settlement A',                         'mob_ios_g7h8',    '105.184.73.30'),
  ('BON-TXN-013', inst_id, 'BON-CUST-006', 'Chidi Okeke', 488000.00, 'NIP',    'Polaris Bank', 50, 'successful', 'review', 'structuring', 'Onitsha', 6.1522, 6.7878, now() - INTERVAL '20 days', '3306600006', 'Bank of Nigeria', 'Beneficiary Beta Ltd',      '8901234566', 'Unknown Bank',  'NGN', 'Business settlement B',                         'mob_ios_g7h8',    '105.184.73.30'),
  ('BON-TXN-014', inst_id, 'BON-CUST-006', 'Chidi Okeke', 285000.00, 'NIP',    'First Bank',   40, 'successful', NULL,     NULL,          'Onitsha', 6.1522, 6.7878, now() - INTERVAL '3 days',  '3306600006', 'Bank of Nigeria', 'Lagos Business Hub',        '0890123457',  'First Bank',    'NGN', 'Office rent payment — Q2',                      'mob_ios_h8i9',    '197.210.65.12');

  -- Babatunde Okonkwo — medium risk, amount threshold trigger
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-015', inst_id, 'BON-CUST-007', 'Babatunde Okonkwo',  800000.00, 'NIP', 'Stanbic IBTC', 42, 'successful', NULL,     NULL,               'Lagos', 6.4281, 3.4219, now() - INTERVAL '25 days', '3307700007', 'Bank of Nigeria', 'Okonkwo Properties Ltd',     '0789012346', 'Stanbic IBTC', 'NGN', 'Property management fees — Q1',                 'web_chrome_i9j0', '197.210.64.78'),
  ('BON-TXN-016', inst_id, 'BON-CUST-007', 'Babatunde Okonkwo', 1200000.00, 'NIP', 'GTBank',       58, 'successful', 'flagged','amount_threshold',  'Lagos', 6.4281, 3.4219, now() - INTERVAL '15 days', '3307700007', 'Bank of Nigeria', 'Intercontinental Logistics', '0890123458', 'GTBank',       'NGN', 'Logistics contract advance',                     'web_chrome_j0k1', '197.210.64.78'),
  ('BON-TXN-017', inst_id, 'BON-CUST-007', 'Babatunde Okonkwo',  450000.00, 'NIP', 'UBA',          38, 'successful', NULL,     NULL,               'Lagos', 6.4281, 3.4219, now() - INTERVAL '4 days',  '3307700007', 'Bank of Nigeria', 'Surelec Nigeria Ltd',        '0901234569', 'UBA',          'NGN', 'Equipment procurement',                          'web_chrome_k1l2', '197.210.64.78');

  -- Blessing Ogundipe — medium risk
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-018', inst_id, 'BON-CUST-008', 'Blessing Ogundipe', 250000.00, 'NIP',  'Access Bank', 28, 'successful', NULL,     NULL,               'Lagos', 6.4281, 3.4219, now() - INTERVAL '22 days', '3308800008', 'Bank of Nigeria', 'Ogundipe Fashion Ltd',   '1012345679', 'Access Bank', 'NGN', 'Fashion stock procurement',                     'mob_ios_l2m3', '197.210.64.90'),
  ('BON-TXN-019', inst_id, 'BON-CUST-008', 'Blessing Ogundipe', 480000.00, 'NIP',  'GTBank',      42, 'successful', 'review', 'amount_threshold', 'Lagos', 6.4281, 3.4219, now() - INTERVAL '8 days',  '3308800008', 'Bank of Nigeria', 'Fashion Week Nigeria',    '1123456780', 'GTBank',      'NGN', 'Event sponsorship payment',                     'mob_ios_m3n4', '197.210.64.90');

  -- Emeka Ejike — medium-high risk, offshore + BDC
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-020', inst_id, 'BON-CUST-009', 'Emeka Ejike', 2500000.00, 'NIP',  'GTBank',       60, 'successful', 'flagged', 'international_wire', 'Onitsha', 6.1522, 6.7878, now() - INTERVAL '26 days', '3309900009', 'Bank of Nigeria', 'Ejike Offshore Holdings', 'INTL-00334455', 'Citibank N.A.',     'USD', 'Capital transfer — offshore portfolio Q1',      'web_chrome_n4o5', '198.71.233.20'),
  ('BON-TXN-021', inst_id, 'BON-CUST-009', 'Emeka Ejike', 1800000.00, 'NIP',  'Sterling',     55, 'successful', 'flagged', 'bdc_transfer',       'Lagos',   6.4281, 3.4219, now() - INTERVAL '16 days', '3309900009', 'Bank of Nigeria', 'Rapid FX Bureau Ltd',     '0234567893',    'Sterling Bank',     'NGN', 'FX purchase — USD settlement',                   'web_chrome_o5p6', '197.210.64.91'),
  ('BON-TXN-022', inst_id, 'BON-CUST-009', 'Emeka Ejike',  490000.00, 'NIP',  'Zenith Bank',  52, 'pending',    'review',  'bdc_transfer',       'Lagos',   6.4281, 3.4219, now() - INTERVAL '2 days',  '3309900009', 'Bank of Nigeria', 'Head Bridge BDC Ltd',     '0345678904',    'GTBank',            'NGN', 'FX settlement — EUR purchase',                   'mob_and_p6q7',    '197.210.64.91');

  -- James Richardson — clean expat
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-023', inst_id, 'BON-CUST-014', 'James Richardson', 580000.00, 'NIP',    'First Bank', 11, 'successful', NULL, NULL, 'Lagos', 6.4281, 3.4219, now() - INTERVAL '19 days', '3314567890', 'Bank of Nigeria', 'Banana Island Estate Mgmt', '0456789015',   'First Bank',  'NGN', 'Monthly housing levy — Banana Island',          'mob_ios_q7r8', '197.211.64.81'),
  ('BON-TXN-024', inst_id, 'BON-CUST-014', 'James Richardson',  95000.00, 'Mobile', 'GTBank',      9, 'successful', NULL, NULL, 'Lagos', 6.4281, 3.4219, now() - INTERVAL '7 days',  '3314567890', 'Bank of Nigeria', 'Lagos Supermart VI',        '0567890126',   'GTBank',      'NGN', 'Groceries and household goods',                 'mob_ios_q7r8', '197.211.64.81');

  -- Elena Marchetti — medium risk, flagged international transfer
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-025', inst_id, 'BON-CUST-015', 'Elena Marchetti', 3200000.00, 'NIP', 'Citibank',     36, 'successful', 'flagged', 'international_wire', 'Lagos', 6.4281, 3.4219, now() - INTERVAL '21 days', '3315678901', 'Bank of Nigeria', 'Marchetti Investimenti Srl', 'INTL-00556677', 'Banca Intesa', 'EUR', 'Investment repatriation — Italy portfolio Q1',  'web_chrome_r8s9', '85.12.44.201'),
  ('BON-TXN-026', inst_id, 'BON-CUST-015', 'Elena Marchetti',  750000.00, 'NIP', 'UBA',          22, 'successful', NULL,      NULL,                 'Lagos', 6.4281, 3.4219, now() - INTERVAL '10 days', '3315678901', 'Bank of Nigeria', 'Eko Atlantic Dev Corp',      '0678901237',    'UBA',          'NGN', 'Property co-investment payment',                'web_chrome_s9t0', '85.12.44.201');

  -- Skyway Capital — corporate, normal operations
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-027', inst_id, 'BON-CUST-013', 'Skyway Capital & Trust Ltd', 5400000.00, 'NIP', 'Zenith Bank',  32, 'successful', NULL, NULL, 'Lagos', 6.4281, 3.4219, now() - INTERVAL '23 days', '2002002345', 'Bank of Nigeria', 'Lagos Land Registry LASG',  '0789012348', 'Zenith Bank',  'NGN', 'Land title processing fees — Phase 3 Lekki',   'web_chrome_t0u1', '41.78.102.60'),
  ('BON-TXN-028', inst_id, 'BON-CUST-013', 'Skyway Capital & Trust Ltd', 2800000.00, 'NIP', 'First Bank',   26, 'successful', NULL, NULL, 'Lagos', 6.4281, 3.4219, now() - INTERVAL '13 days', '2002002345', 'Bank of Nigeria', 'Julius Berger Nigeria Plc', '0890123460', 'First Bank',   'NGN', 'Construction advance — Lekki Phase 3A',         'web_chrome_u1v2', '41.78.102.60'),
  ('BON-TXN-029', inst_id, 'BON-CUST-013', 'Skyway Capital & Trust Ltd', 1600000.00, 'NIP', 'UBA',          24, 'successful', NULL, NULL, 'Lagos', 6.4281, 3.4219, now() - INTERVAL '2 days',  '2002002345', 'Bank of Nigeria', 'Dangote Cement Plc',        '0901234571', 'UBA',          'NGN', 'Building materials — Site C procurement',       'web_chrome_v2w3', '41.78.102.60');

  -- Ibrahim Musa — HIGH RISK: structuring + blocked offshore
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-030', inst_id, 'BON-CUST-010', 'Ibrahim Musa', 490000.00, 'NIP', 'Keystone Bank', 70, 'successful', 'flagged', 'structuring',          'Kano', 12.0022, 8.5920, now() - INTERVAL '29 days', '3310001200', 'Bank of Nigeria', 'Musa Holdings Alpha',        '9112233441', 'Unknown Bank',  'NGN', 'Business proceeds — tranche A',                 'web_chrome_w3x4', '196.1.145.80'),
  ('BON-TXN-031', inst_id, 'BON-CUST-010', 'Ibrahim Musa', 487000.00, 'NIP', 'Polaris Bank',  72, 'successful', 'flagged', 'structuring',          'Kano', 12.0022, 8.5920, now() - INTERVAL '29 days', '3310001200', 'Bank of Nigeria', 'Musa Holdings Beta',         '8223344552', 'Unknown Bank',  'NGN', 'Business proceeds — tranche B',                 'web_chrome_w3x4', '196.1.145.80'),
  ('BON-TXN-032', inst_id, 'BON-CUST-010', 'Ibrahim Musa', 493000.00, 'NIP', 'Access Bank',   71, 'successful', 'flagged', 'structuring',          'Kano', 12.0022, 8.5920, now() - INTERVAL '29 days', '3310001200', 'Bank of Nigeria', 'Musa Holdings Gamma',        '7334455663', 'Unknown Bank',  'NGN', 'Business proceeds — tranche C',                 'web_chrome_w3x4', '196.1.145.80'),
  ('BON-TXN-033', inst_id, 'BON-CUST-010', 'Ibrahim Musa',4200000.00, 'NIP', 'First Bank',    83, 'failed',     'blocked', 'high_risk_destination','Kano', 12.0022, 8.5920, now() - INTERVAL '11 days', '3310001200', 'Bank of Nigeria', 'Anonymous Offshore Entity',  'INTL-00887766','BVI Offshore',  'USD', 'Offshore transfer — no stated purpose',         'web_chrome_x4y5', '198.51.100.22');

  -- Yusuf Dantata — CRITICAL RISK: round-trip + structuring + blocked wires
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-034', inst_id, 'BON-CUST-011', 'Yusuf Dantata',  8500000.00, 'NIP', 'GTBank',       82, 'successful', 'flagged', 'international_wire',  'Kano',  12.0022, 8.5920, now() - INTERVAL '28 days', '3311002300', 'Bank of Nigeria', 'Dantata Offshore Ltd',        'INTL-00998877', 'Cayman National', 'USD', 'Offshore portfolio transfer Q1',                'web_chrome_y5z6', '198.71.233.30'),
  ('BON-TXN-035', inst_id, 'BON-CUST-011', 'Yusuf Dantata',  8300000.00, 'NIP', 'Zenith Bank',  87, 'successful', 'flagged', 'round_trip',          'Kano',  12.0022, 8.5920, now() - INTERVAL '26 days', '3311002300', 'Bank of Nigeria', 'Dantata Capital Nigeria',     '3311002300',    'Bank of Nigeria', 'NGN', 'Portfolio repatriation — Q1 return',            'web_chrome_z6a7', '105.112.9.80'),
  ('BON-TXN-036', inst_id, 'BON-CUST-011', 'Yusuf Dantata',   490000.00, 'NIP', 'UBA',          79, 'successful', 'review',  'structuring',         'Lagos', 6.4281,  3.4219, now() - INTERVAL '18 days', '3311002300', 'Bank of Nigeria', 'Kano Trading Ltd A',          '9223344553', 'Unknown Bank',    'NGN', 'Trade settlement tranche 1',                    'mob_and_a7b8',    '105.112.9.80'),
  ('BON-TXN-037', inst_id, 'BON-CUST-011', 'Yusuf Dantata',   485000.00, 'NIP', 'Sterling',     76, 'successful', 'review',  'structuring',         'Lagos', 6.4281,  3.4219, now() - INTERVAL '18 days', '3311002300', 'Bank of Nigeria', 'Kano Trading Ltd B',          '8334455664', 'Unknown Bank',    'NGN', 'Trade settlement tranche 2',                    'mob_and_a7b8',    '105.112.9.80'),
  ('BON-TXN-038', inst_id, 'BON-CUST-011', 'Yusuf Dantata',  6200000.00, 'NIP', 'First Bank',   92, 'failed',     'blocked', 'high_risk_destination','Abuja', 9.0579,  7.4951, now() - INTERVAL '5 days',  '3311002300', 'Bank of Nigeria', 'Unknown Shell Vehicle',       'INTL-00776655', 'Unknown',         'USD', 'Wire transfer — no stated purpose',             'web_chrome_b8c9', '198.51.100.33');

  -- Apex Minerals Nigeria Ltd — CRITICAL RISK: round-trip + structuring + blocked mega-wire
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('BON-TXN-039', inst_id, 'BON-CUST-012', 'Apex Minerals Nigeria Ltd', 12000000.00, 'NIP', 'GTBank',       88, 'successful', 'flagged', 'international_wire',  'Abuja', 9.0579, 7.4951, now() - INTERVAL '27 days', '2001001234', 'Bank of Nigeria', 'Apex Global Resources Ltd',    'INTL-00665544', 'Cayman National', 'USD', 'Mining proceeds — offshore escrow Q1',          'web_chrome_c9d0', '198.71.233.40'),
  ('BON-TXN-040', inst_id, 'BON-CUST-012', 'Apex Minerals Nigeria Ltd', 11800000.00, 'NIP', 'Zenith Bank',  92, 'successful', 'flagged', 'round_trip',          'Abuja', 9.0579, 7.4951, now() - INTERVAL '25 days', '2001001234', 'Bank of Nigeria', 'Apex Minerals Nigeria Ltd',    '2001001234',    'Bank of Nigeria', 'NGN', 'Escrow repatriation — Q1 proceeds',             'web_chrome_d0e1', '105.112.9.90'),
  ('BON-TXN-041', inst_id, 'BON-CUST-012', 'Apex Minerals Nigeria Ltd',    490000.00, 'NIP', 'Access Bank',  85, 'successful', 'flagged', 'structuring',         'Abuja', 9.0579, 7.4951, now() - INTERVAL '21 days', '2001001234', 'Bank of Nigeria', 'Mining Ventures Alpha Ltd',    '8445566775', 'Unknown Bank',    'NGN', 'Sub-threshold disbursement A',                  'web_chrome_e1f2', '105.112.9.90'),
  ('BON-TXN-042', inst_id, 'BON-CUST-012', 'Apex Minerals Nigeria Ltd',    488000.00, 'NIP', 'Polaris Bank', 87, 'successful', 'flagged', 'structuring',         'Abuja', 9.0579, 7.4951, now() - INTERVAL '21 days', '2001001234', 'Bank of Nigeria', 'Mining Ventures Beta Ltd',     '7556677886', 'Unknown Bank',    'NGN', 'Sub-threshold disbursement B',                  'web_chrome_f2g3', '105.112.9.90'),
  ('BON-TXN-043', inst_id, 'BON-CUST-012', 'Apex Minerals Nigeria Ltd', 18000000.00, 'NIP', 'First Bank',   95, 'failed',     'blocked', 'high_risk_destination','Lagos', 6.4281, 3.4219, now() - INTERVAL '3 days',  '2001001234', 'Bank of Nigeria', 'Unknown Destination Corp',     'INTL-00554433', 'Unnamed Offshore', 'USD', 'Capital transfer — unspecified purpose',        'web_chrome_g3h4', '198.71.233.99');

  -- ── Cases ─────────────────────────────────────────────────────────────────
  INSERT INTO cases (
    id, institution_id, customer_id, customer_name,
    title, typology, status, priority, risk_score,
    assigned_to, created_by, sla_deadline, brief, notes, created_at
  ) VALUES
  (
    'CASE-BON-001', inst_id, 'BON-CUST-011', 'Yusuf Dantata',
    'Round-Trip Capital Flow — Yusuf Dantata',
    'Round-Trip Transactions', 'investigating', 'critical', 90,
    analyst_id, admin_id,
    now() + INTERVAL '2 days',
    '₦8.5M offshore wire followed within 48 hours by ₦8.3M inbound repatriation. Classic round-trip pattern with two subsequent structuring transactions.',
    'Account executed a ₦8.5M USD offshore wire to a Cayman entity (Dantata Offshore Ltd) followed within 48 hours by a near-equivalent ₦8.3M repatriation from the same entity. Two sub-₦500k split transactions detected within 24 hours of the repatriation. Pattern is consistent with round-trip laundering to create the appearance of legitimate inbound funds. Escalation to NFIU under active review by CCO.',
    now() - INTERVAL '20 days'
  ),
  (
    'CASE-BON-002', inst_id, 'BON-CUST-010', 'Ibrahim Musa',
    'Structuring Pattern & Blocked Offshore Wire — Ibrahim Musa',
    'Structuring', 'escalated', 'critical', 83,
    analyst_id, admin_id,
    now() + INTERVAL '1 day',
    'Three transactions totalling ₦1.47M split across three beneficiaries in a 90-minute window, each below the ₦500k threshold. Followed by a blocked ₦4.2M BVI offshore wire.',
    'Customer executed three concurrent NIP transfers totalling ₦1,470,000 within a 90-minute window on the same device — each deliberately structured below the ₦500,000 automatic reporting threshold. The pattern is a textbook structuring typology. A subsequent ₦4.2M wire to an unnamed BVI entity was automatically blocked (risk score: 83). Account placed under enhanced monitoring. CCO to determine STR necessity.',
    now() - INTERVAL '11 days'
  ),
  (
    'CASE-BON-003', inst_id, 'BON-CUST-012', 'Apex Minerals Nigeria Ltd',
    'Round-Trip + Blocked ₦18M Wire — Apex Minerals Nigeria Ltd',
    'Suspicious Wire Transfer', 'escalated', 'critical', 95,
    analyst_id, admin_id,
    now() - INTERVAL '1 day',
    '₦12M offshore wire followed by ₦11.8M repatriation within 48h, plus two sub-threshold disbursements and a ₦18M blocked wire. SAR filing imminent.',
    '₦12M wire to offshore escrow account (Cayman) was followed within 48 hours by a ₦11.8M repatriation to the same account — a near-perfect round-trip. Within 96 hours, two sub-₦500k structured disbursements were executed across unknown beneficiaries. A subsequent ₦18M wire to an unnamed offshore bank was blocked by the risk engine (score: 95). This is the largest single-transaction block recorded for this institution. SAR filing is imminent pending CCO sign-off. Recommend account suspension pending investigation.',
    now() - INTERVAL '3 days'
  ),
  (
    'CASE-BON-004', inst_id, 'BON-CUST-009', 'Emeka Ejike',
    'BDC Velocity & Offshore Transfer — Emeka Ejike',
    'Suspicious Wire Transfer', 'open', 'high', 63,
    NULL, admin_id,
    now() + INTERVAL '6 days',
    '₦2.5M offshore wire with no prior international wire history, plus ₦1.8M BDC transfer and a pending ₦490k FX settlement.',
    '₦2,500,000 wire transfer to an offshore entity (Ejike Offshore Holdings) with no prior international wire history for this customer. ₦1,800,000 BDC transaction to Rapid FX Bureau Ltd flagged for FX review. A third ₦490,000 BDC settlement is currently pending and under review. Customer to be contacted for purpose-of-payment documentation. Analyst assignment pending.',
    now() - INTERVAL '14 days'
  ),
  (
    'CASE-BON-005', inst_id, 'BON-CUST-007', 'Babatunde Okonkwo',
    'Flagged Large Transfer — Babatunde Okonkwo',
    'Unusual Transaction', 'open', 'high', 58,
    NULL, admin_id,
    now() + INTERVAL '8 days',
    '₦1.2M NIP transfer triggered the amount threshold rule. Account has no prior large-value transfer history.',
    '₦1,200,000 NIP transfer to Intercontinental Logistics automatically flagged by the transaction monitoring pipeline (amount threshold: ₦1,000,000). Customer has no prior transaction above ₦1M. Transfer narration cites a logistics contract advance but no supporting documentation has been submitted. Monitoring pipeline rule: CBN 2026 Threshold Rules. Assign for analyst review.',
    now() - INTERVAL '7 days'
  );

  -- ── Link transactions to cases ─────────────────────────────────────────────
  INSERT INTO case_transactions (case_id, transaction_id) VALUES
  ('CASE-BON-001', 'BON-TXN-034'),
  ('CASE-BON-001', 'BON-TXN-035'),
  ('CASE-BON-001', 'BON-TXN-036'),
  ('CASE-BON-001', 'BON-TXN-037'),
  ('CASE-BON-001', 'BON-TXN-038'),
  ('CASE-BON-002', 'BON-TXN-030'),
  ('CASE-BON-002', 'BON-TXN-031'),
  ('CASE-BON-002', 'BON-TXN-032'),
  ('CASE-BON-002', 'BON-TXN-033'),
  ('CASE-BON-003', 'BON-TXN-039'),
  ('CASE-BON-003', 'BON-TXN-040'),
  ('CASE-BON-003', 'BON-TXN-041'),
  ('CASE-BON-003', 'BON-TXN-042'),
  ('CASE-BON-003', 'BON-TXN-043'),
  ('CASE-BON-004', 'BON-TXN-020'),
  ('CASE-BON-004', 'BON-TXN-021'),
  ('CASE-BON-004', 'BON-TXN-022'),
  ('CASE-BON-005', 'BON-TXN-016');

  -- ── Case activity log ─────────────────────────────────────────────────────
  INSERT INTO case_activity (case_id, actor_id, action, detail, created_at) VALUES
  ('CASE-BON-001', admin_id,   'opened',         'Case opened — round-trip pattern detected by risk engine.',                                              now() - INTERVAL '20 days'),
  ('CASE-BON-001', admin_id,   'assigned',       'Case assigned to BON Analyst for initial review.',                                                       now() - INTERVAL '20 days'),
  ('CASE-BON-001', analyst_id, 'transaction_linked', 'Linked BON-TXN-034 (₦8.5M offshore wire) and BON-TXN-035 (₦8.3M repatriation).',                   now() - INTERVAL '19 days'),
  ('CASE-BON-001', analyst_id, 'note_added',     'Round-trip confirmed. Two structuring transactions (BON-TXN-036, BON-TXN-037) added to the case.',      now() - INTERVAL '18 days'),
  ('CASE-BON-001', analyst_id, 'status_changed', 'Status changed: open → investigating. Customer contacted for source-of-funds documentation.',            now() - INTERVAL '17 days'),
  ('CASE-BON-002', admin_id,   'opened',         'Case opened — structuring pattern + blocked offshore wire detected.',                                    now() - INTERVAL '11 days'),
  ('CASE-BON-002', admin_id,   'assigned',       'Case assigned to BON Analyst. Escalation criteria met.',                                                 now() - INTERVAL '11 days'),
  ('CASE-BON-002', analyst_id, 'status_changed', 'Status changed: open → escalated. Three structuring transactions confirmed within 90-minute window.',    now() - INTERVAL '9 days'),
  ('CASE-BON-002', cco_id,     'note_added',     'CCO review initiated. STR filing consideration in progress. Account placed on enhanced monitoring.',     now() - INTERVAL '7 days'),
  ('CASE-BON-003', admin_id,   'opened',         'Case opened — ₦12M offshore wire detected. Round-trip suspected.',                                      now() - INTERVAL '3 days'),
  ('CASE-BON-003', admin_id,   'assigned',       'Case assigned to BON Analyst. Priority set to CRITICAL.',                                                now() - INTERVAL '3 days'),
  ('CASE-BON-003', analyst_id, 'status_changed', 'Status changed: open → escalated. ₦18M wire blocked. SAR filing imminent.',                             now() - INTERVAL '2 days'),
  ('CASE-BON-004', admin_id,   'opened',         'Case opened — offshore wire and BDC velocity alert triggered.',                                          now() - INTERVAL '14 days'),
  ('CASE-BON-005', admin_id,   'opened',         'Case opened — ₦1.2M transfer triggered CBN 2026 threshold monitoring rule.',                            now() - INTERVAL '7 days');

  -- ── NFIU Reports ──────────────────────────────────────────────────────────
  -- STR-202504-BON-001: Ibrahim Musa structuring — filed and acknowledged
  INSERT INTO nfiu_reports (
    institution_id, report_type, reference, title,
    period_start, period_end, status, priority,
    subject_name, subject_account, subject_bvn, subject_type,
    amount_ngn, transaction_count, narrative,
    filed_by_user_id, filed_by_name,
    officer_user_id, officer_name,
    subject_dob, subject_address, transaction_type, transaction_date,
    linked_transaction_id, transaction_currency, transaction_narration,
    created_at, updated_at
  ) VALUES (
    inst_id, 'STR', 'STR-202504-BON-001',
    'Suspicious Transaction Report — Ibrahim Musa (Structuring Pattern)',
    '2026-04-28', '2026-04-28', 'acknowledged', 'high',
    'Ibrahim Musa', '3310001200', '33300112211', 'individual',
    1470000.00, 3,
    'Three NIP transfers totalling ₦1,470,000 were executed by Ibrahim Musa within a 90-minute window on 2026-04-28, each structured below the ₦500,000 automatic reporting threshold (₦490k, ₦487k, ₦493k). All three transfers were directed to previously unknown beneficiaries. The pattern is consistent with deliberate structuring to avoid detection. Account risk score elevated to 76 following detection. Case CASE-BON-002 opened. NFIU acknowledgement received.',
    analyst_id, 'BON Analyst',
    cco_id, 'BON Compliance Officer',
    '1970-07-04', '33 Ahmadu Bello Way, Kano', 'NIP Transfer', '2026-04-28',
    'BON-TXN-030', 'NGN', 'Business proceeds — tranche A',
    now() - INTERVAL '11 days', now() - INTERVAL '8 days'
  );

  -- STR-202505-BON-001: Yusuf Dantata round-trip — filed
  INSERT INTO nfiu_reports (
    institution_id, report_type, reference, title,
    period_start, period_end, status, priority,
    subject_name, subject_account, subject_bvn, subject_type,
    amount_ngn, transaction_count, narrative,
    filed_by_user_id, filed_by_name,
    officer_user_id, officer_name,
    subject_dob, subject_address, transaction_type, transaction_date,
    linked_transaction_id, transaction_currency, transaction_narration,
    created_at, updated_at
  ) VALUES (
    inst_id, 'STR', 'STR-202505-BON-001',
    'Suspicious Transaction Report — Yusuf Dantata (Round-Trip)',
    '2026-05-01', '2026-05-03', 'filed', 'high',
    'Yusuf Dantata', '3311002300', '33311223322', 'individual',
    16800000.00, 4,
    '₦8,500,000 wire to Dantata Offshore Ltd (Cayman) on 2026-05-01 was followed within 48 hours by an ₦8,300,000 repatriation to the same account. Two sub-₦500k structuring transactions were detected within 24 hours. Total movement ₦16.8M over 3 days. Round-trip pattern confirmed by compliance team. Customer has no documented legitimate offshore business. Filed with NFIU per CBN AML/CFT Regulation 2023 §13.2.',
    analyst_id, 'BON Analyst',
    cco_id, 'BON Compliance Officer',
    '1965-03-28', '5 Kofar Wambai, Kano', 'NIP International Wire', '2026-05-01',
    'BON-TXN-034', 'USD', 'Offshore portfolio transfer Q1',
    now() - INTERVAL '20 days', now() - INTERVAL '17 days'
  );

  -- SAR-202505-BON-001: Ibrahim Musa blocked wire — filed
  INSERT INTO nfiu_reports (
    institution_id, report_type, reference, title,
    period_start, period_end, status, priority,
    subject_name, subject_account, subject_bvn, subject_type,
    amount_ngn, transaction_count, narrative,
    filed_by_user_id, filed_by_name,
    officer_user_id, officer_name,
    subject_dob, subject_address, transaction_type, transaction_date,
    linked_transaction_id, transaction_currency, transaction_narration,
    created_at, updated_at
  ) VALUES (
    inst_id, 'SAR', 'SAR-202505-BON-001',
    'Suspicious Activity Report — Ibrahim Musa (Blocked BVI Wire)',
    '2026-05-09', '2026-05-09', 'filed', 'high',
    'Ibrahim Musa', '3310001200', '33300112211', 'individual',
    4200000.00, 1,
    '₦4,200,000 NIP wire transfer to an anonymous BVI offshore entity was automatically blocked by Bank of Nigeria risk engine on 2026-05-09 (risk score: 83). Transfer followed three structuring transactions within 11 days (see STR-202504-BON-001). Customer offered no satisfactory explanation for the BVI destination. Destination account could not be verified. Account placed under enhanced monitoring. SAR filed per NFIU Directive 2024.',
    analyst_id, 'BON Analyst',
    cco_id, 'BON Compliance Officer',
    '1970-07-04', '33 Ahmadu Bello Way, Kano', 'NIP International Wire', '2026-05-09',
    'BON-TXN-033', 'USD', 'Offshore transfer — no stated purpose',
    now() - INTERVAL '11 days', now() - INTERVAL '9 days'
  );

  -- CTR-202504-BON-001: Apex Minerals ₦12M wire — acknowledged
  INSERT INTO nfiu_reports (
    institution_id, report_type, reference, title,
    period_start, period_end, status, priority,
    subject_name, subject_account, subject_bvn, subject_type,
    amount_ngn, transaction_count, narrative,
    filed_by_user_id, filed_by_name,
    officer_user_id, officer_name,
    subject_dob, subject_address, transaction_type, transaction_date,
    linked_transaction_id, transaction_currency, transaction_narration,
    created_at, updated_at
  ) VALUES (
    inst_id, 'CTR', 'CTR-202504-BON-001',
    'Currency Transaction Report — Apex Minerals Nigeria Ltd (₦12M Wire)',
    '2026-05-01', '2026-05-01', 'acknowledged', 'high',
    'Apex Minerals Nigeria Ltd', '2001001234', '88100001234', 'corporate',
    12000000.00, 1,
    '₦12,000,000 international NIP wire by Apex Minerals Nigeria Ltd to Apex Global Resources Ltd (Cayman) on 2026-05-01. Flagged per CBN AML Regulation automatic CTR threshold. Transaction linked to an ongoing round-trip investigation (CASE-BON-003). NFIU acknowledged.',
    analyst_id, 'BON Analyst',
    cco_id, 'BON Compliance Officer',
    '2017-04-10', 'Plot 7, Mining Crescent, Abuja FCT', 'NIP International Wire', '2026-05-01',
    'BON-TXN-039', 'USD', 'Mining proceeds — offshore escrow Q1',
    now() - INTERVAL '27 days', now() - INTERVAL '22 days'
  );

  -- AML_RETURN-202604-BON-001: April 2026 monthly return — acknowledged
  INSERT INTO nfiu_reports (
    institution_id, report_type, reference, title,
    period_start, period_end, status, priority,
    subject_name, subject_account, subject_bvn, subject_type,
    amount_ngn, transaction_count, narrative,
    filed_by_user_id, filed_by_name,
    officer_user_id, officer_name,
    created_at, updated_at
  ) VALUES (
    inst_id, 'AML_RETURN', 'AML_RETURN-202604-BON-001',
    'Monthly AML Return — April 2026',
    '2026-04-01', '2026-04-30', 'acknowledged', 'medium',
    'Bank of Nigeria', NULL, NULL, 'corporate',
    18670000.00, 12,
    'Monthly AML return for April 2026. Total transactions monitored: 12. Total flagged: 4. Total flagged amount: ₦18,670,000. Includes structuring events on BON-CUST-010 (Ibrahim Musa). Three cases opened during the period. No CTR filings in April. One STR filed (STR-202504-BON-001). AML return acknowledged by NFIU.',
    cco_id, 'BON Compliance Officer',
    cco_id, 'BON Compliance Officer',
    now() - INTERVAL '22 days', now() - INTERVAL '19 days'
  );

  -- AML_RETURN-202605-BON-001: May 2026 monthly return — draft
  INSERT INTO nfiu_reports (
    institution_id, report_type, reference, title,
    period_start, period_end, status, priority,
    subject_name, subject_account, subject_bvn, subject_type,
    amount_ngn, transaction_count, narrative,
    filed_by_user_id, filed_by_name,
    officer_user_id, officer_name,
    created_at, updated_at
  ) VALUES (
    inst_id, 'AML_RETURN', 'AML_RETURN-202605-BON-001',
    'Monthly AML Return — May 2026',
    '2026-05-01', '2026-05-31', 'draft', 'medium',
    'Bank of Nigeria', NULL, NULL, 'corporate',
    46500000.00, 31,
    'DRAFT: Monthly AML return for May 2026. Preliminary: 31 transactions monitored, 9 flagged (₦46.5M). Two STR filings (STR-202505-BON-001, SAR-202505-BON-001), one CTR (CTR-202504-BON-001). Three CRITICAL cases escalated. Requires CCO sign-off before NFIU submission.',
    analyst_id, 'BON Analyst',
    cco_id, 'BON Compliance Officer',
    now() - INTERVAL '4 days', now() - INTERVAL '4 days'
  );

  -- STR-202506-BON-001: Apex Minerals blocked ₦18M — draft
  INSERT INTO nfiu_reports (
    institution_id, report_type, reference, title,
    period_start, period_end, status, priority,
    subject_name, subject_account, subject_bvn, subject_type,
    amount_ngn, transaction_count, narrative,
    filed_by_user_id, filed_by_name,
    officer_user_id, officer_name,
    subject_dob, subject_address, transaction_type, transaction_date,
    linked_transaction_id, transaction_currency, transaction_narration,
    created_at, updated_at
  ) VALUES (
    inst_id, 'STR', 'STR-202506-BON-001',
    'Suspicious Transaction Report — Apex Minerals Nigeria Ltd (Blocked ₦18M Wire)',
    '2026-06-15', '2026-06-15', 'draft', 'high',
    'Apex Minerals Nigeria Ltd', '2001001234', '88100001234', 'corporate',
    18000000.00, 1,
    'DRAFT: ₦18,000,000 NIP wire to an unnamed offshore bank was automatically blocked on 2026-06-15 (risk score: 95). This is the third blocked international transfer for Apex Minerals within 45 days. Entity has an active round-trip investigation (CASE-BON-003). Destination account identity could not be verified. Recommend immediate SAR upgrade and account suspension. CCO review required before NFIU submission.',
    analyst_id, 'BON Analyst',
    cco_id, 'BON Compliance Officer',
    '2017-04-10', 'Plot 7, Mining Crescent, Abuja FCT', 'NIP International Wire', '2026-06-15',
    'BON-TXN-043', 'USD', 'Capital transfer — unspecified purpose',
    now() - INTERVAL '3 days', now() - INTERVAL '3 days'
  );

  -- ── NFIU Schedules ────────────────────────────────────────────────────────
  INSERT INTO nfiu_schedules (
    institution_id, report_type, name, frequency,
    next_due, last_filed_at, is_active, auto_file, created_by
  ) VALUES
  (inst_id, 'AML_RETURN', 'Monthly AML Return',  'monthly',   '2026-06-30', now() - INTERVAL '22 days', TRUE,  FALSE, admin_id),
  (inst_id, 'STR',        'STR Filing Review',    'monthly',   '2026-06-30', now() - INTERVAL '17 days', TRUE,  FALSE, admin_id),
  (inst_id, 'CTR',        'CTR Filing Review',    'monthly',   '2026-06-30', now() - INTERVAL '27 days', TRUE,  FALSE, admin_id),
  (inst_id, 'SAR',        'SAR Annual Review',    'quarterly', '2026-09-30', now() - INTERVAL '9 days',  TRUE,  FALSE, admin_id),
  (inst_id, 'ITF',        'Annual ITF Return',    'annually',  '2026-12-31', NULL,                        TRUE,  FALSE, admin_id),
  (inst_id, 'PEP',        'PEP Screening Report', 'quarterly', '2026-09-30', NULL,                        TRUE,  FALSE, admin_id);

  -- ── NFIU Legacy Returns ───────────────────────────────────────────────────
  INSERT INTO nfiu_returns (
    institution_id, reference, period_from, period_to,
    total_transactions, flagged_count, total_flagged_amount,
    filed_by, status, submitted_at
  ) VALUES
  (inst_id, 'RET-2026-04-BON', '2026-04-01', '2026-04-30', 12, 4, 18670000.00, admin_id, 'acknowledged', now() - INTERVAL '22 days'),
  (inst_id, 'RET-2026-03-BON', '2026-03-01', '2026-03-31',  7, 0,        0.00, admin_id, 'acknowledged', now() - INTERVAL '52 days'),
  (inst_id, 'RET-2026-02-BON', '2026-02-01', '2026-02-28',  5, 0,        0.00, admin_id, 'submitted',    now() - INTERVAL '83 days');

  -- ── CDD Workflows ─────────────────────────────────────────────────────────
  -- Workflow 1: Standard CDD (active, approved)
  INSERT INTO workflow_definitions (
    institution_id, name, version, status, blocks, schedule, schedule_enabled, created_by, approved_by
  ) VALUES (
    inst_id,
    'CBN 2026 Customer Due Diligence',
    1,
    'active',
    '[
      {"type":"identity_verify"},
      {"type":"pep_sanctions_screen"},
      {"type":"phone_basic"},
      {"type":"case_history"},
      {"type":"flagged_transactions"}
    ]'::jsonb,
    '{"highDays":30,"mediumDays":90,"lowDays":365}'::jsonb,
    TRUE,
    admin_id,
    cco_id
  ) RETURNING id INTO wf1_id;

  -- Workflow 2: Enhanced Due Diligence for high-risk (active, approved)
  INSERT INTO workflow_definitions (
    institution_id, name, version, status, blocks, schedule, schedule_enabled, created_by, approved_by
  ) VALUES (
    inst_id,
    'Enhanced Due Diligence — High Risk',
    1,
    'active',
    '[
      {"type":"identity_verify"},
      {"type":"liveness_match"},
      {"type":"pep_sanctions_screen"},
      {"type":"phone_fraud"},
      {"type":"document_verify"},
      {"type":"case_history"},
      {"type":"flagged_transactions"}
    ]'::jsonb,
    '{"highDays":14,"mediumDays":60,"lowDays":180}'::jsonb,
    FALSE,
    cco_id,
    cco_id
  ) RETURNING id INTO wf2_id;

  -- Workflow run 1 — completed standard CDD on low-risk customers
  INSERT INTO workflow_runs (
    workflow_definition_id, workflow_version, institution_id, trigger, status,
    total_customers, clear_count, match_count, error_count, started_at, finished_at
  ) VALUES (
    wf1_id, 1, inst_id, 'scheduled', 'completed',
    5, 5, 0, 0,
    now() - INTERVAL '15 days', now() - INTERVAL '15 days' + INTERVAL '4 minutes'
  ) RETURNING id INTO run1_id;

  INSERT INTO workflow_run_items (run_id, customer_id, step_results, outcome) VALUES
  (run1_id, 'BON-CUST-001', '[{"type":"identity_verify","status":"pass","detail":"BVN 33211001122 verified — Ngozi Adebayo, DOB match.","ms":380},{"type":"pep_sanctions_screen","status":"pass","detail":"No PEP or sanctions matches found.","ms":290},{"type":"phone_basic","status":"pass","detail":"08031122334 is active and registered.","ms":210},{"type":"case_history","status":"pass","detail":"No open cases on record.","ms":45},{"type":"flagged_transactions","status":"pass","detail":"No flagged transactions in the past 12 months.","ms":60}]'::jsonb, 'clear'),
  (run1_id, 'BON-CUST-002', '[{"type":"identity_verify","status":"pass","detail":"BVN 33222001133 verified — Amaka Eze, DOB match.","ms":360},{"type":"pep_sanctions_screen","status":"pass","detail":"No PEP or sanctions matches found.","ms":280},{"type":"phone_basic","status":"pass","detail":"08054433221 is active and registered.","ms":195},{"type":"case_history","status":"pass","detail":"No open cases on record.","ms":42},{"type":"flagged_transactions","status":"pass","detail":"No flagged transactions in the past 12 months.","ms":58}]'::jsonb, 'clear'),
  (run1_id, 'BON-CUST-003', '[{"type":"identity_verify","status":"pass","detail":"BVN 33233001144 verified — Halima Sule, DOB match.","ms":355},{"type":"pep_sanctions_screen","status":"pass","detail":"No PEP or sanctions matches found.","ms":270},{"type":"phone_basic","status":"pass","detail":"08077665544 is active and registered.","ms":188},{"type":"case_history","status":"pass","detail":"No open cases on record.","ms":40},{"type":"flagged_transactions","status":"pass","detail":"No flagged transactions in the past 12 months.","ms":55}]'::jsonb, 'clear'),
  (run1_id, 'BON-CUST-004', '[{"type":"identity_verify","status":"pass","detail":"BVN 33244001155 verified — Chidinma Obi, DOB match.","ms":370},{"type":"pep_sanctions_screen","status":"pass","detail":"No PEP or sanctions matches found.","ms":260},{"type":"phone_basic","status":"pass","detail":"08099887766 is active and registered.","ms":200},{"type":"case_history","status":"pass","detail":"No open cases on record.","ms":43},{"type":"flagged_transactions","status":"pass","detail":"No flagged transactions in the past 12 months.","ms":57}]'::jsonb, 'clear'),
  (run1_id, 'BON-CUST-005', '[{"type":"identity_verify","status":"pass","detail":"BVN 33255001166 verified — Kelechi Nwosu, DOB match.","ms":365},{"type":"pep_sanctions_screen","status":"pass","detail":"No PEP or sanctions matches found.","ms":275},{"type":"phone_basic","status":"pass","detail":"08021334455 is active and registered.","ms":192},{"type":"case_history","status":"pass","detail":"No open cases on record.","ms":44},{"type":"flagged_transactions","status":"pass","detail":"No flagged transactions in the past 12 months.","ms":59}]'::jsonb, 'clear');

  -- Workflow run 2 — completed standard CDD, 2 matches
  INSERT INTO workflow_runs (
    workflow_definition_id, workflow_version, institution_id, trigger, status,
    total_customers, clear_count, match_count, error_count, started_at, finished_at
  ) VALUES (
    wf1_id, 1, inst_id, 'manual', 'completed',
    4, 2, 2, 0,
    now() - INTERVAL '7 days', now() - INTERVAL '7 days' + INTERVAL '6 minutes'
  ) RETURNING id INTO run2_id;

  INSERT INTO workflow_run_items (run_id, customer_id, step_results, outcome) VALUES
  (run2_id, 'BON-CUST-006', '[{"type":"identity_verify","status":"pass","detail":"BVN 33266001177 verified — Chidi Okeke, DOB match.","ms":385},{"type":"pep_sanctions_screen","status":"pass","detail":"No PEP or sanctions matches found.","ms":295},{"type":"phone_basic","status":"pass","detail":"08043556677 is active.","ms":205},{"type":"case_history","status":"pass","detail":"No open cases.","ms":48},{"type":"flagged_transactions","status":"not_found","detail":"2 transactions flagged for structuring review in the past 90 days.","ms":65}]'::jsonb, 'match'),
  (run2_id, 'BON-CUST-007', '[{"type":"identity_verify","status":"pass","detail":"BVN 33277001188 verified — Babatunde Okonkwo, DOB match.","ms":390},{"type":"pep_sanctions_screen","status":"pass","detail":"No PEP or sanctions matches found.","ms":285},{"type":"phone_basic","status":"pass","detail":"08065778899 is active.","ms":198},{"type":"case_history","status":"not_found","detail":"1 open case (CASE-BON-005) — flagged transfer under review.","ms":50},{"type":"flagged_transactions","status":"not_found","detail":"1 transaction flagged for amount threshold in past 30 days.","ms":63}]'::jsonb, 'match'),
  (run2_id, 'BON-CUST-008', '[{"type":"identity_verify","status":"pass","detail":"BVN 33288001199 verified — Blessing Ogundipe, DOB match.","ms":375},{"type":"pep_sanctions_screen","status":"pass","detail":"No PEP or sanctions matches found.","ms":268},{"type":"phone_basic","status":"pass","detail":"08087990011 is active.","ms":194},{"type":"case_history","status":"pass","detail":"No open cases.","ms":46},{"type":"flagged_transactions","status":"pass","detail":"No flagged transactions in the past 12 months.","ms":61}]'::jsonb, 'clear'),
  (run2_id, 'BON-CUST-014', '[{"type":"identity_verify","status":"skipped","detail":"BVN/NIN not on record — foreign national (UK).","ms":120},{"type":"pep_sanctions_screen","status":"pass","detail":"James Richardson — no PEP or sanctions matches on global lists.","ms":310},{"type":"phone_basic","status":"pass","detail":"07055678901 is active.","ms":202},{"type":"case_history","status":"pass","detail":"No open cases.","ms":42},{"type":"flagged_transactions","status":"pass","detail":"No flagged transactions in the past 12 months.","ms":58}]'::jsonb, 'clear');

  -- Workflow run 3 — completed EDD on high-risk customers
  INSERT INTO workflow_runs (
    workflow_definition_id, workflow_version, institution_id, trigger, status,
    total_customers, clear_count, match_count, error_count, started_at, finished_at
  ) VALUES (
    wf2_id, 1, inst_id, 'manual', 'completed',
    3, 0, 3, 0,
    now() - INTERVAL '5 days', now() - INTERVAL '5 days' + INTERVAL '9 minutes'
  ) RETURNING id INTO run3_id;

  INSERT INTO workflow_run_items (run_id, customer_id, step_results, outcome) VALUES
  (run3_id, 'BON-CUST-010', '[{"type":"identity_verify","status":"pass","detail":"BVN 33300112211 verified — Ibrahim Musa.","ms":395},{"type":"liveness_match","status":"skipped","detail":"Selfie not on file — block skipped.","ms":50},{"type":"pep_sanctions_screen","status":"pass","detail":"No PEP entry. Not on OFAC/UN/EU sanctions lists.","ms":330},{"type":"phone_fraud","status":"not_found","detail":"Phone fraud risk: MEDIUM. Possible SIM swap event 90 days ago.","ms":420},{"type":"document_verify","status":"skipped","detail":"No document uploaded.","ms":40},{"type":"case_history","status":"not_found","detail":"1 escalated case (CASE-BON-002). Structuring + blocked offshore wire.","ms":55},{"type":"flagged_transactions","status":"not_found","detail":"4 flagged transactions in past 30 days including 1 blocked wire.","ms":68}]'::jsonb, 'match'),
  (run3_id, 'BON-CUST-011', '[{"type":"identity_verify","status":"pass","detail":"BVN 33311223322 verified — Yusuf Dantata.","ms":402},{"type":"liveness_match","status":"skipped","detail":"Selfie not on file — block skipped.","ms":48},{"type":"pep_sanctions_screen","status":"pass","detail":"No PEP entry. Not on OFAC/UN/EU sanctions lists.","ms":345},{"type":"phone_fraud","status":"not_found","detail":"Phone fraud risk: HIGH. Number linked to 2 previous fraud complaints.","ms":440},{"type":"document_verify","status":"skipped","detail":"No document uploaded.","ms":38},{"type":"case_history","status":"not_found","detail":"1 active case (CASE-BON-001). Round-trip ₦16.8M.","ms":58},{"type":"flagged_transactions","status":"not_found","detail":"5 flagged transactions in past 30 days including 1 blocked wire.","ms":72}]'::jsonb, 'match'),
  (run3_id, 'BON-CUST-012', '[{"type":"identity_verify","status":"skipped","detail":"Corporate entity — BVN check skipped.","ms":35},{"type":"liveness_match","status":"skipped","detail":"Liveness check not applicable to corporate entity.","ms":20},{"type":"pep_sanctions_screen","status":"not_found","detail":"MATCH: Apex Minerals Nigeria Ltd appears on the NFIU domestic high-risk entity watch list (2024 update). Manual review required.","ms":380},{"type":"phone_fraud","status":"not_found","detail":"Phone fraud risk: HIGH. Number linked to regulatory notices.","ms":430},{"type":"document_verify","status":"skipped","detail":"No document uploaded.","ms":36},{"type":"case_history","status":"not_found","detail":"1 escalated case (CASE-BON-003). ₦41.8M total movement under investigation.","ms":60},{"type":"flagged_transactions","status":"not_found","detail":"5 flagged transactions in past 30 days including 1 blocked ₦18M wire.","ms":75}]'::jsonb, 'match');

  -- ── Monitoring Pipelines ──────────────────────────────────────────────────
  -- Pipeline 1: CBN 2026 Threshold Rules (OR — any single rule triggers)
  INSERT INTO monitoring_pipelines (
    institution_id, name, description, logic, status, created_by
  ) VALUES (
    inst_id,
    'CBN 2026 Threshold Rules',
    'Implements CBN AML/CFT Regulation 2023 automatic reporting thresholds. Flags any transaction meeting at least one threshold condition.',
    'OR', 'active',
    'admin@bank-of-nigeria.com'
  ) RETURNING id INTO pipe1_id;

  INSERT INTO monitoring_rules (pipeline_id, institution_id, name, field, op, value, enabled, position) VALUES
  (pipe1_id, inst_id, 'Large Transaction (≥ ₦1,000,000)',   'amount',  'GTE', '1000000',  TRUE, 0),
  (pipe1_id, inst_id, 'International Wire Flag',             'channel', 'EQ',  'NIP',      TRUE, 1),
  (pipe1_id, inst_id, 'High-Risk Customer (score ≥ 75)',     'riskScore','GTE','75',        TRUE, 2),
  (pipe1_id, inst_id, 'Blocked / Failed Transaction',        'status',  'EQ',  'failed',   TRUE, 3);

  -- Pipeline 2: Structuring Detection (AND — all conditions together)
  INSERT INTO monitoring_pipelines (
    institution_id, name, description, logic, status, created_by
  ) VALUES (
    inst_id,
    'Structuring Detection',
    'Detects transactions in the structuring zone: amount above ₦400,000 but below the ₦500,000 reporting threshold, sent via NIP.',
    'AND', 'active',
    'admin@bank-of-nigeria.com'
  ) RETURNING id INTO pipe2_id;

  INSERT INTO monitoring_rules (pipeline_id, institution_id, name, field, op, value, enabled, position) VALUES
  (pipe2_id, inst_id, 'Amount above ₦400,000',    'amount', 'GTE', '400000', TRUE, 0),
  (pipe2_id, inst_id, 'Amount below ₦500,000',    'amount', 'LT',  '500000', TRUE, 1),
  (pipe2_id, inst_id, 'Channel is NIP',            'channel','EQ',  'NIP',    TRUE, 2);

  -- ── Institution Alerts ────────────────────────────────────────────────────
  INSERT INTO institution_alerts (institution_id, alert_type, title, message, severity, status, created_at) VALUES
  (
    inst_id, 'high_risk_transaction',
    'Blocked: ₦18M Offshore Wire — Apex Minerals Nigeria Ltd',
    'An ₦18,000,000 wire transfer to an unnamed offshore bank was automatically blocked (risk score: 95). This is the third blocked international transfer for this entity in 45 days. Immediate compliance escalation required. Case CASE-BON-003 is active.',
    'critical', 'open', now() - INTERVAL '3 days'
  ),
  (
    inst_id, 'round_trip_detected',
    'Round-Trip Confirmed — Yusuf Dantata',
    '₦8.5M outbound offshore wire followed within 48 hours by ₦8.3M inbound repatriation. Round-trip pattern confirmed. STR-202505-BON-001 filed with NFIU. Case CASE-BON-001 under investigation.',
    'critical', 'acknowledged', now() - INTERVAL '20 days'
  ),
  (
    inst_id, 'structuring_detected',
    'Structuring Pattern — Ibrahim Musa',
    'Three transactions totalling ₦1,470,000 executed within a 90-minute window, each below the ₦500,000 reporting threshold. Classic structuring typology. Case CASE-BON-002 escalated. STR filed.',
    'high', 'open', now() - INTERVAL '11 days'
  ),
  (
    inst_id, 'velocity_alert',
    'BDC & Offshore Velocity — Emeka Ejike',
    'Customer executed a ₦2.5M offshore wire and ₦1.8M BDC transaction within 10 days with no prior international wire history. Case CASE-BON-004 opened. Documentation request sent.',
    'high', 'open', now() - INTERVAL '14 days'
  );

END $$;
