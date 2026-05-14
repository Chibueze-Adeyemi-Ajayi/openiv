-- Add pending_approval status and track who submitted the report for approval
ALTER TABLE nfiu_reports
    ADD COLUMN IF NOT EXISTS submitted_by_user_id BIGINT,
    ADD COLUMN IF NOT EXISTS submitted_by_name    VARCHAR(255),
    ADD COLUMN IF NOT EXISTS submitted_at         TIMESTAMP WITH TIME ZONE;
