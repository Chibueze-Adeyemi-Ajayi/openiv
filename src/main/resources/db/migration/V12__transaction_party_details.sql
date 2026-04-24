ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS sender_account    TEXT,
  ADD COLUMN IF NOT EXISTS sender_bank       TEXT,
  ADD COLUMN IF NOT EXISTS recipient_name    TEXT,
  ADD COLUMN IF NOT EXISTS recipient_account TEXT,
  ADD COLUMN IF NOT EXISTS recipient_bank    TEXT,
  ADD COLUMN IF NOT EXISTS currency          TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS narration         TEXT,
  ADD COLUMN IF NOT EXISTS device_id         TEXT,
  ADD COLUMN IF NOT EXISTS ip_address        TEXT;

-- Back-fill seed rows with realistic Nigerian banking party data.
UPDATE transactions SET
  sender_account = '0124567890', sender_bank = 'Access Bank',
  recipient_name = 'Sokoto BDC Ltd', recipient_account = '0034567891', recipient_bank = 'Guaranty Trust Bank',
  narration = 'FX Settlement — USD Purchase Authorization',
  device_id = 'dev_a1b2c3d4e5', ip_address = '102.89.45.67'
WHERE id = 'TXN-48721';

UPDATE transactions SET
  sender_account = '0587432190', sender_bank = 'Zenith Bank',
  recipient_name = 'PiggyVest Financial Inc.', recipient_account = '0198765432', recipient_bank = 'Wema Bank',
  narration = 'Savings transfer via PiggyVest',
  device_id = 'mob_ios_b2c3d4e5', ip_address = '41.203.78.91'
WHERE id = 'TXN-48720';

UPDATE transactions SET
  sender_account = '0374512680', sender_bank = 'First Bank of Nigeria',
  recipient_name = 'Unknown Beneficiary', recipient_account = '7654321098', recipient_bank = 'Unknown',
  narration = 'Business Payment — No Further Details',
  device_id = 'dev_c3d4e5f6g7', ip_address = '105.112.9.180'
WHERE id = 'TXN-48719';

UPDATE transactions SET
  sender_account = '0423198765', sender_bank = 'Guaranty Trust Bank',
  recipient_name = 'Shoprite Retail Nigeria Ltd', recipient_account = 'TERM-00123456', recipient_bank = 'PoS Terminal',
  narration = 'PoS Purchase — Shoprite Lekki Phase 1',
  device_id = 'pos_terminal_003421', ip_address = '41.58.12.44'
WHERE id = 'TXN-48718';

UPDATE transactions SET
  sender_account = '0512345678', sender_bank = 'United Bank for Africa',
  recipient_name = 'Cayman Holdings International Ltd', recipient_account = 'CY-00098765', recipient_bank = 'Cayman National Bank',
  narration = 'Offshore Investment — Portfolio Rebalancing Q1',
  device_id = 'dev_d4e5f6g7h8', ip_address = '198.71.233.12'
WHERE id = 'TXN-48717';

UPDATE transactions SET
  sender_account = '0698712345', sender_bank = 'Polaris Bank',
  recipient_name = 'MTN Nigeria Communications Ltd', recipient_account = 'MTN-08061234567', recipient_bank = 'MTN MoMo',
  narration = 'Airtime and data bundle purchase',
  device_id = 'mob_and_e5f6g7h8', ip_address = '197.210.64.77'
WHERE id = 'TXN-48716';

UPDATE transactions SET
  sender_account = '0743219876', sender_bank = 'Fidelity Bank',
  recipient_name = 'Ade Ventures Nigeria Ltd', recipient_account = '0156789023', recipient_bank = 'Stanbic IBTC Bank',
  narration = 'Contract Payment — Q1 2026 Consulting Services',
  device_id = 'dev_f6g7h8i9j0', ip_address = '41.78.102.55'
WHERE id = 'TXN-48715';

UPDATE transactions SET
  sender_account = '0856432109', sender_bank = 'Ecobank Nigeria',
  recipient_name = 'Slot Systems Nigeria Ltd', recipient_account = 'TERM-00789012', recipient_bank = 'PoS Terminal',
  narration = 'Electronics purchase — SLOT Enugu Mall',
  device_id = 'pos_terminal_005678', ip_address = '105.113.92.18'
WHERE id = 'TXN-48714';

UPDATE transactions SET
  sender_account = '0918273645', sender_bank = 'Keystone Bank',
  recipient_name = 'Katsina FX Bureau de Change Ltd', recipient_account = '0237684910', recipient_bank = 'Access Bank',
  narration = 'BDC Currency Purchase — USD and GBP',
  device_id = 'dev_g7h8i9j0k1', ip_address = '196.3.26.91'
WHERE id = 'TXN-48713';

UPDATE transactions SET
  sender_account = '0132456789', sender_bank = 'Sterling Bank',
  recipient_name = 'Bolt Operations Nigeria Ltd', recipient_account = '0398127564', recipient_bank = 'First Bank of Nigeria',
  narration = 'Driver earnings disbursement — Bolt Nigeria',
  device_id = 'mob_ios_h8i9j0k1', ip_address = '105.184.73.29'
WHERE id = 'TXN-48712';
