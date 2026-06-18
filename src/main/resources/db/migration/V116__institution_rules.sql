-- Institution-defined rule functions (Nomos engine)
-- Rules are authored in plain English, LLM generates a JS function,
-- compiled to WASM and stored as binary. Actions define what happens when triggered.
CREATE TABLE institution_rules (
    id                  BIGSERIAL PRIMARY KEY,
    institution_id      BIGINT        NOT NULL,
    name                VARCHAR(255)  NOT NULL,
    policy_statement    TEXT          NOT NULL,
    comprehension       JSONB,
    function_source     TEXT,
    function_wasm       BYTEA,
    actions             JSONB         NOT NULL DEFAULT '{
        "holdTransaction": true,
        "openCase":        {"enabled": false, "severity": "medium"},
        "fileReport":      {"enabled": false, "reportType": "STR"},
        "notifyRoles":     []
    }'::jsonb,
    status              VARCHAR(32)   NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','pending_approval','active','retired')),
    created_by          VARCHAR(255),
    approved_by         VARCHAR(255),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_institution_rules_institution ON institution_rules (institution_id);
CREATE INDEX idx_institution_rules_status      ON institution_rules (institution_id, status);
