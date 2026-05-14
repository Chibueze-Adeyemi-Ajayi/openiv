-- Institution: add regulatory profile fields required for NFIU report Section A
ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS cbn_code      TEXT,
  ADD COLUMN IF NOT EXISTS address       TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- NFIU reports: extended fields for officer, full subject detail, and transaction detail
ALTER TABLE nfiu_reports
  ADD COLUMN IF NOT EXISTS officer_user_id  BIGINT,
  ADD COLUMN IF NOT EXISTS officer_name     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS subject_dob      DATE,
  ADD COLUMN IF NOT EXISTS subject_address  TEXT,
  ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS transaction_date DATE;
