-- V27: Supporting documents for compliance actions
--
-- Every status change on a transaction, every case opened, and every AML case
-- status transition must be accompanied by a written reason and a supporting
-- document. This migration creates the document store and adds the linking
-- columns to the three affected tables.

CREATE TABLE action_documents (
    id              BIGSERIAL    PRIMARY KEY,
    institution_id  BIGINT       NOT NULL,
    uploaded_by     BIGINT       NOT NULL REFERENCES users(id),
    filename        TEXT         NOT NULL,
    content_type    TEXT         NOT NULL,
    size_bytes      INT          NOT NULL,
    data            BYTEA        NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_action_docs_institution ON action_documents(institution_id, uploaded_by);

-- Transaction flagged-status changes now require a reason + document
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS status_reason      TEXT,
    ADD COLUMN IF NOT EXISTS status_document_id BIGINT REFERENCES action_documents(id);

-- Case activity entries can reference a supporting document
ALTER TABLE case_activity
    ADD COLUMN IF NOT EXISTS document_id BIGINT REFERENCES action_documents(id);

-- Case opening requires a reason + document
ALTER TABLE cases
    ADD COLUMN IF NOT EXISTS open_reason      TEXT,
    ADD COLUMN IF NOT EXISTS open_document_id BIGINT REFERENCES action_documents(id);
