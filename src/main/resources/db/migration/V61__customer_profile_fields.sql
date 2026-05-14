ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS bvn            VARCHAR(11),
    ADD COLUMN IF NOT EXISTS account_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS subject_type   VARCHAR(20),
    ADD COLUMN IF NOT EXISTS dob            DATE,
    ADD COLUMN IF NOT EXISTS address        TEXT;

COMMENT ON COLUMN customers.bvn            IS 'Bank Verification Number / NIN (11 digits)';
COMMENT ON COLUMN customers.account_number IS 'Primary NUBAN account number';
COMMENT ON COLUMN customers.subject_type   IS 'individual or corporate';
COMMENT ON COLUMN customers.dob            IS 'Date of birth (individual) or incorporation date (corporate)';
COMMENT ON COLUMN customers.address        IS 'Known residential or registered address';
