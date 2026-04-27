-- V25: Per-device session fingerprinting, device blocking, session transfer tokens
--
-- Adds a device_id column to sessions (the UUID stored in the browser's localStorage).
-- Introduces blocked_devices so a banned fingerprint can never log in again.
-- session_transfer_tokens is a short-lived (5 min) coupon that lets a same-device
-- re-login complete with TOTP instead of requiring a full logout cycle.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_id    TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip           TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent   TEXT;

-- Fast lookup: "does this user have an active authenticated session on this device?"
CREATE INDEX IF NOT EXISTS ix_sessions_user_device
    ON sessions(user_id, device_id)
    WHERE revoked_at IS NULL;

-- ── Blocked devices ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_devices (
    id                  BIGSERIAL    PRIMARY KEY,
    institution_id      BIGINT       NOT NULL,
    user_id             BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id           TEXT         NOT NULL,
    ip_address          TEXT,
    user_agent          TEXT,
    reason              TEXT,
    blocked_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    blocked_by_user_id  BIGINT       REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uix_blocked_devices
    ON blocked_devices(user_id, device_id);

CREATE INDEX IF NOT EXISTS ix_blocked_devices_user
    ON blocked_devices(user_id);

-- ── Session-transfer tokens ───────────────────────────────────────────────────
-- Issued when a same-device login detects an existing session.
-- The browser presents this token + TOTP to claim the new session.
CREATE TABLE IF NOT EXISTS session_transfer_tokens (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT         NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_session_transfer_tokens_user
    ON session_transfer_tokens(user_id)
    WHERE used_at IS NULL;
