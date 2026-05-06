-- Allow system-created evidence (added_by = NULL)
ALTER TABLE case_evidence
    DROP CONSTRAINT case_evidence_added_by_fkey;

ALTER TABLE case_evidence
    ALTER COLUMN added_by DROP NOT NULL;

ALTER TABLE case_evidence
    ADD CONSTRAINT case_evidence_added_by_fkey
        FOREIGN KEY (added_by) REFERENCES users(id);
