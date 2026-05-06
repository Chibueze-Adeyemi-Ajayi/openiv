-- Case notification email list for AML settings
CREATE TABLE IF NOT EXISTS case_notification_emails (
    id              BIGSERIAL       PRIMARY KEY,
    aml_settings_id BIGINT          NOT NULL REFERENCES aml_settings(id) ON DELETE CASCADE,
    email           VARCHAR(255)    NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX ON case_notification_emails(aml_settings_id);
CREATE UNIQUE INDEX ON case_notification_emails(aml_settings_id, email);
