-- V7: Save geolocation data for sessions.
-- This helps in auditing and fraud detection for sensitive applications.

ALTER TABLE sessions
    ADD COLUMN lat      DOUBLE PRECISION,
    ADD COLUMN lon      DOUBLE PRECISION,
    ADD COLUMN accuracy DOUBLE PRECISION;
