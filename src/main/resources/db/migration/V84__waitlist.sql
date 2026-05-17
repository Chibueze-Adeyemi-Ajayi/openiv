CREATE TABLE IF NOT EXISTS waitlist (
    id          BIGSERIAL    PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    email       VARCHAR(320) NOT NULL,
    description TEXT,
    source      VARCHAR(50)  NOT NULL DEFAULT 'landing_page',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waitlist_email_idx      ON waitlist (email);
CREATE INDEX IF NOT EXISTS waitlist_created_at_idx ON waitlist (created_at DESC);
