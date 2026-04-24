-- V14: Split the old status column (flagged/blocked/cleared/review) into two columns:
--   status         — payment processing outcome: pending | successful | failed
--   flagged_status — fraud/compliance investigation state: flagged | blocked | cleared | review | NULL

-- Step 1: Add flagged_status without a constraint so we can backfill freely.
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS flagged_status TEXT;

-- Step 2: Backfill flagged_status from the old status values before we overwrite them.
UPDATE transactions SET flagged_status = 'flagged' WHERE status = 'flagged';
UPDATE transactions SET flagged_status = 'blocked'  WHERE status = 'blocked';
UPDATE transactions SET flagged_status = 'review'   WHERE status = 'review';
-- 'cleared' → flagged_status stays NULL (cleared normal transactions were never investigated)

-- Step 3: Map old status → new payment outcome status.
UPDATE transactions SET status = 'pending'    WHERE status IN ('flagged', 'review');
UPDATE transactions SET status = 'failed'     WHERE status = 'blocked';
UPDATE transactions SET status = 'successful' WHERE status = 'cleared';

-- Step 4: Replace the old status CHECK constraint with the new one.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('pending', 'successful', 'failed'));

-- Step 5: Add the flagged_status CHECK constraint now that data is clean.
ALTER TABLE transactions ADD CONSTRAINT transactions_flagged_status_check
    CHECK (flagged_status IN ('flagged', 'blocked', 'cleared', 'review'));

-- Step 6: Index for investigation-state filtering.
CREATE INDEX IF NOT EXISTS transactions_inst_flagged_status
    ON transactions (institution_id, flagged_status)
    WHERE flagged_status IS NOT NULL;
