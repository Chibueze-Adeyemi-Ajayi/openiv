-- NFIU (Nigerian Financial Intelligence Unit) Suspicious Transaction Report filings.
-- Each row represents one daily return filed by a compliance officer.

CREATE TABLE nfiu_returns (
  id                  BIGSERIAL    PRIMARY KEY,
  institution_id      BIGINT       NOT NULL REFERENCES institutions(id),
  reference           TEXT         NOT NULL UNIQUE,
  period_from         DATE         NOT NULL,
  period_to           DATE         NOT NULL,
  total_transactions  BIGINT       NOT NULL DEFAULT 0,
  flagged_count       INT          NOT NULL DEFAULT 0,
  total_flagged_amount NUMERIC(24, 2) NOT NULL DEFAULT 0,
  filed_by            BIGINT       NOT NULL REFERENCES users(id),
  status              TEXT         NOT NULL DEFAULT 'pending_review'
                                   CHECK (status IN ('pending_review', 'submitted', 'acknowledged')),
  submitted_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX nfiu_returns_inst ON nfiu_returns (institution_id, submitted_at DESC);
