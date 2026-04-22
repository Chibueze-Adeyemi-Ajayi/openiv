-- V3: allow a short-lived `password_reset_token` purpose in verification_codes.
--
-- We reuse the verification_codes table for the two-phase reset flow:
--   1. `password_reset` (step 1): the 6-digit code we email to the user.
--   2. `password_reset_token` (step 2): an opaque high-entropy token issued after step 1's
--      code is consumed, required to finalize the reset in step 3. Short TTL.
--
-- Splitting these into two rows lets the UI give "code is wrong" feedback the moment the
-- user hits Continue in step 2, without holding the plaintext password until step 3.

ALTER TABLE verification_codes DROP CONSTRAINT verification_codes_purpose_check;
ALTER TABLE verification_codes ADD CONSTRAINT verification_codes_purpose_check
    CHECK (purpose IN ('email_verification', 'password_reset', 'password_reset_token'));
