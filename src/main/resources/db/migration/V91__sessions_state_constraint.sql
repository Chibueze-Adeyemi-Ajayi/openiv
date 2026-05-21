-- Widen the sessions.state check constraint to include all valid states.
-- The original V2 constraint only listed 4 states; geo_blocked and must_change_password
-- were added without updating it.
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_state_check;

ALTER TABLE sessions
    ADD CONSTRAINT sessions_state_check CHECK (state IN (
        'pending_email_verification',
        'must_change_password',
        'pending_totp_setup',
        'pending_totp_challenge',
        'authenticated',
        'geo_blocked'
    ));
