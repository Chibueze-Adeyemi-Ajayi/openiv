-- V5: every user belongs to one institution. Plus a public access-request channel for new
-- institutions to onboard themselves.
--
-- Cardinality: users N → 1 institution. An institution may carry many users; a user may carry
-- exactly one institution (FK is NOT NULL after backfill below).
--
-- The institution carries its own `type` mirroring AccountType; we keep `users.account_type`
-- too because in some flows (REGULATOR shadowing a COMPANY's data, future SSO joins) a user's
-- effective account type can diverge from their institution's. For now the two are expected
-- to match — enforced at the service layer on user creation.

CREATE TABLE institutions (
    id           BIGSERIAL    PRIMARY KEY,
    name         TEXT         NOT NULL,
    type         TEXT         NOT NULL CHECK (type IN ('INDIVIDUAL', 'COMPANY', 'REGULATOR')),
    status       TEXT         NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'suspended')),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Default institution so existing seed/dev rows have somewhere to point. Kept as id=1 by the
-- BIGSERIAL allocator; setval below is a belt-and-braces sync after explicit ID inserts elsewhere
-- have a chance to land in the future.
INSERT INTO institutions (name, type) VALUES ('OpenIV (default)', 'INDIVIDUAL');

ALTER TABLE users ADD COLUMN institution_id BIGINT REFERENCES institutions(id);
UPDATE users SET institution_id = (SELECT id FROM institutions WHERE name = 'OpenIV (default)')
    WHERE institution_id IS NULL;
ALTER TABLE users ALTER COLUMN institution_id SET NOT NULL;
CREATE INDEX ix_users_institution_id ON users(institution_id);

ALTER TABLE invitations ADD COLUMN institution_id BIGINT REFERENCES institutions(id);
UPDATE invitations SET institution_id = (SELECT id FROM institutions WHERE name = 'OpenIV (default)')
    WHERE institution_id IS NULL;
ALTER TABLE invitations ALTER COLUMN institution_id SET NOT NULL;
CREATE INDEX ix_invitations_institution_id ON invitations(institution_id);

-- Self-service onboarding requests. Anyone (no auth) can submit; an admin reviews and either
-- creates an Institution + Invitation pair, or rejects.
CREATE TABLE access_requests (
    id                  BIGSERIAL    PRIMARY KEY,
    institution_name    TEXT         NOT NULL,
    institution_type    TEXT         NOT NULL
                                     CHECK (institution_type IN ('INDIVIDUAL', 'COMPANY', 'REGULATOR')),
    contact_name        TEXT         NOT NULL,
    contact_email       CITEXT       NOT NULL,
    contact_phone       TEXT,
    description         TEXT,
    status              TEXT         NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending', 'approved', 'rejected')),
    review_notes        TEXT,
    reviewed_at         TIMESTAMPTZ,
    reviewed_by_user_id BIGINT       REFERENCES users(id),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_access_requests_status ON access_requests(status);
CREATE INDEX ix_access_requests_email ON access_requests(contact_email);
