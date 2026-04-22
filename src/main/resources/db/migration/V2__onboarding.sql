-- V2: onboarding + auth schema.
--
-- Design notes:
--   * email columns use CITEXT so case-insensitive lookups / UNIQUE work without LOWER() dances.
--   * Nothing reversible is stored in plaintext: codes and tokens are always hashed at rest
--     (SHA-256 for the short-lived ones; Argon2id for the durable password).
--   * totp_secrets.secret is *plaintext base32* in this scaffold. Production MUST envelope-
--     encrypt this column via KMS (AWS KMS / Azure Key Vault / GCP KMS / Vault Transit). That
--     integration is environment-specific and has not been wired — see db/package-info.java.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
    id                     BIGSERIAL    PRIMARY KEY,
    email                  CITEXT       NOT NULL UNIQUE,
    email_verified         BOOLEAN      NOT NULL DEFAULT FALSE,
    password_hash          TEXT         NOT NULL,
    password_updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    must_change_password   BOOLEAN      NOT NULL DEFAULT FALSE,
    status                 TEXT         NOT NULL DEFAULT 'pending'
                                        CHECK (status IN ('pending', 'active', 'disabled', 'locked')),
    failed_login_attempts  INTEGER      NOT NULL DEFAULT 0,
    locked_until           TIMESTAMPTZ,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Invitations are pre-provisioned: an admin creates them, we issue the code out-of-band
-- (email, Slack, whatever), and the user claims it during first login.
CREATE TABLE invitations (
    id                   BIGSERIAL    PRIMARY KEY,
    code_hash            TEXT         NOT NULL UNIQUE,
    email                CITEXT       NOT NULL,
    role                 TEXT         NOT NULL DEFAULT 'customer',
    status               TEXT         NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at           TIMESTAMPTZ  NOT NULL,
    accepted_at          TIMESTAMPTZ,
    accepted_by_user_id  BIGINT       REFERENCES users(id),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_invitations_email ON invitations(email);

-- Short-lived codes: email verification, password reset.
CREATE TABLE verification_codes (
    id            BIGSERIAL    PRIMARY KEY,
    user_id       BIGINT       REFERENCES users(id) ON DELETE CASCADE,
    email         CITEXT       NOT NULL,
    code_hash     TEXT         NOT NULL,
    purpose       TEXT         NOT NULL
                               CHECK (purpose IN ('email_verification', 'password_reset')),
    expires_at    TIMESTAMPTZ  NOT NULL,
    consumed_at   TIMESTAMPTZ,
    attempts      INTEGER      NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_verification_codes_email_purpose_active
    ON verification_codes(email, purpose)
    WHERE consumed_at IS NULL;

-- One TOTP secret per user. `enabled=true` only after the user successfully proves possession.
CREATE TABLE totp_secrets (
    user_id      BIGINT       PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret       TEXT         NOT NULL,   -- TODO: envelope-encrypt via KMS for production
    enabled      BOOLEAN      NOT NULL DEFAULT FALSE,
    enabled_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Sessions are opaque bearer tokens. We store only the SHA-256 hash; revocation is atomic.
CREATE TABLE sessions (
    id             BIGSERIAL    PRIMARY KEY,
    user_id        BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash     TEXT         NOT NULL UNIQUE,
    state          TEXT         NOT NULL
                                CHECK (state IN ('pending_email_verification',
                                                 'pending_totp_setup',
                                                 'pending_totp_challenge',
                                                 'authenticated')),
    ip             INET,
    user_agent     TEXT,
    expires_at     TIMESTAMPTZ  NOT NULL,
    revoked_at     TIMESTAMPTZ,
    last_used_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_sessions_user_id ON sessions(user_id);
CREATE INDEX ix_sessions_expires_at ON sessions(expires_at) WHERE revoked_at IS NULL;
