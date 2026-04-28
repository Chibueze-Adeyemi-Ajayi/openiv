-- V28: Enrich otp_alerts with context needed for the real-time OTP alert UI.
--
-- New fields:
--   customer_name      — display name for hold-and-call agent scripts
--   msisdn             — masked phone number of the customer
--   ip                 — IP address of the OTP request (transaction location proxy)
--   txn_lat / txn_lng  — GPS coordinates from the OTP beam payload (where the OTP was triggered)
--   amount             — transaction amount being OTP-protected (drives triage priority)
--   beneficiary_account— beneficiary account string; first-time beneficiary is a key fraud signal
--   device_model       — human-readable device label for the alert card
--   transaction_id     — link back to the protected transaction
--   risk_score         — 0-100 score computed by the rule engine at alert creation
--   reasons            — array of human-readable reason strings for the alert card
--   status             — lifecycle: pending → held | released | declined
--   expires_at         — auto-decline deadline (fired_at + 5 min by default)
--   customer_lat/lng   — customer's usual GPS location (looked up from location beam stream)
--   distance_km        — haversine distance between customer location and txn location

ALTER TABLE otp_alerts
  ADD COLUMN IF NOT EXISTS customer_name       TEXT,
  ADD COLUMN IF NOT EXISTS msisdn              TEXT,
  ADD COLUMN IF NOT EXISTS ip                  TEXT,
  ADD COLUMN IF NOT EXISTS txn_lat             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS txn_lng             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS amount              BIGINT,
  ADD COLUMN IF NOT EXISTS beneficiary_account TEXT,
  ADD COLUMN IF NOT EXISTS device_model        TEXT,
  ADD COLUMN IF NOT EXISTS transaction_id      TEXT,
  ADD COLUMN IF NOT EXISTS risk_score          INT      NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS reasons             TEXT[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status              TEXT     NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','held','released','declined')),
  ADD COLUMN IF NOT EXISTS expires_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_lat        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS customer_lng        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS distance_km         INT;

-- Back-fill expires_at for any existing rows (5-minute hold window)
UPDATE otp_alerts SET expires_at = fired_at + interval '5 minutes' WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS otp_alerts_status ON otp_alerts (institution_id, status, fired_at DESC);
