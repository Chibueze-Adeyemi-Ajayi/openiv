-- Stores the plain-English reason why a transaction was automatically flagged
-- by the fraud detection engine. Shown to compliance officers in the transaction panel.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS flag_reason TEXT;
