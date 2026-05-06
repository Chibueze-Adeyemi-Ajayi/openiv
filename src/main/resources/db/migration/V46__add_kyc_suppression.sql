-- Add KYC suppression flag to institutions
ALTER TABLE institutions ADD COLUMN kyc_warning_suppressed BOOLEAN DEFAULT FALSE;
