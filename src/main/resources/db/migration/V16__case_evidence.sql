-- Evidence items attached to a case (transaction, KYC, behaviour, device, OTP/fingerprint, etc.)
CREATE TABLE IF NOT EXISTS case_evidence (
    id          BIGSERIAL   PRIMARY KEY,
    case_id     TEXT        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    added_by    BIGINT      NOT NULL REFERENCES users(id),
    category    TEXT        NOT NULL
                CHECK (category IN ('transaction','kyc','behavior','device','otp','document','other')),
    title       TEXT        NOT NULL,
    detail      TEXT,
    ref_id      TEXT,           -- e.g. transaction ID for category='transaction'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON case_evidence(case_id);

-- Extend the allowed actions on the activity log to include evidence events
ALTER TABLE case_activity
    DROP CONSTRAINT IF EXISTS case_activity_action_check;

ALTER TABLE case_activity
    ADD CONSTRAINT case_activity_action_check
    CHECK (action IN (
        'opened','status_changed','note_added',
        'transaction_linked','assigned','closed','evidence_added'
    ));
