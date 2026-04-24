-- Refresh seed transaction timestamps so they stay visible within the
-- default 30-day range after this migration runs.
UPDATE transactions
SET occurred_at = now() - (floor(random() * 58 + 2) * interval '1 minute')
WHERE id IN (
  'TXN-48721','TXN-48720','TXN-48719','TXN-48718','TXN-48717',
  'TXN-48716','TXN-48715','TXN-48714','TXN-48713','TXN-48712'
);
