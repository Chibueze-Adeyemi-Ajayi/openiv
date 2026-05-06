-- Add occurred_at column to beam_records to track event time separately from receive time
-- This is the user's timestamp and is the source of truth for temporal calculations

ALTER TABLE beam_records
  ADD COLUMN occurred_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN received_at_original TIMESTAMP WITH TIME ZONE;

-- Copy current received_at values to received_at_original for reference
UPDATE beam_records SET received_at_original = received_at WHERE received_at_original IS NULL;

-- Create index on occurred_at for timestamp anomaly detection queries
CREATE INDEX idx_beam_occurred_at ON beam_records(institution_id, occurred_at DESC);
