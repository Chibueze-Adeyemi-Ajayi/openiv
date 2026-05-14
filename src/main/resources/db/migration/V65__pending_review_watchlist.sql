-- AML case flow: add pending_review status, NFIU report linkage, and customer watchlisting

-- 1. Expand the cases status enum to include pending_review (L1 → L2 handoff)
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_status_check;
ALTER TABLE cases ADD CONSTRAINT cases_status_check
    CHECK (status IN ('open', 'investigating', 'escalated', 'pending_review', 'closed'));

-- 2. Link a filed NFIU report to a case for full traceability
ALTER TABLE cases
    ADD COLUMN IF NOT EXISTS linked_nfiu_report_id BIGINT REFERENCES nfiu_returns(id);

-- 3. Customer watchlisting — set when a case resolves with sar_filed or referred
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS watchlisted        BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS watchlisted_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS watchlisted_reason TEXT;

CREATE INDEX IF NOT EXISTS customers_watchlisted ON customers(institution_id) WHERE watchlisted = TRUE;
