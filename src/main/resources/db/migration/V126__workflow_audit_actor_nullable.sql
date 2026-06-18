-- actor_id is null for API-key-authenticated import calls (no session user)
ALTER TABLE workflow_audit_log ALTER COLUMN actor_id DROP NOT NULL;
