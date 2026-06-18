CREATE TABLE webauthn_credentials (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    credential_id   BYTEA NOT NULL UNIQUE,
    public_key_der  BYTEA NOT NULL,
    sign_count      BIGINT NOT NULL DEFAULT 0,
    aaguid          VARCHAR(36),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ
);
CREATE INDEX idx_webauthn_credentials_user ON webauthn_credentials (user_id);
