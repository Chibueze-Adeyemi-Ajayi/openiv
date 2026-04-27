-- V26: Convert sessions.ip from INET → TEXT
--
-- V2 created the column as INET; V25 tried ADD COLUMN IF NOT EXISTS ip TEXT
-- which was silently skipped because the column already existed as INET.
-- The Vert.x PG client returns INET columns as Inet objects, not Strings,
-- causing ClassCastException in SessionRepository.map().
ALTER TABLE sessions ALTER COLUMN ip TYPE TEXT USING ip::TEXT;
