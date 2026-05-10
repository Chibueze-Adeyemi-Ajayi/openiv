-- Refresh occurred_at and created_at on seed transactions so they fall within
-- the last 24 hours.  Seed rows are inserted with DEFAULT now() at migration
-- run time, so on a long-running dev DB they drift outside the 24 h window
-- and dashboard stats show zero.  This migration pins each seed row to a
-- specific offset from now() so restoring the DB (re-running all migrations)
-- always produces fresh demo data.
--
-- Only the 10 known seed IDs are touched; real beamed transactions are ignored.

UPDATE transactions
SET
  occurred_at = now() - CASE id
    WHEN 'TXN-48721' THEN  '1 hour'::interval
    WHEN 'TXN-48720' THEN  '3 hours'::interval
    WHEN 'TXN-48719' THEN  '5 hours'::interval
    WHEN 'TXN-48718' THEN  '7 hours'::interval
    WHEN 'TXN-48717' THEN  '9 hours'::interval
    WHEN 'TXN-48716' THEN '11 hours'::interval
    WHEN 'TXN-48715' THEN '13 hours'::interval
    WHEN 'TXN-48714' THEN '15 hours'::interval
    WHEN 'TXN-48713' THEN '17 hours'::interval
    WHEN 'TXN-48712' THEN '20 hours'::interval
    ELSE '1 hour'::interval
  END,
  created_at = now() - CASE id
    WHEN 'TXN-48721' THEN  '58 minutes'::interval
    WHEN 'TXN-48720' THEN  '178 minutes'::interval
    WHEN 'TXN-48719' THEN  '298 minutes'::interval
    WHEN 'TXN-48718' THEN  '418 minutes'::interval
    WHEN 'TXN-48717' THEN  '538 minutes'::interval
    WHEN 'TXN-48716' THEN  '658 minutes'::interval
    WHEN 'TXN-48715' THEN  '778 minutes'::interval
    WHEN 'TXN-48714' THEN  '898 minutes'::interval
    WHEN 'TXN-48713' THEN '1018 minutes'::interval
    WHEN 'TXN-48712' THEN '1198 minutes'::interval
    ELSE '58 minutes'::interval
  END
WHERE id IN (
  'TXN-48721', 'TXN-48720', 'TXN-48719', 'TXN-48718', 'TXN-48717',
  'TXN-48716', 'TXN-48715', 'TXN-48714', 'TXN-48713', 'TXN-48712'
);

-- Index supporting all created_at-based range queries (stats, hourlyFlow, heatmap, riskMap).
CREATE INDEX IF NOT EXISTS transactions_inst_created_at
    ON transactions (institution_id, created_at DESC);
