-- V6: user.role + user.full_name, aligned with the team-management UI's six canonical roles.
--
-- Role values match the frontend enum in TeamPage.tsx / RoleEditor.tsx:
--   admin     — org admin (billing, integrations, team)
--   cco       — Chief Compliance Officer (NFIU reports, STR sign-off)
--   analyst   — Fraud Analyst (default for new members)
--   developer — API / integrations engineer
--   viewer    — read-only auditor
--   regulator — external supervisor (CBN, NFIU, NDIC)

-- 1. Tighten invitations.role. The earlier V2 migration allowed free-form text with default
--    'customer'; bring existing rows in line with the new enum before adding the CHECK.
UPDATE invitations
    SET role = 'analyst'
    WHERE role NOT IN ('admin','cco','analyst','developer','viewer','regulator');

ALTER TABLE invitations
    ALTER COLUMN role SET DEFAULT 'analyst',
    ADD CONSTRAINT invitations_role_check
        CHECK (role IN ('admin','cco','analyst','developer','viewer','regulator'));

-- 2. Add role to users. Backfill existing rows (seed data, dev users) to 'analyst' before
--    adding NOT NULL. Drop the default afterwards so new rows must specify one explicitly.
ALTER TABLE users
    ADD COLUMN role TEXT NOT NULL DEFAULT 'analyst'
        CHECK (role IN ('admin','cco','analyst','developer','viewer','regulator'));
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;

-- 3. Optional display name. Nullable; the API falls back to the email local-part when null.
ALTER TABLE users ADD COLUMN full_name TEXT;
