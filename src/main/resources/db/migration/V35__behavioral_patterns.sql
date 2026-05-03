CREATE TABLE behavioral_rules (
    id              BIGSERIAL    PRIMARY KEY,
    institution_id  BIGINT       NOT NULL,
    rule_id         VARCHAR(80)  NOT NULL,
    name            VARCHAR(200) NOT NULL,
    category        VARCHAR(50)  NOT NULL,
    severity        VARCHAR(20)  NOT NULL DEFAULT 'medium',
    description     TEXT         NOT NULL,
    example         TEXT         NOT NULL,
    matched_typology TEXT        NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    affected        INT          NOT NULL DEFAULT 0,
    emergence       VARCHAR(50)  NOT NULL DEFAULT 'Just now',
    params          JSONB        NOT NULL DEFAULT '{}',
    recommended_actions JSONB    NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (institution_id, rule_id)
);

CREATE INDEX ON behavioral_rules(institution_id);

-- Insert some default rules for institution 1 (assuming it's the main test institution)
INSERT INTO behavioral_rules (institution_id, rule_id, name, category, severity, description, example, matched_typology, is_active, affected, emergence, params, recommended_actions)
VALUES 
(1, 'pat-1', 'Same-IP cluster across unrelated accounts', 'Network', 'critical', 'Four customer accounts — none with prior relationship — all initiated wire transfers from the same IP block (102.89.32.0/24) within 18 minutes of each other.', 'Adamu I., Folake A., Bashir M., Tunde B. — all moved between ₦8M and ₦14M to recently-added beneficiaries.', 'Mule herding · NFIU Typology #SST-12', true, 4, '2 hours ago', '{"ip_count": 4, "timeframe_minutes": 18}', '[{"label": "Freeze all 4 accounts", "primary": true}, {"label": "Open joint case"}, {"label": "File NFIU STR"}]'),
(1, 'pat-2', 'Geographically impossible login', 'Geo', 'high', 'Customer logged in from Lagos at 13:42 and Abuja at 14:08 — physically impossible without supersonic travel. One session is using stolen credentials.', 'Folake Adesanya · ACC-2840', 'Account takeover · CBN Risk Code R-09', true, 1, '14 min ago', '{"distance_km": 500, "timeframe_hours": 2}', '[{"label": "Force re-authentication", "primary": true}, {"label": "Lock newer session"}, {"label": "Notify customer via SMS"}]'),
(1, 'pat-3', 'Device shared across customers', 'Device', 'high', 'Single device fingerprint (DVC-8b32a1) authenticated as 7 different customers in the past 24 hours — pattern matches credential-stuffing operation.', 'iPhone 14 Pro · IP rotated through 3 Lagos data centers', 'Credential stuffing · NFIU Typology #SST-04', true, 7, '6 hours ago', '{"user_count": 7, "timeframe_hours": 24}', '[{"label": "Block device fingerprint", "primary": true}, {"label": "Force MFA on affected accounts"}, {"label": "Alert all 7 customers"}]'),
(1, 'pat-4', 'Off-pattern activity bursts', 'Temporal', 'medium', '23 customers transacted between 02:00-04:00 — outside their personal baseline of activity. Pattern often precedes coordinated cash-out.', 'Avg ticket: ₦1.8M · 18 of 23 to first-time beneficiaries', 'Coordinated cash-out · CBN Watch List W-22', true, 23, '8 hours ago', '{"time_start": "02:00", "time_end": "04:00", "min_customers": 20}', '[{"label": "Tighten night-window threshold", "primary": true}, {"label": "Add to enhanced monitoring"}]'),
(1, 'pat-5', 'Velocity ring — same beneficiary', 'Velocity', 'high', '14 different customers sent funds to the same Kuda wallet (••• 4029) within 4 hours. Sub-threshold structuring — each transaction below ₦1M to avoid manual review.', 'Total flow: ₦9.4M · all marked as "personal gift" in narration', 'Smurfing · NFIU Typology #SST-07', true, 14, '12 hours ago', '{"customer_count": 14, "timeframe_hours": 4}', '[{"label": "Freeze beneficiary wallet", "primary": true}, {"label": "Investigate source customers"}, {"label": "File aggregated SAR"}]');
