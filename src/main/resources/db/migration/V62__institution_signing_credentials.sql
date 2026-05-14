ALTER TABLE institutions
    ADD COLUMN IF NOT EXISTS official_stamp      TEXT,
    ADD COLUMN IF NOT EXISTS official_signature  TEXT;
