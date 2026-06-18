-- Nomos multi-role approval workflow
-- Extends institution_rules with developer review, CCO edit approval, and IT vetting stages.

-- Expand the status check to cover the new pipeline states.
-- Postgres auto-names inline column constraints as {table}_{col}_check.
ALTER TABLE institution_rules DROP CONSTRAINT IF EXISTS institution_rules_status_check;
ALTER TABLE institution_rules
    ADD CONSTRAINT institution_rules_status_check
    CHECK (status IN (
        'draft',
        'pending_approval',
        'pending_dev_review',
        'pending_cco_approval',
        'pending_it_vetting',
        'active',
        'retired'
    ));

-- Developer-review stage
ALTER TABLE institution_rules ADD COLUMN IF NOT EXISTS dev_edited_source TEXT;
ALTER TABLE institution_rules ADD COLUMN IF NOT EXISTS dev_reviewed_by   VARCHAR(255);
ALTER TABLE institution_rules ADD COLUMN IF NOT EXISTS review_note        TEXT;

-- IT-vetting stage
ALTER TABLE institution_rules ADD COLUMN IF NOT EXISTS it_vetted_by  VARCHAR(255);
ALTER TABLE institution_rules ADD COLUMN IF NOT EXISTS test_results   JSONB;
