-- Allow created_by to be nullable for system-created cases (e.g., auto-created from fraud detection)
ALTER TABLE cases ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE case_activity ALTER COLUMN actor_id DROP NOT NULL;
