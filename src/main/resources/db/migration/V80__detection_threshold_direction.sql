ALTER TABLE detection_thresholds
    ADD COLUMN IF NOT EXISTS direction VARCHAR(10) NOT NULL DEFAULT 'both';
