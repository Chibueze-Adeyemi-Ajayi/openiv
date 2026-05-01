-- Eureka companion toggle: per-user preference, default ON
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS eureka_companion_enabled BOOLEAN NOT NULL DEFAULT TRUE;
