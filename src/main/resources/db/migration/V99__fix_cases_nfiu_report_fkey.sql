-- Fix: cases.linked_nfiu_report_id was mistakenly referencing nfiu_returns instead of nfiu_reports.
-- nfiu_returns is the legacy monthly return stub; the compliance reports (STR/CTR/SAR etc.)
-- live in nfiu_reports (created V32). Drop and re-add the foreign key to the correct table.

ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_linked_nfiu_report_id_fkey;

ALTER TABLE cases
    ADD CONSTRAINT cases_linked_nfiu_report_id_fkey
    FOREIGN KEY (linked_nfiu_report_id) REFERENCES nfiu_reports(id) ON DELETE SET NULL;
