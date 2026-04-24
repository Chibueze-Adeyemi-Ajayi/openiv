-- AML Case Management: cases, linked transactions, and immutable activity log

CREATE SEQUENCE IF NOT EXISTS case_seq;

CREATE TABLE IF NOT EXISTS cases (
    id             TEXT PRIMARY KEY,
    institution_id BIGINT NOT NULL REFERENCES institutions(id),
    title          TEXT NOT NULL,
    typology       TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'investigating', 'escalated', 'closed')),
    priority       TEXT NOT NULL DEFAULT 'medium'
                       CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    risk_score     INT  NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    assigned_to    BIGINT REFERENCES users(id),
    notes          TEXT,
    resolution     TEXT CHECK (resolution IN ('cleared', 'sar_filed', 'referred')),
    created_by     BIGINT NOT NULL REFERENCES users(id),
    sla_deadline   TIMESTAMPTZ NOT NULL,
    closed_at      TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Many-to-many link between cases and real transaction records
CREATE TABLE IF NOT EXISTS case_transactions (
    case_id        TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    linked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (case_id, transaction_id)
);

-- Immutable append-only audit log (regulators may request this)
CREATE TABLE IF NOT EXISTS case_activity (
    id         BIGSERIAL PRIMARY KEY,
    case_id    TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    actor_id   BIGINT NOT NULL REFERENCES users(id),
    action     TEXT NOT NULL CHECK (action IN (
                   'opened', 'status_changed', 'note_added',
                   'transaction_linked', 'assigned', 'closed')),
    detail     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cases_inst_status  ON cases(institution_id, status);
CREATE INDEX IF NOT EXISTS cases_inst_sla     ON cases(institution_id, sla_deadline);
CREATE INDEX IF NOT EXISTS cases_inst_created ON cases(institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS case_activity_case ON case_activity(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS case_txn_txn       ON case_transactions(transaction_id);
