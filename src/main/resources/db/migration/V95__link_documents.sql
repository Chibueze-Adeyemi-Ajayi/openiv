-- V95: Link entity tables to the documents table.
--
-- All existing columns are kept for backward compatibility; new uploads will
-- populate both the FK column and the denormalised URL column so reads remain
-- simple selects without a JOIN.

-- Users: track which document record represents the current avatar.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_document_id BIGINT REFERENCES documents(id);

-- Institutions: document records for official stamp and signature.
ALTER TABLE institutions
    ADD COLUMN IF NOT EXISTS stamp_document_id     BIGINT REFERENCES documents(id),
    ADD COLUMN IF NOT EXISTS signature_document_id BIGINT REFERENCES documents(id);

-- action_documents: new rows use a Cloudinary document_id; make BYTEA
-- nullable so old rows (with binary data) and new rows (URL only) can coexist.
ALTER TABLE action_documents
    ADD COLUMN IF NOT EXISTS document_id BIGINT REFERENCES documents(id);
ALTER TABLE action_documents
    ALTER COLUMN data DROP NOT NULL;

-- Customers: track document record for customer KYC photo.
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS photo_document_id BIGINT REFERENCES documents(id);
