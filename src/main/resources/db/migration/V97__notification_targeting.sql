-- Per-user notification targeting
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS recipient_id BIGINT DEFAULT NULL
      REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_roles TEXT[] DEFAULT NULL;

-- Per-user read tracking (replaces institution-wide status writes)
CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         BIGINT NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  read_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient  ON notifications(institution_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target     ON notifications(institution_id) WHERE target_roles IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notif_reads_user         ON notification_reads(user_id, notification_id);
