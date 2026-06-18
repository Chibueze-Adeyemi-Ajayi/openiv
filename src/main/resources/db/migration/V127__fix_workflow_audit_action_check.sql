-- V112 was edited after being applied; the live constraint still has the old action list.
-- Drop and recreate with the current canonical set.
ALTER TABLE workflow_audit_log DROP CONSTRAINT IF EXISTS workflow_audit_log_action_check;
ALTER TABLE workflow_audit_log ADD CONSTRAINT workflow_audit_log_action_check
  CHECK (action IN ('create','update','delete','submit','approve','retire','new_version','run_now','import'));
