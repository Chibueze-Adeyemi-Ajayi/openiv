-- V58: Behavioral beam alerts table + institution-configurable rules for all non-transaction beams.
-- Beams covered: login, activity, location, device, otp (timestamp anomaly only for otp).
-- Each rule ships with tunable params (JSONB) that institutions can override.

CREATE TABLE IF NOT EXISTS behavioral_alerts (
    id               BIGSERIAL        PRIMARY KEY,
    institution_id   BIGINT           NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    beam             VARCHAR(20)      NOT NULL CHECK (beam IN ('login','activity','location','device','otp')),
    rule             VARCHAR(80)      NOT NULL,
    severity         VARCHAR(20)      NOT NULL CHECK (severity IN ('critical','high','warning','info')),
    customer_id      TEXT,
    device_id        TEXT,
    ip               TEXT,
    channel          TEXT,
    event_count      INT              DEFAULT 1,
    detail           TEXT             NOT NULL,
    risk_score       INT              NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    reasons          TEXT[],
    status           TEXT             DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
    lat              DOUBLE PRECISION,
    lng              DOUBLE PRECISION,
    customer_lat     DOUBLE PRECISION,
    customer_lng     DOUBLE PRECISION,
    distance_km      INT,
    occurred_at      TIMESTAMPTZ,
    fired_at         TIMESTAMPTZ      DEFAULT now(),
    expires_at       TIMESTAMPTZ      DEFAULT now() + INTERVAL '72 hours'
);

CREATE INDEX idx_beh_alerts_inst_fired  ON behavioral_alerts(institution_id, fired_at DESC);
CREATE INDEX idx_beh_alerts_customer    ON behavioral_alerts(institution_id, customer_id, fired_at DESC)
    WHERE customer_id IS NOT NULL;
CREATE INDEX idx_beh_alerts_beam_rule   ON behavioral_alerts(institution_id, beam, rule, fired_at DESC);
CREATE INDEX idx_beh_alerts_device      ON behavioral_alerts(institution_id, device_id, fired_at DESC)
    WHERE device_id IS NOT NULL;

-- ── LOGIN RULES ──────────────────────────────────────────────────────────────
-- Seed for every institution that exists; institutions can UPDATE params to tune thresholds.

INSERT INTO behavioral_rules
    (institution_id, rule_id, name, category, severity, description, example,
     matched_typology, is_active, affected, emergence, params, recommended_actions)
SELECT
    i.id, r.rule_id, r.name, r.category, r.severity,
    r.description, r.example, r.matched_typology,
    true, 0, 'Just now', r.params::jsonb, r.recommended_actions::jsonb
FROM institutions i
CROSS JOIN (VALUES
    (
        'LOGIN_TIME_ANOMALY',
        'Off-Hours Login',
        'Temporal', 'medium',
        'Customer logged in during unusual hours. Risk is graded with a fuzzy membership function — the later into the night, the higher the score. Institutions can tune off_hours_start and off_hours_end.',
        'Customer logs in at 2:30 AM when their 30-day baseline shows activity only between 8 AM and 6 PM.',
        'Account Takeover',
        '{"off_hours_start":22,"off_hours_end":6,"transition_hours":2,"base_score":45,"window_days":30}',
        '["Verify with customer whether the login was authorised","Check whether a transaction followed the login","Review the device fingerprint and originating IP"]'
    ),
    (
        'LOGIN_VELOCITY',
        'Login Velocity Spike',
        'Velocity', 'high',
        'Too many login attempts from the same customer in a short window — a brute-force or credential-stuffing precursor.',
        'Customer triggers 8 login requests within 3 minutes — far beyond any normal interaction pattern.',
        'Credential Stuffing / Brute Force',
        '{"max_attempts":5,"window_minutes":5,"cooldown_minutes":30,"base_score":65}',
        '["Temporarily lock the account","Trigger mandatory OTP re-verification","Notify the customer by SMS and email"]'
    ),
    (
        'LOGIN_IMPOSSIBLE_TRAVEL',
        'Impossible Travel on Login',
        'Geo', 'critical',
        'Login originated from a location that is physically impossible to reach given the customer''s last known position and the time elapsed. Scored with a fuzzy travel-speed membership function.',
        'Customer logged in from Lagos at 09:00 and from London at 09:15 — 5,400 km in 15 minutes is impossible.',
        'Account Compromise / Mule Account',
        '{"min_impossible_speed_kmh":900,"base_score":88,"cooldown_minutes":60}',
        '["Suspend the active session immediately","Force re-authentication with step-up MFA","Open a case for analyst investigation","Notify the customer"]'
    ),
    (
        'LOGIN_NEW_COUNTRY',
        'Login from New Country',
        'Geo', 'high',
        'Customer logged in from a country not previously associated with their account in the lookback window.',
        'Customer based in Nigeria logs in for the first time from a Brazilian IP address.',
        'Account Takeover',
        '{"base_score":60,"lookback_days":90,"cooldown_minutes":120}',
        '["Verify with the customer","Check whether VPN use is known","Flag for analyst review"]'
    ),
    (
        'LOGIN_TIMESTAMP_STALE',
        'Stale Login Timestamp',
        'Temporal', 'critical',
        'Login event arrived with a timestamp more than 24 hours in the past — a strong replay-attack indicator.',
        'A login event shows occurred_at of yesterday at 10:00 AM but arrived at the server today at 3:00 PM.',
        'Replay Attack / Timestamp Forgery',
        '{"stale_hours":24,"base_score":88}',
        '["Reject the session","Open a cyber-breach case","Notify the security team immediately"]'
    ),
    (
        'LOGIN_TIMESTAMP_FUTURE',
        'Future Login Timestamp',
        'Temporal', 'critical',
        'Login event carries a timestamp ahead of the current server time — clock-tampering or a forged event.',
        'Login event shows occurred_at as tomorrow — impossible for any legitimate login.',
        'Timestamp Forgery / Clock Tampering',
        '{"future_seconds":300,"base_score":88}',
        '["Reject the session","Flag the device","Open an investigation case"]'
    ),
    (
        'LOGIN_MICRO_TIMING',
        'Login Micro-Timing Anomaly',
        'Temporal', 'critical',
        'Login timestamp matches the server clock within 5 seconds — a hallmark of automated API injection rather than a real user.',
        'Login event timestamp is identical to the server receipt time to the second.',
        'API Injection / Automated Bot',
        '{"micro_seconds":5,"base_score":92}',
        '["Reject the session","Rate-limit the originating IP","Open a cyber-breach case"]'
    )
) AS r(rule_id,name,category,severity,description,example,matched_typology,params,recommended_actions)
ON CONFLICT (institution_id, rule_id) DO NOTHING;

-- ── ACTIVITY RULES ───────────────────────────────────────────────────────────

INSERT INTO behavioral_rules
    (institution_id, rule_id, name, category, severity, description, example,
     matched_typology, is_active, affected, emergence, params, recommended_actions)
SELECT
    i.id, r.rule_id, r.name, r.category, r.severity,
    r.description, r.example, r.matched_typology,
    true, 0, 'Just now', r.params::jsonb, r.recommended_actions::jsonb
FROM institutions i
CROSS JOIN (VALUES
    (
        'ACTIVITY_TIME_ANOMALY',
        'Off-Hours Activity Burst',
        'Temporal', 'medium',
        'Heavy in-app activity detected during unusual hours. Risk is graded with a fuzzy time-of-day membership function — 10 PM to 6 AM scores highest.',
        'Customer performs 30 account enquiries between 2 AM and 3 AM when their baseline is daytime-only.',
        'Account Reconnaissance / Insider Threat',
        '{"off_hours_start":22,"off_hours_end":6,"transition_hours":2,"burst_threshold":20,"window_minutes":60,"base_score":50}',
        '["Review what data was accessed","Check whether sensitive screens were viewed","Verify with the customer"]'
    ),
    (
        'ACTIVITY_BURST',
        'Activity Burst Pattern',
        'Velocity', 'high',
        'Abnormally high in-app activity in a short window — consistent with automated scraping or account reconnaissance. Scored with a fuzzy velocity membership function.',
        'Customer logs 200 screen views in 5 minutes; their 30-day baseline is 5–10 views per session.',
        'Account Takeover / Insider Threat',
        '{"burst_threshold":50,"window_minutes":5,"base_score":70,"cooldown_minutes":15}',
        '["Check what data was accessed","Rate-limit the session","Escalate to security analyst"]'
    ),
    (
        'ACTIVITY_TIMESTAMP_STALE',
        'Stale Activity Timestamp',
        'Temporal', 'critical',
        'Activity event timestamp is more than 24 hours old — possible log-replay or backdated injection.',
        'Activity event logged with occurred_at 48 hours ago arrived at the server only now.',
        'Replay Attack / Log Stuffing',
        '{"stale_hours":24,"base_score":85}',
        '["Investigate the source of the delayed event","Check for log replay patterns","Notify the security team"]'
    ),
    (
        'ACTIVITY_TIMESTAMP_FUTURE',
        'Future Activity Timestamp',
        'Temporal', 'critical',
        'Activity event timestamp is set in the future — indicates clock manipulation or a synthetic event.',
        'Activity event occurred_at is 2 days from now.',
        'Timestamp Forgery / Clock Manipulation',
        '{"future_seconds":300,"base_score":85}',
        '["Reject the event","Flag the originating device","Open an investigation case"]'
    ),
    (
        'ACTIVITY_MICRO_TIMING',
        'Activity Micro-Timing Anomaly',
        'Temporal', 'critical',
        'Activity event timestamp precisely matches the server receipt time — an automated injection signal.',
        'Event arrived at the server with a timestamp identical to the receipt time, to the second.',
        'API Injection / Automated Bot',
        '{"micro_seconds":5,"base_score":90}',
        '["Reject the event","Rate-limit the source IP","Open a cyber-breach case"]'
    ),
    (
        'ACTIVITY_SESSION_ANOMALY',
        'Mid-Session Device or IP Shift',
        'Device', 'high',
        'Device fingerprint or IP address changed mid-session — a session-hijacking signal.',
        'Session started on a mobile device in Lagos; later requests arrive from a different IP in Abuja.',
        'Session Hijacking',
        '{"base_score":75,"cooldown_minutes":30}',
        '["Invalidate the active session","Force re-authentication","Alert the customer immediately"]'
    )
) AS r(rule_id,name,category,severity,description,example,matched_typology,params,recommended_actions)
ON CONFLICT (institution_id, rule_id) DO NOTHING;

-- ── LOCATION RULES ───────────────────────────────────────────────────────────

INSERT INTO behavioral_rules
    (institution_id, rule_id, name, category, severity, description, example,
     matched_typology, is_active, affected, emergence, params, recommended_actions)
SELECT
    i.id, r.rule_id, r.name, r.category, r.severity,
    r.description, r.example, r.matched_typology,
    true, 0, 'Just now', r.params::jsonb, r.recommended_actions::jsonb
FROM institutions i
CROSS JOIN (VALUES
    (
        'LOCATION_IMPOSSIBLE_TRAVEL',
        'Impossible Travel Speed',
        'Geo', 'critical',
        'Location update shows travel speed that exceeds 900 km/h — faster than any commercial aircraft. Scored with a fuzzy speed membership function relative to elapsed time.',
        'Location ping shows customer in Abuja at 14:00 and in London at 14:20 — 5,000 km in 20 minutes.',
        'GPS Spoofing / Account Compromise',
        '{"max_speed_kmh":900,"min_gap_minutes":5,"base_score":90,"cooldown_minutes":60}',
        '["Freeze the account temporarily","Force step-up authentication","Open an investigation case"]'
    ),
    (
        'LOCATION_HIGH_RISK_REGION',
        'High-Risk Geographic Region',
        'Geo', 'high',
        'Customer''s location is in a jurisdiction flagged as high-risk (e.g. FATF grey/black list). Institutions configure the list of high-risk country codes in params.',
        'Customer''s GPS shows they are currently in a jurisdiction with active AML red flags.',
        'High-Risk Jurisdiction / Sanctions Exposure',
        '{"base_score":60,"high_risk_countries":["KP","IR","MM","SY","YE","SO","LY"],"cooldown_minutes":240}',
        '["Escalate to compliance","Review all pending transactions","Consider enhanced due diligence (EDD)"]'
    ),
    (
        'LOCATION_TIMESTAMP_STALE',
        'Stale Location Timestamp',
        'Temporal', 'critical',
        'Location event timestamp is more than 24 hours old — stale GPS data or a replay attack.',
        'Location ping arrived with occurred_at from 2 days ago.',
        'Replay Attack / GPS Spoofing',
        '{"stale_hours":24,"base_score":82}',
        '["Investigate the source","Check for GPS spoofing patterns","Notify the security team"]'
    ),
    (
        'LOCATION_TIMESTAMP_FUTURE',
        'Future Location Timestamp',
        'Temporal', 'critical',
        'Location event timestamp is set ahead of the current time — GPS manipulation or clock tampering.',
        'Location ping has occurred_at set 10 hours in the future.',
        'GPS Spoofing / Timestamp Forgery',
        '{"future_seconds":300,"base_score":82}',
        '["Reject the event","Flag the device as suspicious","Open an investigation case"]'
    ),
    (
        'LOCATION_MICRO_TIMING',
        'Location Micro-Timing Anomaly',
        'Temporal', 'critical',
        'Location event timestamp matches the server receipt time within 5 seconds — synthetic GPS injection.',
        'GPS ping arrives with a timestamp equal to the server receipt time.',
        'GPS Spoofing / API Injection',
        '{"micro_seconds":5,"base_score":90}',
        '["Reject the event","Rate-limit the originating IP","Open a cyber-breach case"]'
    ),
    (
        'LOCATION_RAPID_CHANGE',
        'Rapid Location Ping Flood',
        'Velocity', 'warning',
        'Too many location pings in a short window — consistent with GPS spoofing or automated location cycling.',
        'Customer sends 50 location pings in 2 minutes; normal cadence is 1 ping per 10 minutes.',
        'GPS Spoofing',
        '{"max_pings":10,"window_minutes":2,"base_score":55,"cooldown_minutes":20}',
        '["Check for a GPS mock app on the device","Flag for analyst review","Verify the customer is using the app legitimately"]'
    ),
    (
        'LOCATION_COUNTRY_CHANGE',
        'Unexpected Country Change',
        'Geo', 'high',
        'Customer''s location moved to a country not seen in their profile within the lookback window.',
        'Customer based in Nigeria is now pinging from UK GPS coordinates.',
        'Account Takeover / Travel Fraud',
        '{"lookback_days":90,"base_score":62,"cooldown_minutes":120}',
        '["Notify the customer","Verify travel","Check for concurrent sessions in different locations"]'
    )
) AS r(rule_id,name,category,severity,description,example,matched_typology,params,recommended_actions)
ON CONFLICT (institution_id, rule_id) DO NOTHING;

-- ── DEVICE RULES ─────────────────────────────────────────────────────────────

INSERT INTO behavioral_rules
    (institution_id, rule_id, name, category, severity, description, example,
     matched_typology, is_active, affected, emergence, params, recommended_actions)
SELECT
    i.id, r.rule_id, r.name, r.category, r.severity,
    r.description, r.example, r.matched_typology,
    true, 0, 'Just now', r.params::jsonb, r.recommended_actions::jsonb
FROM institutions i
CROSS JOIN (VALUES
    (
        'DEVICE_SHARED_ACCOUNTS',
        'Device Shared Across Customer Accounts',
        'Device', 'critical',
        'The same device fingerprint has been used to access multiple distinct customer accounts — a mule network or device-sharing fraud pattern.',
        'Device ID "d-xyz123" is seen accessing accounts of 5 different customers within 24 hours.',
        'Mule Network / Account Takeover Ring',
        '{"max_accounts":3,"window_hours":24,"base_score":85,"cooldown_minutes":60}',
        '["Flag all accounts sharing the device","Open linked investigation cases for each account","Escalate to compliance immediately"]'
    ),
    (
        'DEVICE_JAILBREAK_ROOT',
        'Jailbroken or Rooted Device',
        'Device', 'high',
        'The device is jailbroken (iOS) or rooted (Android) — significantly elevated risk of malware, certificate pinning bypass, and MitM attacks.',
        'Transaction initiated from a rooted Android device running a patched banking app.',
        'Device Compromise / Malware / MitM',
        '{"base_score":65}',
        '["Warn the customer about device security risks","Consider blocking sensitive transactions from rooted devices","Log all activity from this device for audit"]'
    ),
    (
        'DEVICE_EMULATOR',
        'Emulator or Virtual Device Detected',
        'Device', 'critical',
        'Device fingerprint matches characteristics of a software emulator or virtual machine — common in automated fraud and API abuse attacks.',
        'Login attempt originates from an Android Studio emulator, not a real phone.',
        'Automated Bot / API Abuse',
        '{"base_score":88}',
        '["Block the session","Rate-limit the originating IP","Open a cyber-breach case"]'
    ),
    (
        'DEVICE_TIMESTAMP_STALE',
        'Stale Device Event Timestamp',
        'Temporal', 'critical',
        'Device registration or fingerprint event timestamp is more than 24 hours old — replay or backdated event injection.',
        'Device fingerprint event arrived with occurred_at from 3 days ago.',
        'Replay Attack / Backdated Injection',
        '{"stale_hours":24,"base_score":82}',
        '["Investigate the source","Check for replay attack patterns","Notify the security team"]'
    ),
    (
        'DEVICE_TIMESTAMP_FUTURE',
        'Future Device Event Timestamp',
        'Temporal', 'critical',
        'Device event timestamp is set in the future — clock tampering or a synthetic/forged event.',
        'Device registration event has occurred_at set 24 hours from now.',
        'Timestamp Forgery / Synthetic Event',
        '{"future_seconds":300,"base_score":82}',
        '["Reject the event","Flag the device fingerprint","Open an investigation"]'
    ),
    (
        'DEVICE_MICRO_TIMING',
        'Device Micro-Timing Anomaly',
        'Temporal', 'critical',
        'Device event timestamp matches the server receipt time within 5 seconds — automated injection, not a real device.',
        'Device fingerprint event arrived with a timestamp identical to the server receipt time.',
        'API Injection / Synthetic Device',
        '{"micro_seconds":5,"base_score":90}',
        '["Reject the event","Rate-limit the source IP","Open a cyber-breach case"]'
    ),
    (
        'DEVICE_RAPID_SWAP',
        'Rapid Device Fingerprint Change',
        'Device', 'high',
        'Customer''s device fingerprint changed multiple times within a very short window — a SIM-swap or device handover precursor.',
        'Customer''s device changed 3 times within 10 minutes across separate logins.',
        'SIM Swap / Account Handover Fraud',
        '{"max_changes":2,"window_minutes":10,"base_score":72,"cooldown_minutes":60}',
        '["Alert the customer","Suspend pending transactions","Verify the device change was authorised by the customer"]'
    ),
    (
        'DEVICE_CLONED',
        'Possible Cloned Device Detected',
        'Device', 'critical',
        'The same device fingerprint is seen at two geographically distant locations within a short window — a device-cloning indicator.',
        'Device "d-abc" is logged in from both Lagos and London within 10 minutes.',
        'Device Cloning / SIM Swap',
        '{"simultaneous_window_minutes":15,"min_distance_km":200,"base_score":92,"cooldown_minutes":120}',
        '["Suspend both active sessions","Force re-authentication on all devices","Open a high-priority case","Alert the customer immediately"]'
    )
) AS r(rule_id,name,category,severity,description,example,matched_typology,params,recommended_actions)
ON CONFLICT (institution_id, rule_id) DO NOTHING;

-- ── OTP TIMESTAMP RULES (additional — behaviour rules, not the existing OtpAnalyzer rules) ──

INSERT INTO behavioral_rules
    (institution_id, rule_id, name, category, severity, description, example,
     matched_typology, is_active, affected, emergence, params, recommended_actions)
SELECT
    i.id, r.rule_id, r.name, r.category, r.severity,
    r.description, r.example, r.matched_typology,
    true, 0, 'Just now', r.params::jsonb, r.recommended_actions::jsonb
FROM institutions i
CROSS JOIN (VALUES
    (
        'OTP_TIMESTAMP_STALE',
        'Stale OTP Event Timestamp',
        'Temporal', 'critical',
        'OTP event timestamp is more than 24 hours old — replay or backdated OTP injection.',
        'OTP request arrived with occurred_at from 30 hours ago.',
        'OTP Replay Attack',
        '{"stale_hours":24,"base_score":88}',
        '["Reject the OTP","Open an investigation case","Notify the security team immediately"]'
    ),
    (
        'OTP_TIMESTAMP_FUTURE',
        'Future OTP Event Timestamp',
        'Temporal', 'critical',
        'OTP event timestamp is set in the future — clock tampering or a synthetic event.',
        'OTP request shows occurred_at 6 hours from now.',
        'Timestamp Forgery / OTP Injection',
        '{"future_seconds":300,"base_score":88}',
        '["Reject the OTP","Flag the originating device","Open an investigation"]'
    ),
    (
        'OTP_MICRO_TIMING',
        'OTP Micro-Timing Anomaly',
        'Temporal', 'critical',
        'OTP event timestamp matches the server receipt time within 5 seconds — automated OTP injection rather than a real user.',
        'OTP event arrived with a timestamp identical to the server receipt time.',
        'OTP Injection / API Abuse',
        '{"micro_seconds":5,"base_score":92}',
        '["Reject the OTP","Rate-limit the originating IP","Open a cyber-breach case"]'
    )
) AS r(rule_id,name,category,severity,description,example,matched_typology,params,recommended_actions)
ON CONFLICT (institution_id, rule_id) DO NOTHING;
