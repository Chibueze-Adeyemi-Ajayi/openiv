-- V4: every user has an account_type. One of INDIVIDUAL, COMPANY, REGULATOR.
-- Pre-assigned on the invitation and copied onto the user at claim time.
--
-- We use TEXT + CHECK rather than a Postgres ENUM because ENUMs are a pain to evolve:
-- adding or renaming a value requires ALTER TYPE with transaction semantics that don't play
-- nicely with concurrent transactions. CHECK is cheap to change (one migration per edit).

ALTER TABLE invitations ADD COLUMN account_type TEXT NOT NULL DEFAULT 'INDIVIDUAL'
    CHECK (account_type IN ('INDIVIDUAL', 'COMPANY', 'REGULATOR'));

ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'INDIVIDUAL'
    CHECK (account_type IN ('INDIVIDUAL', 'COMPANY', 'REGULATOR'));

-- Drop the defaults so every new row MUST declare one. Existing rows (seeded dev invite, etc.)
-- already got the INDIVIDUAL default from the ADD COLUMN above — that's fine.
ALTER TABLE invitations ALTER COLUMN account_type DROP DEFAULT;
ALTER TABLE users ALTER COLUMN account_type DROP DEFAULT;
