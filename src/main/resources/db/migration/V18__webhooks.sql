-- Webhook endpoints registered per institution
CREATE TABLE webhook_endpoints (
    id              BIGSERIAL   PRIMARY KEY,
    institution_id  BIGINT      NOT NULL REFERENCES institutions(id),
    url             TEXT        NOT NULL,
    description     TEXT,
    events          TEXT        NOT NULL DEFAULT '',   -- comma-separated event IDs
    status          TEXT        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'paused')),
    created_by      BIGINT      NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One HMAC-SHA256 signing secret per institution (rotatable)
CREATE TABLE webhook_secrets (
    id              BIGSERIAL   PRIMARY KEY,
    institution_id  BIGINT      NOT NULL UNIQUE REFERENCES institutions(id),
    secret          TEXT        NOT NULL,
    auto_rotate     BOOLEAN     NOT NULL DEFAULT true,
    next_rotation   TIMESTAMPTZ NOT NULL DEFAULT now() + interval '90 days',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Delivery log — immutable record of every outbound request attempt
CREATE TABLE webhook_deliveries (
    id              BIGSERIAL   PRIMARY KEY,
    endpoint_id     BIGINT      NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    institution_id  BIGINT      NOT NULL,
    event_type      TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'delivered', 'failed')),
    response_code   INT,
    attempt_count   INT         NOT NULL DEFAULT 1,
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON webhook_endpoints(institution_id, status);
CREATE INDEX ON webhook_deliveries(endpoint_id, created_at DESC);
CREATE INDEX ON webhook_deliveries(institution_id, created_at DESC);
