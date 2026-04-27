-- Unified activity event stream.
-- Populated automatically by triggers on transactions and case_activity.
-- Consumers (dashboard SSE) query this table rather than unions across many tables.

CREATE TABLE activity_events (
  id             BIGSERIAL    PRIMARY KEY,
  institution_id BIGINT       NOT NULL REFERENCES institutions(id),
  source         TEXT         NOT NULL DEFAULT 'system',
  severity       TEXT         NOT NULL DEFAULT 'info'
                               CHECK (severity IN ('critical', 'warning', 'info', 'resolved')),
  title          TEXT         NOT NULL,
  detail         TEXT,
  entity_id      TEXT,
  entity_type    TEXT,
  actor          TEXT         NOT NULL DEFAULT 'System',
  occurred_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX activity_events_inst_time ON activity_events (institution_id, occurred_at DESC);
CREATE INDEX activity_events_inst_id   ON activity_events (institution_id, id DESC);

-- ── Trigger: transactions ────────────────────────────────────────────────────
-- Fires when flagged_status is set (INSERT) or changes (UPDATE).

CREATE OR REPLACE FUNCTION _activity_from_transaction() RETURNS trigger AS $$
BEGIN
  IF NEW.flagged_status IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.flagged_status IS DISTINCT FROM NEW.flagged_status) THEN
    INSERT INTO activity_events
      (institution_id, source, severity, title, detail, entity_id, entity_type, actor)
    VALUES (
      NEW.institution_id,
      'transaction',
      CASE NEW.flagged_status
        WHEN 'blocked' THEN 'critical'
        WHEN 'flagged' THEN 'warning'
        WHEN 'review'  THEN 'info'
        WHEN 'cleared' THEN 'resolved'
        ELSE 'info'
      END,
      CASE NEW.flagged_status
        WHEN 'blocked' THEN 'Transaction blocked · ' || NEW.customer_name
        WHEN 'flagged' THEN 'Transaction flagged · ' || NEW.customer_name
        WHEN 'review'  THEN 'Transaction under review · ' || NEW.customer_name
        WHEN 'cleared' THEN 'Transaction cleared · ' || NEW.customer_name
        ELSE 'Transaction updated · ' || NEW.customer_name
      END,
      NEW.channel || CASE WHEN NEW.location IS NOT NULL THEN ' · ' || NEW.location ELSE '' END,
      NEW.id,
      'transaction',
      'Auto-detection'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_activity_from_transaction
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION _activity_from_transaction();

-- ── Trigger: case_activity ────────────────────────────────────────────────────
-- Fires on every case_activity INSERT; joins back to cases + users for context.

CREATE OR REPLACE FUNCTION _activity_from_case() RETURNS trigger AS $$
DECLARE
  v_inst    BIGINT;
  v_title   TEXT;
  v_actor   TEXT;
BEGIN
  SELECT c.institution_id, c.title
    INTO v_inst, v_title
    FROM cases c WHERE c.id = NEW.case_id;

  SELECT COALESCE(u.full_name, u.email)
    INTO v_actor
    FROM users u WHERE u.id = NEW.actor_id;

  INSERT INTO activity_events
    (institution_id, source, severity, title, detail, entity_id, entity_type, actor)
  VALUES (
    v_inst,
    'case',
    CASE NEW.action
      WHEN 'opened'    THEN 'warning'
      WHEN 'escalated' THEN 'critical'
      WHEN 'closed'    THEN 'resolved'
      ELSE 'info'
    END,
    CASE NEW.action
      WHEN 'opened'              THEN 'Case opened · '      || v_title
      WHEN 'status_changed'      THEN 'Case updated · '     || v_title
      WHEN 'closed'              THEN 'Case closed · '      || v_title
      WHEN 'note_added'          THEN 'Note added · '       || v_title
      WHEN 'transaction_linked'  THEN 'Transaction linked · '|| v_title
      WHEN 'assigned'            THEN 'Case assigned · '    || v_title
      ELSE v_title
    END,
    COALESCE(NEW.detail, ''),
    NEW.case_id,
    'case',
    COALESCE(v_actor, 'System')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_activity_from_case
  AFTER INSERT ON case_activity
  FOR EACH ROW EXECUTE FUNCTION _activity_from_case();

-- Backfill recent activity from existing data (last 24 h) so the feed isn't empty on first run.
DO $$
BEGIN
  -- Backfill flagged transactions (most recent 100)
  INSERT INTO activity_events (institution_id, source, severity, title, detail, entity_id, entity_type, actor, occurred_at)
  SELECT institution_id, 'transaction',
    CASE flagged_status WHEN 'blocked' THEN 'critical' WHEN 'flagged' THEN 'warning'
                        WHEN 'review'  THEN 'info'     WHEN 'cleared' THEN 'resolved' ELSE 'info' END,
    CASE flagged_status WHEN 'blocked' THEN 'Transaction blocked · ' || customer_name
                        WHEN 'flagged' THEN 'Transaction flagged · ' || customer_name
                        WHEN 'review'  THEN 'Transaction under review · ' || customer_name
                        WHEN 'cleared' THEN 'Transaction cleared · ' || customer_name
                        ELSE 'Transaction updated · ' || customer_name END,
    channel || CASE WHEN location IS NOT NULL THEN ' · ' || location ELSE '' END,
    id, 'transaction', 'Auto-detection', occurred_at
  FROM (SELECT * FROM transactions WHERE flagged_status IS NOT NULL ORDER BY occurred_at DESC LIMIT 100) t;

  -- Backfill case activity (last 24 h)
  INSERT INTO activity_events (institution_id, source, severity, title, detail, entity_id, entity_type, actor, occurred_at)
  SELECT c.institution_id, 'case',
    CASE ca.action WHEN 'opened' THEN 'warning' WHEN 'escalated' THEN 'critical'
                   WHEN 'closed' THEN 'resolved' ELSE 'info' END,
    CASE ca.action WHEN 'opened'             THEN 'Case opened · '       || c.title
                   WHEN 'status_changed'     THEN 'Case updated · '      || c.title
                   WHEN 'closed'             THEN 'Case closed · '       || c.title
                   WHEN 'note_added'         THEN 'Note added · '        || c.title
                   WHEN 'transaction_linked' THEN 'Transaction linked · ' || c.title
                   WHEN 'assigned'           THEN 'Case assigned · '     || c.title
                   ELSE c.title END,
    COALESCE(ca.detail, ''),
    ca.case_id, 'case', COALESCE(u.full_name, u.email, 'System'), ca.created_at
  FROM case_activity ca
  JOIN cases c ON c.id = ca.case_id
  LEFT JOIN users u ON u.id = ca.actor_id
  WHERE ca.created_at >= now() - interval '24 hours';
EXCEPTION WHEN OTHERS THEN NULL; -- ignore backfill errors (tables might be empty in test envs)
END $$;
