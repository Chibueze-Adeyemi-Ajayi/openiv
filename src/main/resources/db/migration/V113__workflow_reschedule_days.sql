ALTER TABLE workflow_definitions
  ADD COLUMN reschedule_days INTEGER
    CHECK (reschedule_days IS NULL OR (reschedule_days >= 14 AND reschedule_days <= 90));
