ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS nin   VARCHAR(11),
  ADD COLUMN IF NOT EXISTS photo TEXT;

COMMENT ON COLUMN customers.nin   IS 'National Identification Number (11 digits)';
COMMENT ON COLUMN customers.photo IS 'Base64-encoded customer photo for KYC verification';
