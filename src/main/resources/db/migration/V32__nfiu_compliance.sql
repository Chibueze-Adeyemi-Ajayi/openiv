-- ─────────────────────────────────────────────────────────────────────────────
-- NFIU Compliance: reports (STR/CTR/SAR/ITF/PEP/AML_RETURN) + schedules
-- Reference format: {ABBREV}-{YYYYMM}-{NNNN}  e.g. STR-202604-0001
-- Status flow:      draft → filed → acknowledged | rejected
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE nfiu_reports (
    id                  BIGSERIAL    PRIMARY KEY,
    institution_id      BIGINT       NOT NULL REFERENCES institutions(id),
    report_type         VARCHAR(20)  NOT NULL
                            CHECK (report_type IN ('STR','CTR','SAR','ITF','PEP','AML_RETURN')),
    reference           VARCHAR(100) NOT NULL,
    title               VARCHAR(255) NOT NULL,
    period_start        DATE         NOT NULL,
    period_end          DATE         NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','filed','acknowledged','rejected')),
    priority            VARCHAR(10)  NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('low','medium','high')),
    filing_date         TIMESTAMPTZ,
    subject_name        VARCHAR(255),
    subject_account     VARCHAR(100),
    subject_bvn         VARCHAR(20),
    subject_type        VARCHAR(20)  CHECK (subject_type IN ('individual','corporate')),
    amount_ngn          NUMERIC(20,2),
    transaction_count   INTEGER      NOT NULL DEFAULT 0,
    narrative           TEXT,
    filed_by_user_id    BIGINT,
    filed_by_name       VARCHAR(255),
    acknowledgement_ref VARCHAR(100),
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX nfiu_reports_ref_idx    ON nfiu_reports (institution_id, reference);
CREATE        INDEX nfiu_reports_status_idx ON nfiu_reports (institution_id, status);
CREATE        INDEX nfiu_reports_type_idx   ON nfiu_reports (institution_id, report_type);
CREATE        INDEX nfiu_reports_period_idx ON nfiu_reports (institution_id, period_start DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Scheduled recurring filings
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE nfiu_schedules (
    id              BIGSERIAL    PRIMARY KEY,
    institution_id  BIGINT       NOT NULL REFERENCES institutions(id),
    report_type     VARCHAR(20)  NOT NULL
                        CHECK (report_type IN ('STR','CTR','SAR','ITF','PEP','AML_RETURN')),
    name            VARCHAR(255) NOT NULL,
    frequency       VARCHAR(20)  NOT NULL
                        CHECK (frequency IN ('monthly','quarterly','annually')),
    next_due        DATE         NOT NULL,
    last_filed_at   TIMESTAMPTZ,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    auto_file       BOOLEAN      NOT NULL DEFAULT false,
    created_by      BIGINT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX nfiu_schedules_inst_idx ON nfiu_schedules (institution_id);
CREATE INDEX nfiu_schedules_due_idx  ON nfiu_schedules (next_due) WHERE is_active = true;
