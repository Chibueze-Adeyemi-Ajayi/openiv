-- OTP alert anomalies detected by the Eureka rule engine.
-- Each row represents one fired alert; the trigger below fans it into activity_events.

CREATE TABLE otp_alerts (
  id             BIGSERIAL    PRIMARY KEY,
  institution_id BIGINT       NOT NULL REFERENCES institutions(id),
  rule           TEXT         NOT NULL CHECK (rule IN (
                                 'FAILED_CASCADE', 'OTP_BOMBING',
                                 'VELOCITY_SPIKE', 'NEW_DEVICE_SUSPICIOUS')),
  severity       TEXT         NOT NULL CHECK (severity IN ('critical', 'warning')),
  customer_id    TEXT,
  device_id      TEXT,
  channel        TEXT,
  otp_type       TEXT,
  event_count    INT          NOT NULL DEFAULT 1,
  detail         TEXT         NOT NULL,
  fired_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX otp_alerts_inst_rule     ON otp_alerts (institution_id, rule, fired_at DESC);
CREATE INDEX otp_alerts_inst_customer ON otp_alerts (institution_id, customer_id, fired_at DESC);
CREATE INDEX otp_alerts_inst_time     ON otp_alerts (institution_id, fired_at DESC);

-- Fan OTP alerts into the shared activity_events feed so the live activity panel
-- picks them up automatically via the existing activity-stream SSE.

CREATE OR REPLACE FUNCTION _activity_from_otp_alert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO activity_events
    (institution_id, source, severity, title, detail, entity_id, entity_type, actor, occurred_at)
  VALUES (
    NEW.institution_id,
    'otp',
    NEW.severity,
    CASE NEW.rule
      WHEN 'FAILED_CASCADE'        THEN 'OTP failure cascade detected'
      WHEN 'OTP_BOMBING'           THEN 'OTP bombing attempt detected'
      WHEN 'VELOCITY_SPIKE'        THEN 'Institution-wide OTP failure spike'
      WHEN 'NEW_DEVICE_SUSPICIOUS' THEN 'Suspicious new-device OTP request'
      ELSE 'OTP alert'
    END,
    NEW.detail,
    NEW.customer_id,
    'customer',
    'Eureka',
    NEW.fired_at
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER otp_alert_to_activity
AFTER INSERT ON otp_alerts
FOR EACH ROW EXECUTE FUNCTION _activity_from_otp_alert();
