-- Add pending_biometric_challenge to the sessions.state check constraint.
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_state_check;

ALTER TABLE sessions
    ADD CONSTRAINT sessions_state_check CHECK (state IN (
        'pending_email_verification',
        'must_change_password',
        'pending_totp_setup',
        'pending_totp_challenge',
        'pending_biometric_setup',
        'pending_biometric_challenge',
        'authenticated',
        'geo_blocked'
    ));
