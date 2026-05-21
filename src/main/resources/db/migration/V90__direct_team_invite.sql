-- Track which user created a direct team invite (used to identify pending team members)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS invited_by_user_id BIGINT REFERENCES users(id);
