ALTER TABLE nfiu_reports
    ADD COLUMN IF NOT EXISTS linked_transaction_id      TEXT,
    ADD COLUMN IF NOT EXISTS transaction_location       TEXT,
    ADD COLUMN IF NOT EXISTS transaction_lat            DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS transaction_lng            DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS transaction_sender_account VARCHAR(100),
    ADD COLUMN IF NOT EXISTS transaction_sender_bank    VARCHAR(255),
    ADD COLUMN IF NOT EXISTS transaction_recipient_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS transaction_recipient_account VARCHAR(100),
    ADD COLUMN IF NOT EXISTS transaction_recipient_bank VARCHAR(255),
    ADD COLUMN IF NOT EXISTS transaction_currency       VARCHAR(10),
    ADD COLUMN IF NOT EXISTS transaction_narration      TEXT;
