-- V101: Demo transaction data for Vantage Microfinance Bank.
-- Populates customers, transactions, cases, and alerts for dashboard demonstration.
-- Depends on V100 (Vantage institution + users). No-op if V100 was not run.

DO $$
DECLARE
  inst_id    BIGINT;
  admin_id   BIGINT;
  analyst_id BIGINT;
BEGIN

  SELECT id INTO inst_id    FROM institutions WHERE name = 'Vantage Microfinance Bank';
  SELECT id INTO admin_id   FROM users WHERE email = 'demo@vantage-mfb.com';
  SELECT id INTO analyst_id FROM users WHERE email = 'analyst@vantage-mfb.com';

  IF inst_id IS NULL THEN RETURN; END IF;

  -- ── Customers ──────────────────────────────────────────────────────────────
  INSERT INTO customers (
    institution_id, external_id, name, email, phone,
    bvn, account_number, subject_type, dob, address,
    risk_score, risk_profile_score, transaction_risk_score, overall_risk_score
  ) VALUES
  (inst_id, 'CUST-001', 'Emeka Okafor',                'emeka.okafor@gmail.com',        '08031234567', '22312345678', '0012345678', 'individual', '1985-03-14', '12 Adeola Odeku St, Victoria Island, Lagos',              42, 30, 55, 42),
  (inst_id, 'CUST-002', 'Aisha Bello',                 'aisha.bello@yahoo.com',          '08097654321', '22345678901', '0023456789', 'individual', '1992-07-22', '45 Wuse Zone 4, Abuja',                                   12, 10, 15, 12),
  (inst_id, 'CUST-003', 'Olusegun Adeyemi',            'olusegun.adeyemi@hotmail.com',   '08054321098', '22456789012', '0034567890', 'individual', '1978-11-05', '7 Trans-Amadi Rd, Port Harcourt',                         81, 75, 88, 81),
  (inst_id, 'CUST-004', 'Fatima Aliyu',                'fatima.aliyu@gmail.com',         '08061234567', '22567890123', '0045678901', 'individual', '1990-04-18', '22 Murtala Mohammed Way, Kano',                            8,  5, 11,  8),
  (inst_id, 'CUST-005', 'Chukwuemeka Nwachukwu',       'c.nwachukwu@nwachukwu.ng',       '08079876543', '22678901234', '0056789012', 'individual', '1982-09-30', '33 New Market Rd, Onitsha',                               56, 50, 63, 56),
  (inst_id, 'CUST-006', 'BrightPath Investment Ltd',   'compliance@brightpath.ng',       '0122345678',  '77890123456', '1001234567', 'corporate',  '2018-06-01', 'Plot 15, Churchgate Towers, Abuja',                       91, 88, 95, 91),
  (inst_id, 'CUST-007', 'Skyline Properties Nigeria',  'finance@skyline-ng.com',         '0139876543',  '77901234567', '1002345678', 'corporate',  '2015-03-15', '2nd Floor, 1004 Apartments, Victoria Island, Lagos',      38, 35, 42, 38),
  (inst_id, 'CUST-008', 'Tunde Fashola',               'tunde.fashola@gmail.com',        '08023456789', '22789012345', '0067890123', 'individual', '1988-12-03', '9 Glover Rd, Ikoyi, Lagos',                               19, 15, 23, 19);

  -- ── Transactions ──────────────────────────────────────────────────────────
  -- status        : payment processing outcome  → 'pending' | 'successful' | 'failed'
  -- flagged_status: compliance review state     → 'flagged' | 'blocked' | 'cleared' | 'review' | NULL

  -- Aisha Bello — clean history
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('DEMO-TXN-001', inst_id, 'CUST-002', 'Aisha Bello',  45000.00, 'Mobile', 'MTN MoMo',    5, 'successful', NULL,     NULL,               'Abuja', 9.0579,  7.4951, now() - INTERVAL '28 days', '0023456789', 'Vantage MFB', 'MTN Nigeria',             'MTN-08031234567', 'MTN MoMo',    'NGN', 'Airtime recharge',                            'mob_ios_a1b2',      '41.203.78.91'),
  ('DEMO-TXN-002', inst_id, 'CUST-002', 'Aisha Bello', 125000.00, 'NIP',    'GTBank',       8, 'successful', NULL,     NULL,               'Abuja', 9.0579,  7.4951, now() - INTERVAL '21 days', '0023456789', 'Vantage MFB', 'Abuja Continental Hotel', '0345678901',      'GTBank',      'NGN', 'Hotel booking — Abuja Continental',          'web_chrome_b2c3',   '105.112.9.180'),
  ('DEMO-TXN-003', inst_id, 'CUST-002', 'Aisha Bello',  80000.00, 'NIP',    'Access Bank',  6, 'successful', NULL,     NULL,               'Abuja', 9.0579,  7.4951, now() - INTERVAL '14 days', '0023456789', 'Vantage MFB', 'Bello Family Trust',      '0456789012',      'Access Bank', 'NGN', 'Family remittance',                          'mob_and_c3d4',      '105.112.9.180'),
  ('DEMO-TXN-029', inst_id, 'CUST-002', 'Aisha Bello',  50000.00, 'NIP',    'GTBank',       6, 'successful', NULL,     NULL,               'Abuja', 9.0579,  7.4951, now() - INTERVAL '7 days',  '0023456789', 'Vantage MFB', 'Abuja Supermart',         '0456789034',      'GTBank',      'NGN', 'Grocery shopping',                           'mob_ios_x4y5',      '105.112.9.180');

  -- Tunde Fashola — clean history
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('DEMO-TXN-004', inst_id, 'CUST-008', 'Tunde Fashola', 250000.00, 'NIP', 'First Bank',  12, 'successful', NULL, NULL, 'Lagos', 6.4281, 3.4219, now() - INTERVAL '25 days', '0067890123', 'Vantage MFB', 'Fashola Properties Ltd',  '0987654321',      'First Bank',  'NGN', 'Rent payment — 2A Glover Road',  'mob_ios_d4e5', '197.210.64.77'),
  ('DEMO-TXN-005', inst_id, 'CUST-008', 'Tunde Fashola',  35000.00, 'POS', 'PoS Terminal',  7, 'successful', NULL, NULL, 'Lagos', 6.4281, 3.4219, now() - INTERVAL '18 days', '0067890123', 'Vantage MFB', 'Shoprite Lekki',          'TERM-00456123',   'PoS Terminal','NGN', 'PoS purchase — Shoprite Lekki',  'pos_terminal_001', '41.58.12.44'),
  ('DEMO-TXN-031', inst_id, 'CUST-008', 'Tunde Fashola', 750000.00, 'NIP', 'Zenith Bank',  14, 'successful', NULL, NULL, 'Lagos', 6.4281, 3.4219, now() - INTERVAL '3 days',  '0067890123', 'Vantage MFB', 'Ikoyi Medical Centre',    '0678901456',      'Zenith Bank', 'NGN', 'Medical bills settlement',       'mob_ios_z6a7', '197.210.64.77');

  -- Fatima Aliyu — clean history
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('DEMO-TXN-006', inst_id, 'CUST-004', 'Fatima Aliyu',  60000.00, 'USSD', 'Zenith Bank',  4, 'successful', NULL, NULL, 'Kano', 12.0022, 8.5920, now() - INTERVAL '26 days', '0045678901', 'Vantage MFB', 'Kano Fabric Traders',     '0234567890', 'Zenith Bank', 'NGN', 'Payment for fabric materials',   'ussd_mob_e5f6', '196.1.145.22'),
  ('DEMO-TXN-007', inst_id, 'CUST-004', 'Fatima Aliyu',  15000.00, 'USSD', 'MTN MoMo',     3, 'successful', NULL, NULL, 'Kano', 12.0022, 8.5920, now() - INTERVAL '15 days', '0045678901', 'Vantage MFB', 'IKEDC',                   '0567890123', 'IKEDC',       'NGN', 'Electricity bill payment',       'ussd_mob_f6g7', '196.1.145.22'),
  ('DEMO-TXN-030', inst_id, 'CUST-004', 'Fatima Aliyu', 200000.00, 'NIP',  'Access Bank',  7, 'successful', NULL, NULL, 'Kano', 12.0022, 8.5920, now() - INTERVAL '5 days',  '0045678901', 'Vantage MFB', 'Kano Textile Merchants',  '0567891234', 'Access Bank', 'NGN', 'Trade payment — fabric inventory','mob_and_y5z6',  '196.1.145.22');

  -- Skyline Properties — normal corporate
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('DEMO-TXN-008', inst_id, 'CUST-007', 'Skyline Properties Nigeria', 4500000.00, 'NIP', 'Stanbic IBTC', 22, 'successful', NULL, NULL, 'Lagos', 6.4281, 3.4219, now() - INTERVAL '20 days', '1002345678', 'Vantage MFB', 'Lagos State Land Registry', '0678901234', 'Stanbic IBTC',  'NGN', 'Land title registration fees — Lekki Phase 2',     'web_chrome_g7h8', '41.78.102.55'),
  ('DEMO-TXN-009', inst_id, 'CUST-007', 'Skyline Properties Nigeria', 2200000.00, 'NIP', 'UBA',          18, 'successful', NULL, NULL, 'Lagos', 6.4281, 3.4219, now() - INTERVAL '11 days', '1002345678', 'Vantage MFB', 'Julius Berger Nigeria Plc', '0789012345', 'UBA',           'NGN', 'Construction contract advance — Phase 2A',          'web_chrome_h8i9', '41.78.102.55'),
  ('DEMO-TXN-032', inst_id, 'CUST-007', 'Skyline Properties Nigeria', 1800000.00, 'NIP', 'UBA',          20, 'successful', NULL, NULL, 'Lagos', 6.4281, 3.4219, now() - INTERVAL '2 days',  '1002345678', 'Vantage MFB', 'Dangote Cement Plc',        '0789012678', 'UBA',           'NGN', 'Building materials procurement — Site B',           'web_chrome_a7b8', '41.78.102.55');

  -- Emeka Okafor — medium risk, structuring + flagged international wire
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('DEMO-TXN-010', inst_id, 'CUST-001', 'Emeka Okafor', 300000.00, 'NIP', 'GTBank',       38, 'successful', NULL,     NULL,               'Lagos', 6.4550, 3.3841, now() - INTERVAL '29 days', '0012345678', 'Vantage MFB', 'Okafor Trading Ltd',          '0345678901',    'GTBank',         'NGN', 'Business supplies payment',                          'mob_ios_i9j0',    '197.210.64.77'),
  ('DEMO-TXN-011', inst_id, 'CUST-001', 'Emeka Okafor', 490000.00, 'NIP', 'Access Bank',  55, 'successful', 'review', 'structuring',      'Lagos', 6.4550, 3.3841, now() - INTERVAL '22 days', '0012345678', 'Vantage MFB', 'Unknown Beneficiary A',       '9876543210',    'Unknown Bank',   'NGN', 'Business transaction — no further details',          'mob_ios_j0k1',    '105.184.73.29'),
  ('DEMO-TXN-012', inst_id, 'CUST-001', 'Emeka Okafor', 195000.00, 'NIP', 'Polaris Bank', 41, 'successful', 'review', 'structuring',      'Lagos', 6.4550, 3.3841, now() - INTERVAL '22 days', '0012345678', 'Vantage MFB', 'Unknown Beneficiary B',       '8765432109',    'Unknown Bank',   'NGN', 'Business transaction',                               'mob_ios_j0k1',    '105.184.73.29'),
  ('DEMO-TXN-013', inst_id, 'CUST-001', 'Emeka Okafor', 285000.00, 'NIP', 'Keystone Bank',44, 'successful', 'review', 'structuring',      'Lagos', 6.4550, 3.3841, now() - INTERVAL '22 days', '0012345678', 'Vantage MFB', 'Unknown Beneficiary C',       '7654321098',    'Unknown Bank',   'NGN', 'Payment transfer',                                   'mob_ios_j0k1',    '105.184.73.29'),
  ('DEMO-TXN-014', inst_id, 'CUST-001', 'Emeka Okafor', 520000.00, 'NIP', 'First Bank',   62, 'successful', 'flagged','international_wire','Abuja', 9.0579, 7.4951, now() - INTERVAL '8 days',  '0012345678', 'Vantage MFB', 'Okafor Investments Offshore', 'INTL-00123456', 'Citibank N.A.', 'USD', 'International wire — offshore investment Q2',        'web_chrome_k1l2', '198.71.233.12'),
  ('DEMO-TXN-033', inst_id, 'CUST-001', 'Emeka Okafor', 180000.00, 'NIP', 'First Bank',   35, 'successful', NULL,     NULL,               'Lagos', 6.4550, 3.3841, now() - INTERVAL '1 day',   '0012345678', 'Vantage MFB', 'Lagos Business Hub',          '0890123456',    'First Bank',     'NGN', 'Office rent payment Q2',                             'mob_ios_b8c9',    '197.210.64.77');

  -- Chukwuemeka Nwachukwu — medium-high risk, flagged offshore + BDC
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('DEMO-TXN-015', inst_id, 'CUST-005', 'Chukwuemeka Nwachukwu', 1200000.00, 'NIP', 'UBA',      48, 'successful', NULL,     NULL,               'Onitsha', 6.1522, 6.7878, now() - INTERVAL '27 days', '0056789012', 'Vantage MFB', 'Nwachukwu & Sons Ltd',       '0456789023', 'UBA',           'NGN', 'Business proceeds — Q1 trading',               'web_chrome_l2m3', '41.203.78.91'),
  ('DEMO-TXN-016', inst_id, 'CUST-005', 'Chukwuemeka Nwachukwu', 3800000.00, 'NIP', 'Zenith',   58, 'successful', 'flagged','international_wire','Onitsha', 6.1522, 6.7878, now() - INTERVAL '16 days', '0056789012', 'Vantage MFB', 'Cayman Sunrise Partners Ltd','INTL-00567890','Cayman National','USD', 'Offshore investment reallocation',             'web_chrome_m3n4', '198.71.233.12'),
  ('DEMO-TXN-017', inst_id, 'CUST-005', 'Chukwuemeka Nwachukwu',  750000.00, 'NIP', 'GTBank',   52, 'successful', 'review', 'bdc_transfer',     'Lagos',   6.4281, 3.4219, now() - INTERVAL '6 days',  '0056789012', 'Vantage MFB', 'Rapid Remit BDC',            '0678901235', 'Sterling Bank', 'NGN', 'FX purchase — USD and GBP settlement',         'web_chrome_n4o5', '197.210.64.77'),
  ('DEMO-TXN-034', inst_id, 'CUST-005', 'Chukwuemeka Nwachukwu',  450000.00, 'NIP', 'GTBank',   45, 'pending',    'review', 'bdc_transfer',     'Onitsha', 6.1522, 6.7878, now() - INTERVAL '12 hours','0056789012', 'Vantage MFB', 'Onitsha Head Bridge BDC',    '0901234567', 'GTBank',        'NGN', 'FX settlement — USD purchase',                 'web_chrome_c9d0', '41.203.78.91');

  -- Olusegun Adeyemi — HIGH risk: structuring + two blocked offshore wires
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('DEMO-TXN-018', inst_id, 'CUST-003', 'Olusegun Adeyemi', 490000.00, 'NIP', 'Access Bank', 75, 'successful', 'flagged', 'amount_threshold',     'Port Harcourt', 4.8156, 7.0498, now() - INTERVAL '30 days', '0034567890', 'Vantage MFB', 'PH Oil Traders Ltd',        '0123456789',    'Access Bank',    'NGN', 'Business proceeds A',                          'mob_and_o5p6', '105.113.92.18'),
  ('DEMO-TXN-019', inst_id, 'CUST-003', 'Olusegun Adeyemi', 485000.00, 'NIP', 'First Bank',  78, 'successful', 'flagged', 'structuring',          'Port Harcourt', 4.8156, 7.0498, now() - INTERVAL '30 days', '0034567890', 'Vantage MFB', 'PH Resources Inc',          '0234567891',    'First Bank',     'NGN', 'Business proceeds B',                          'mob_and_o5p6', '105.113.92.18'),
  ('DEMO-TXN-020', inst_id, 'CUST-003', 'Olusegun Adeyemi', 492000.00, 'NIP', 'Zenith Bank', 76, 'successful', 'flagged', 'structuring',          'Port Harcourt', 4.8156, 7.0498, now() - INTERVAL '29 days', '0034567890', 'Vantage MFB', 'Delta Ventures Ltd',        '0345678902',    'Zenith Bank',    'NGN', 'Business proceeds C',                          'mob_and_o5p6', '105.113.92.18'),
  ('DEMO-TXN-021', inst_id, 'CUST-003', 'Olusegun Adeyemi',5200000.00, 'NIP', 'GTBank',      88, 'failed',     'blocked', 'high_risk_destination','Port Harcourt', 4.8156, 7.0498, now() - INTERVAL '12 days', '0034567890', 'Vantage MFB', 'Offshore Holdings BVI',     'INTL-00999888', 'BVI Offshore',   'USD', 'Offshore wire — unspecified purpose',          'web_chrome_p6q7','198.51.100.12'),
  ('DEMO-TXN-022', inst_id, 'CUST-003', 'Olusegun Adeyemi',2100000.00, 'NIP', 'UBA',         82, 'failed',     'blocked', 'high_risk_destination','Lagos',          6.4281, 3.4219, now() - INTERVAL '4 days',  '0034567890', 'Vantage MFB', 'Unknown Shell Entity',      'INTL-00888777', 'Unknown',        'USD', 'Wire transfer — no stated purpose',            'web_chrome_q7r8','198.51.100.44');

  -- BrightPath Investment Ltd — HIGH risk: round-trip + structuring + blocked wire
  INSERT INTO transactions (id, institution_id, customer_id, customer_name, amount, channel, counterparty, risk_score, status, flagged_status, flag_reason, location, lat, lng, occurred_at, sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, currency, narration, device_id, ip_address) VALUES
  ('DEMO-TXN-023', inst_id, 'CUST-006', 'BrightPath Investment Ltd',  9800000.00, 'NIP', 'GTBank',       85, 'successful', 'flagged', 'international_wire','Abuja', 9.0579, 7.4951, now() - INTERVAL '27 days', '1001234567', 'Vantage MFB', 'BrightPath Offshore Ltd',      'INTL-00654321', 'Cayman National','USD', 'Investment capital transfer — offshore portfolio', 'web_chrome_r8s9', '198.71.233.12'),
  ('DEMO-TXN-024', inst_id, 'CUST-006', 'BrightPath Investment Ltd',  9600000.00, 'NIP', 'Zenith Bank',  89, 'successful', 'flagged', 'round_trip',        'Abuja', 9.0579, 7.4951, now() - INTERVAL '25 days', '1001234567', 'Vantage MFB', 'BrightPath Nigeria Ltd',       '1001234567',    'Vantage MFB',   'NGN', 'Portfolio return — repatriation',                 'web_chrome_s9t0', '105.112.9.180'),
  ('DEMO-TXN-025', inst_id, 'CUST-006', 'BrightPath Investment Ltd',   490000.00, 'NIP', 'Access Bank',  82, 'successful', 'flagged', 'structuring',       'Abuja', 9.0579, 7.4951, now() - INTERVAL '20 days', '1001234567', 'Vantage MFB', 'Strategic Ventures Ltd A',     '0111222333',    'Sterling Bank', 'NGN', 'Sub-threshold transfer A',                       'web_chrome_t0u1', '105.112.9.180'),
  ('DEMO-TXN-026', inst_id, 'CUST-006', 'BrightPath Investment Ltd',   495000.00, 'NIP', 'Polaris Bank', 83, 'successful', 'flagged', 'structuring',       'Abuja', 9.0579, 7.4951, now() - INTERVAL '20 days', '1001234567', 'Vantage MFB', 'Strategic Ventures Ltd B',     '0222333444',    'Fidelity Bank', 'NGN', 'Sub-threshold transfer B',                       'web_chrome_u1v2', '105.112.9.180'),
  ('DEMO-TXN-027', inst_id, 'CUST-006', 'BrightPath Investment Ltd',   488000.00, 'NIP', 'Keystone Bank',84, 'successful', 'flagged', 'structuring',       'Abuja', 9.0579, 7.4951, now() - INTERVAL '20 days', '1001234567', 'Vantage MFB', 'Strategic Ventures Ltd C',     '0333444555',    'Ecobank',       'NGN', 'Sub-threshold transfer C',                       'web_chrome_v2w3', '105.112.9.180'),
  ('DEMO-TXN-028', inst_id, 'CUST-006', 'BrightPath Investment Ltd', 15000000.00, 'NIP', 'First Bank',   92, 'failed',     'blocked', 'high_risk_destination','Lagos',9.0579, 7.4951, now() - INTERVAL '3 days',  '1001234567', 'Vantage MFB', 'Unknown Destination Entity',   'INTL-00777666', 'Unnamed Offshore','USD','Capital transfer — unspecified',                  'web_chrome_w3x4', '198.71.233.99');

  -- ── Cases ──────────────────────────────────────────────────────────────────
  INSERT INTO cases (
    id, institution_id, customer_id, customer_name,
    title, typology, status, priority, risk_score,
    assigned_to, created_by, sla_deadline, brief, notes, created_at
  ) VALUES
  (
    'CASE-VNTG-001', inst_id, 'CUST-006', 'BrightPath Investment Ltd',
    'Round-Trip Capital Flow — BrightPath Investment Ltd',
    'Round-Trip Transactions', 'investigating', 'critical', 91,
    analyst_id, admin_id,
    now() + INTERVAL '3 days',
    '₦9.8M offshore wire followed within 48 hours by ₦9.6M repatriation, plus three sub-threshold transfers on the same day. Round-trip pattern with structuring indicators.',
    'Corporate entity executed a ₦9.8M offshore transfer followed within 48 hours by a near-equivalent ₦9.6M repatriation. Pattern indicative of a round-trip transaction designed to create the appearance of legitimate business income. Three additional sub-threshold transfers (each ~₦490k) detected on the same day — consistent with structuring. Escalation to NFIU under review.',
    now() - INTERVAL '18 days'
  ),
  (
    'CASE-VNTG-002', inst_id, 'CUST-003', 'Olusegun Adeyemi',
    'High-Risk Offshore Wires — Olusegun Adeyemi',
    'Suspicious Wire Transfer', 'escalated', 'critical', 88,
    analyst_id, admin_id,
    now() + INTERVAL '1 day',
    'Two blocked international wires totalling ₦7.3M (USD) to unnamed BVI and offshore entities, preceded by three sub-₦500k transfers in a 2-hour window.',
    'Two attempted international wire transfers to unnamed BVI and offshore entities totalling ₦7.3M (USD equivalent) were blocked by the automated risk engine. Account shows three sub-₦500k transfers within a 2-hour window preceding the blocked wires — a classic structuring precursor. Account placed under enhanced due diligence pending customer explanation.',
    now() - INTERVAL '10 days'
  ),
  (
    'CASE-VNTG-003', inst_id, 'CUST-001', 'Emeka Okafor',
    'Structuring Pattern — Emeka Okafor',
    'Structuring', 'open', 'high', 62,
    NULL, admin_id,
    now() + INTERVAL '7 days',
    'Three transactions totalling ₦970k split across different beneficiaries on the same day, each below the ₦500k reporting threshold. Subsequent offshore wire adds further weight.',
    'Three transactions totalling ₦970k split across different beneficiaries on the same day, each below the ₦500k reporting threshold. Pattern matches classic structuring typology. A subsequent international wire of ₦520k to an offshore entity adds supporting evidence. Account flagged for analyst assignment.',
    now() - INTERVAL '20 days'
  ),
  (
    'CASE-VNTG-004', inst_id, 'CUST-005', 'Chukwuemeka Nwachukwu',
    'Unusual Offshore Transfer — Nwachukwu',
    'Suspicious Wire Transfer', 'open', 'high', 58,
    NULL, admin_id,
    now() + INTERVAL '5 days',
    '₦3.8M transfer to Cayman Islands entity with no prior international wire history. Additional BDC transactions of ₦1.2M flagged. Customer documentation requested.',
    '₦3.8M transfer to Cayman Islands entity (Cayman Sunrise Partners Ltd) with narration citing "portfolio reallocation." No prior international wire history for this customer. Additional BDC transactions of ₦1.2M total flagged for FX review. Customer to be contacted for documentation.',
    now() - INTERVAL '14 days'
  ),
  (
    'CASE-VNTG-005', inst_id, 'CUST-006', 'BrightPath Investment Ltd',
    'Blocked High-Value Wire — BrightPath Investment Ltd',
    'Suspicious Wire Transfer', 'escalated', 'critical', 92,
    analyst_id, admin_id,
    now() - INTERVAL '1 day',
    '₦15M wire to unnamed offshore bank blocked (risk score: 92). Second blocked international transfer in 30 days. SAR filing under active consideration.',
    '₦15M wire transfer to an unnamed offshore bank was blocked by the risk engine (score: 92). This is the second blocked international transfer for this entity within 30 days. Compliance officer notified. SAR filing under active consideration. All outgoing international transfers for this account are suspended pending review.',
    now() - INTERVAL '2 days'
  );

  -- ── Link transactions to cases ─────────────────────────────────────────────
  INSERT INTO case_transactions (case_id, transaction_id) VALUES
  ('CASE-VNTG-001', 'DEMO-TXN-023'),
  ('CASE-VNTG-001', 'DEMO-TXN-024'),
  ('CASE-VNTG-001', 'DEMO-TXN-025'),
  ('CASE-VNTG-001', 'DEMO-TXN-026'),
  ('CASE-VNTG-001', 'DEMO-TXN-027'),
  ('CASE-VNTG-002', 'DEMO-TXN-018'),
  ('CASE-VNTG-002', 'DEMO-TXN-019'),
  ('CASE-VNTG-002', 'DEMO-TXN-020'),
  ('CASE-VNTG-002', 'DEMO-TXN-021'),
  ('CASE-VNTG-002', 'DEMO-TXN-022'),
  ('CASE-VNTG-003', 'DEMO-TXN-011'),
  ('CASE-VNTG-003', 'DEMO-TXN-012'),
  ('CASE-VNTG-003', 'DEMO-TXN-013'),
  ('CASE-VNTG-003', 'DEMO-TXN-014'),
  ('CASE-VNTG-004', 'DEMO-TXN-016'),
  ('CASE-VNTG-004', 'DEMO-TXN-017'),
  ('CASE-VNTG-005', 'DEMO-TXN-028');

  -- ── Additional customers ──────────────────────────────────────────────────
  INSERT INTO customers (
    institution_id, external_id, name, email, phone,
    bvn, account_number, subject_type, dob, address,
    risk_score, risk_profile_score, transaction_risk_score, overall_risk_score
  ) VALUES
  (inst_id, 'CUST-009', 'Ngozi Okonkwo',               'ngozi.okonkwo@gmail.com',       '08011223344', '22890123456', '0078901234', 'individual', '1995-06-12', '5 Allen Ave, Ikeja, Lagos',                                  9,  7, 12,  9),
  (inst_id, 'CUST-010', 'Ibrahim Musa',                 'ibrahim.musa@yahoo.com',         '08033445566', '22901234567', '0089012345', 'individual', '1971-02-28', '18 Ahmadu Bello Way, Kaduna',                               25, 20, 30, 25),
  (inst_id, 'CUST-011', 'Adaeze Eze',                   'adaeze.eze@gmail.com',           '08055667788', '22012345678', '0090123456', 'individual', '1998-09-15', '3 Independence Layout, Enugu',                              15, 12, 18, 15),
  (inst_id, 'CUST-012', 'Segun Olanrewaju',             'segun.olanrewaju@hotmail.com',   '08077889900', '22123456789', '0001234567', 'individual', '1980-04-03', '67 Bode Thomas St, Surulere, Lagos',                        33, 28, 38, 33),
  (inst_id, 'CUST-013', 'Halima Usman',                 'halima.usman@gmail.com',         '08099001122', '22234567890', '0002345678', 'individual', '1993-11-20', '10 Sultan Rd, Sokoto',                                       6,  4,  8,  6),
  (inst_id, 'CUST-014', 'Chidi Okeke',                  'chidi.okeke@chidiokeke.ng',      '08021234560', '22345678902', '0003456789', 'individual', '1975-07-07', '45 Oguta Rd, Onitsha',                                      47, 40, 55, 47),
  (inst_id, 'CUST-015', 'Pinnacle Trade & Logistics Ltd','ops@pinnacletrade.ng',           '0112345601',  '77012345678', '1003456789', 'corporate',  '2019-01-15', 'Km 5, Apapa Oshodi Expressway, Lagos',                      62, 58, 68, 62),
  (inst_id, 'CUST-016', 'Meridian Capital Partners Ltd', 'cfo@meridiancap.ng',             '0123456702',  '77123456789', '1004567890', 'corporate',  '2016-09-22', 'Suite 301, Eko Atlantic, Lagos',                            78, 72, 85, 78),
  (inst_id, 'CUST-017', 'Blessing Okoro',               'blessing.okoro@gmail.com',       '08043456781', '22456789013', '0004567890', 'individual', '1989-03-25', '22 Rumuola Rd, Port Harcourt',                              20, 16, 24, 20),
  (inst_id, 'CUST-018', 'Abdullahi Tanko',              'a.tanko@maiduguri-law.ng',       '08065678903', '22567890124', '0005678901', 'individual', '1967-08-11', '4 Shehu Laminu Way, Maiduguri',                             14, 10, 18, 14);

  -- ── NFIU Reports ──────────────────────────────────────────────────────────
  -- STR-202504-0001: Adeyemi structuring — filed and acknowledged
  INSERT INTO nfiu_reports (
    institution_id, report_type, reference, title,
    period_start, period_end, status, priority,
    filing_date, subject_name, subject_account, subject_bvn, subject_type,
    amount_ngn, transaction_count, narrative,
    filed_by_user_id, filed_by_name, acknowledgement_ref,
    officer_user_id, officer_name,
    subject_dob, subject_address, transaction_type, transaction_date,
    linked_transaction_id, transaction_currency, transaction_narration,
    created_at, updated_at
  ) VALUES (
    inst_id, 'STR', 'STR-202504-0001',
    'Suspicious Transaction Report — Olusegun Adeyemi (Structuring)',
    '2026-04-23', '2026-04-23', 'acknowledged', 'high',
    now() - INTERVAL '27 days',
    'Olusegun Adeyemi', '0034567890', '22456789012', 'individual',
    1467000.00, 3,
    'Three transactions each below ₦500,000 were executed within a 2-hour window on 2026-04-23 to three separate beneficiaries. Total value ₦1,467,000. Pattern is consistent with structuring to evade the CBN mandatory reporting threshold. No legitimate business explanation provided by customer. Transactions flagged by automated AML engine (rule: STRUCTURING_SPLIT). Recommended for STR filing per CBN AML/CFT Regulations 2022 Section 8.1.',
    analyst_id, 'Demo Analyst', 'NFIU-ACK-2026-04-STR-0001',
    analyst_id, 'Demo Analyst',
    '1978-11-05', '7 Trans-Amadi Rd, Port Harcourt', 'NIP Transfer', '2026-04-23',
    'DEMO-TXN-018', 'NGN', 'Business proceeds A',
    now() - INTERVAL '27 days', now() - INTERVAL '20 days'
  );

  -- STR-202505-0001: BrightPath round-trip — filed
  INSERT INTO nfiu_reports (
    institution_id, report_type, reference, title,
    period_start, period_end, status, priority,
    filing_date, subject_name, subject_account, subject_bvn, subject_type,
    amount_ngn, transaction_count, narrative,
    filed_by_user_id, filed_by_name,
    officer_user_id, officer_name,
    subject_dob, subject_address, transaction_type, transaction_date,
    linked_transaction_id, transaction_currency, transaction_narration,
    created_at, updated_at
  ) VALUES (
    inst_id, 'STR', 'STR-202505-0001',
    'Suspicious Transaction Report — BrightPath Investment Ltd (Round-Trip)',
    '2026-04-26', '2026-04-28', 'filed', 'high',
    now() - INTERVAL '12 days',
    'BrightPath Investment Ltd', '1001234567', '77890123456', 'corporate',
    19400000.00, 2,
    '₦9,800,000 wire transfer to Cayman Islands entity (BrightPath Offshore Ltd) on 2026-04-26, followed by ₦9,600,000 repatriation on 2026-04-28. Round-trip interval of 48 hours with near-equivalent amounts is a recognised typology for layering proceeds. Additionally, three sub-threshold transfers of approximately ₦490,000 each were detected on 2026-05-03, consistent with structuring. This entity has no disclosed operational reason for offshore portfolio activity. Case CASE-VNTG-001 opened.',
    admin_id, 'Vantage Demo Admin',
    analyst_id, 'Demo Analyst',
    '2018-06-01', 'Plot 15, Churchgate Towers, Abuja', 'NIP International Wire', '2026-04-26',
    'DEMO-TXN-023', 'USD', 'Investment capital transfer — offshore portfolio',
    now() - INTERVAL '12 days', now() - INTERVAL '12 days'
  );

  -- SAR-202505-0001: Adeyemi blocked offshore wires — filed
  INSERT INTO nfiu_reports (
    institution_id, report_type, reference, title,
    period_start, period_end, status, priority,
    filing_date, subject_name, subject_account, subject_bvn, subject_type,
    amount_ngn, transaction_count, narrative,
    filed_by_user_id, filed_by_name,
    officer_user_id, officer_name,
    subject_dob, subject_address, transaction_type, transaction_date,
    linked_transaction_id, transaction_currency, transaction_narration,
    created_at, updated_at
  ) VALUES (
    inst_id, 'SAR', 'SAR-202505-0001',
    'Suspicious Activity Report — Olusegun Adeyemi (Blocked Offshore Wires)',
    '2026-05-11', '2026-05-19', 'filed', 'high',
    now() - INTERVAL '5 days',
    'Olusegun Adeyemi', '0034567890', '22456789012', 'individual',
    7300000.00, 2,
    'Two attempted international wire transfers totalling ₦7,300,000 (USD equivalent) were blocked by the automated risk engine. First transfer of ₦5,200,000 to "Offshore Holdings BVI" on 2026-05-11 and second of ₦2,100,000 to an unnamed entity on 2026-05-19. Both transfers cited no purpose. Destination entities cannot be verified. This follows a previously filed STR (STR-202504-0001) for structuring activity on this account. Customer has refused to provide explanation. Account is under enhanced due diligence.',
    analyst_id, 'Demo Analyst',
    analyst_id, 'Demo Analyst',
    '1978-11-05', '7 Trans-Amadi Rd, Port Harcourt', 'NIP International Wire', '2026-05-11',
    'DEMO-TXN-021', 'USD', 'Offshore wire — unspecified purpose',
    now() - INTERVAL '5 days', now() - INTERVAL '5 days'
  );

  -- CTR-202505-0001: BrightPath ₦9.8M cash transfer — acknowledged
  INSERT INTO nfiu_reports (
    institution_id, report_type, reference, title,
    period_start, period_end, status, priority,
    filing_date, subject_name, subject_account, subject_bvn, subject_type,
    amount_ngn, transaction_count, narrative,
    filed_by_user_id, filed_by_name, acknowledgement_ref,
    officer_user_id, officer_name,
    subject_dob, subject_address, transaction_type, transaction_date,
    linked_transaction_id, transaction_currency, transaction_narration,
    created_at, updated_at
  ) VALUES (
    inst_id, 'CTR', 'CTR-202504-0001',
    'Currency Transaction Report — BrightPath Investment Ltd (₦9.8M Wire)',
    '2026-04-26', '2026-04-26', 'acknowledged', 'medium',
    now() - INTERVAL '25 days',
    'BrightPath Investment Ltd', '1001234567', '77890123456', 'corporate',
    9800000.00, 1,
    'Single international wire transfer of ₦9,800,000 to Cayman Islands entity exceeds the mandatory CTR threshold of ₦5,000,000 per CBN AML/CFT Regulations. Filed as required under Section 6.2. Separate STR filed due to round-trip indicators.',
    admin_id, 'Vantage Demo Admin', 'NFIU-ACK-2026-04-CTR-0001',
    admin_id, 'Vantage Demo Admin',
    '2018-06-01', 'Plot 15, Churchgate Towers, Abuja', 'NIP International Wire', '2026-04-26',
    'DEMO-TXN-023', 'USD', 'Investment capital transfer — offshore portfolio',
    now() - INTERVAL '25 days', now() - INTERVAL '19 days'
  );

  -- AML_RETURN for April 2026 — acknowledged
  INSERT INTO nfiu_reports (
    institution_id, report_type, reference, title,
    period_start, period_end, status, priority,
    filing_date, transaction_count, amount_ngn, narrative,
    filed_by_user_id, filed_by_name, acknowledgement_ref,
    officer_user_id, officer_name,
    created_at, updated_at
  ) VALUES (
    inst_id, 'AML_RETURN', 'AML_RETURN-202604-0001',
    'Monthly AML Return — April 2026',
    '2026-04-01', '2026-04-30', 'acknowledged', 'low',
    now() - INTERVAL '22 days',
    14, 28650000.00,
    'Monthly AML return for April 2026. Total transactions monitored: 14. Flagged for review: 5. STR filed: 1 (STR-202504-0001). CTR filed: 1 (CTR-202504-0001). No new PEP relationships identified. Risk appetite thresholds reviewed and within policy limits. Next return due: 2026-05-31.',
    admin_id, 'Vantage Demo Admin', 'NFIU-ACK-2026-04-RETURN-001',
    admin_id, 'Vantage Demo Admin',
    now() - INTERVAL '22 days', now() - INTERVAL '15 days'
  );

  -- AML_RETURN for March 2026 — acknowledged
  INSERT INTO nfiu_reports (
    institution_id, report_type, reference, title,
    period_start, period_end, status, priority,
    filing_date, transaction_count, amount_ngn, narrative,
    filed_by_user_id, filed_by_name, acknowledgement_ref,
    officer_user_id, officer_name,
    created_at, updated_at
  ) VALUES (
    inst_id, 'AML_RETURN', 'AML_RETURN-202603-0001',
    'Monthly AML Return — March 2026',
    '2026-03-01', '2026-03-31', 'acknowledged', 'low',
    now() - INTERVAL '52 days',
    8, 11200000.00,
    'Monthly AML return for March 2026. Total transactions monitored: 8. No transactions flagged above threshold. No STR or CTR filings this period. One dormant account reactivated (Olusegun Adeyemi) — placed under enhanced monitoring. All AML controls reviewed and operational.',
    admin_id, 'Vantage Demo Admin', 'NFIU-ACK-2026-03-RETURN-001',
    admin_id, 'Vantage Demo Admin',
    now() - INTERVAL '52 days', now() - INTERVAL '45 days'
  );

  -- AML_RETURN for May 2026 — draft (current month, in progress)
  INSERT INTO nfiu_reports (
    institution_id, report_type, reference, title,
    period_start, period_end, status, priority,
    transaction_count, amount_ngn, narrative,
    filed_by_user_id, filed_by_name,
    officer_user_id, officer_name,
    created_at, updated_at
  ) VALUES (
    inst_id, 'AML_RETURN', 'AML_RETURN-202605-0001',
    'Monthly AML Return — May 2026 (Draft)',
    '2026-05-01', '2026-05-31', 'draft', 'medium',
    20, 47350000.00,
    'Draft AML return for May 2026. Period in progress. Transactions monitored to date: 20. Flagged: 8. Blocked: 3. STR filings in progress: 1 (STR-202505-0001 — BrightPath). SAR filings: 1 (SAR-202505-0001 — Adeyemi). Two cases escalated. Return to be finalised and filed by 2026-05-31.',
    admin_id, 'Vantage Demo Admin',
    admin_id, 'Vantage Demo Admin',
    now() - INTERVAL '2 days', now() - INTERVAL '2 days'
  );

  -- STR-202505-0002: BrightPath blocked ₦15M wire — draft
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
    inst_id, 'STR', 'STR-202505-0002',
    'Suspicious Transaction Report — BrightPath Investment Ltd (Blocked ₦15M Wire)',
    '2026-05-20', '2026-05-20', 'draft', 'high',
    'BrightPath Investment Ltd', '1001234567', '77890123456', 'corporate',
    15000000.00, 1,
    'DRAFT: ₦15,000,000 wire transfer to unnamed offshore bank automatically blocked on 2026-05-20 (risk score: 92). Entity has two prior blocked international transfers within 30 days (see CASE-VNTG-001 and CASE-VNTG-005). Destination account could not be verified. SAR filing consideration pending compliance officer review.',
    analyst_id, 'Demo Analyst',
    analyst_id, 'Demo Analyst',
    '2018-06-01', 'Plot 15, Churchgate Towers, Abuja', 'NIP International Wire', '2026-05-20',
    'DEMO-TXN-028', 'USD', 'Capital transfer — unspecified',
    now() - INTERVAL '3 days', now() - INTERVAL '3 days'
  );

  -- ── NFIU Schedules ────────────────────────────────────────────────────────
  INSERT INTO nfiu_schedules (
    institution_id, report_type, name, frequency,
    next_due, last_filed_at, is_active, auto_file, created_by
  ) VALUES
  (inst_id, 'AML_RETURN', 'Monthly AML Return', 'monthly',    '2026-05-31', now() - INTERVAL '22 days', TRUE,  FALSE, admin_id),
  (inst_id, 'STR',        'STR Filing Review',   'monthly',    '2026-05-31', now() - INTERVAL '12 days', TRUE,  FALSE, admin_id),
  (inst_id, 'CTR',        'CTR Filing Review',   'monthly',    '2026-05-31', now() - INTERVAL '25 days', TRUE,  FALSE, admin_id),
  (inst_id, 'SAR',        'SAR Annual Review',   'quarterly',  '2026-06-30', now() - INTERVAL '5 days',  TRUE,  FALSE, admin_id),
  (inst_id, 'ITF',        'Annual ITF Return',   'annually',   '2026-12-31', NULL,                        TRUE,  FALSE, admin_id),
  (inst_id, 'PEP',        'PEP Screening Report','quarterly',  '2026-06-30', NULL,                        TRUE,  FALSE, admin_id);

  -- ── NFIU Legacy Returns ────────────────────────────────────────────────────
  INSERT INTO nfiu_returns (
    institution_id, reference, period_from, period_to,
    total_transactions, flagged_count, total_flagged_amount,
    filed_by, status, submitted_at
  ) VALUES
  (inst_id, 'RET-2026-04-VNTG', '2026-04-01', '2026-04-30', 14, 5, 28650000.00, admin_id, 'acknowledged', now() - INTERVAL '22 days'),
  (inst_id, 'RET-2026-03-VNTG', '2026-03-01', '2026-03-31',  8, 0,        0.00, admin_id, 'acknowledged', now() - INTERVAL '52 days'),
  (inst_id, 'RET-2026-02-VNTG', '2026-02-01', '2026-02-28',  6, 0,        0.00, admin_id, 'submitted',    now() - INTERVAL '83 days');

  -- ── Institution alerts ─────────────────────────────────────────────────────
  INSERT INTO institution_alerts (institution_id, alert_type, title, message, severity, status, created_at) VALUES
  (
    inst_id, 'high_risk_transaction',
    'Blocked: High-Value Offshore Wire — BrightPath Investment Ltd',
    'A ₦15,000,000 wire transfer to an unnamed offshore entity was automatically blocked (risk score: 92). This is the second blocked international transfer for this account in 30 days. Immediate compliance review required. Case CASE-VNTG-005 is open.',
    'critical', 'open', now() - INTERVAL '3 days'
  ),
  (
    inst_id, 'structuring_detected',
    'Structuring Pattern Detected — Olusegun Adeyemi',
    'Three transactions totalling ₦1,467,000 were executed within a 2-hour window, each below the ₦500,000 reporting threshold. Pattern consistent with structuring typology. Case CASE-VNTG-002 is escalated.',
    'high', 'open', now() - INTERVAL '10 days'
  ),
  (
    inst_id, 'round_trip_detected',
    'Round-Trip Transaction Alert — BrightPath Investment Ltd',
    'A ₦9,800,000 outbound wire was followed by a ₦9,600,000 inbound repatriation within 48 hours. Round-trip transaction pattern detected. Case CASE-VNTG-001 is under active investigation.',
    'high', 'acknowledged', now() - INTERVAL '18 days'
  ),
  (
    inst_id, 'velocity_alert',
    'BDC Velocity Alert — Chukwuemeka Nwachukwu',
    'Customer has executed 2 bureau de change transfers within 7 days totalling ₦1,200,000. Elevated monitoring applied. Case CASE-VNTG-004 is open.',
    'medium', 'open', now() - INTERVAL '6 days'
  );

END $$;
