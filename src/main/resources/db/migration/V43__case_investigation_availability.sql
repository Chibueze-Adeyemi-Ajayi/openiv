-- Add investigation availability tracking to cases
ALTER TABLE cases
    ADD COLUMN is_available_for_investigation BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX ON cases(institution_id, is_available_for_investigation);
