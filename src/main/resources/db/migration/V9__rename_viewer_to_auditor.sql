-- V9: Consolidate roles by renaming 'viewer' to 'auditor' and removing 'regulator'.

-- 1. Backfill existing rows. Any regulators or viewers become auditors.
UPDATE users SET role = 'auditor' WHERE role IN ('viewer', 'regulator');
UPDATE invitations SET role = 'auditor' WHERE role IN ('viewer', 'regulator');

-- 2. Update users check constraint.
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin', 'cco', 'analyst', 'developer', 'auditor'));

-- 3. Update invitations check constraint.
ALTER TABLE invitations DROP CONSTRAINT invitations_role_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_role_check 
    CHECK (role IN ('admin', 'cco', 'analyst', 'developer', 'auditor'));
