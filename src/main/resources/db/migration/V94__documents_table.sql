-- V94: Central document store backed by Cloudinary.
--
-- Every uploaded file (avatar, stamp, signature, compliance evidence, customer
-- photo) gets a row here containing its Cloudinary public_id, HTTPS URL, and
-- file metadata.  Entity tables then carry a *_document_id FK so the link is
-- navigable in both directions.

CREATE TABLE documents (
    id                   BIGSERIAL    PRIMARY KEY,
    institution_id       BIGINT       NOT NULL REFERENCES institutions(id),
    uploaded_by          BIGINT       REFERENCES users(id),
    cloudinary_public_id TEXT         NOT NULL,
    url                  TEXT         NOT NULL,
    filename             TEXT,
    content_type         TEXT,
    size_bytes           BIGINT,
    resource_type        TEXT,       -- 'image' | 'raw' | 'video'
    format               TEXT,       -- 'jpg' | 'png' | 'pdf' | …
    width                INT,
    height               INT,
    entity_type          TEXT,       -- 'avatar' | 'stamp' | 'signature' | 'action_document' | 'customer_photo'
    entity_id            TEXT,       -- stringified ID of the linked entity
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_documents_institution ON documents(institution_id);
CREATE INDEX ix_documents_entity      ON documents(entity_type, entity_id);
