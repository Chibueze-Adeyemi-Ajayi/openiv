CREATE TABLE transactions (
  id              TEXT         PRIMARY KEY,
  institution_id  BIGINT       NOT NULL REFERENCES institutions(id),
  customer_id     TEXT         NOT NULL,
  customer_name   TEXT         NOT NULL,
  amount          NUMERIC(18, 2) NOT NULL,
  channel         TEXT         NOT NULL,
  counterparty    TEXT         NOT NULL,
  risk_score      INTEGER      NOT NULL DEFAULT 0
                                 CHECK (risk_score >= 0 AND risk_score <= 100),
  status          TEXT         NOT NULL DEFAULT 'review'
                                 CHECK (status IN ('flagged', 'blocked', 'cleared', 'review')),
  location        TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  occurred_at     TIMESTAMPTZ  NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX transactions_inst_time     ON transactions (institution_id, occurred_at DESC);
CREATE INDEX transactions_inst_status   ON transactions (institution_id, status);
CREATE INDEX transactions_inst_customer ON transactions (institution_id, customer_id);

-- Seed sample data for the first institution (dev environments only; no-op if none exist).
DO $$
DECLARE inst_id BIGINT;
BEGIN
  SELECT id INTO inst_id FROM institutions ORDER BY id LIMIT 1;
  IF inst_id IS NULL THEN RETURN; END IF;

  INSERT INTO transactions
    (id, institution_id, customer_id, customer_name, amount, channel, counterparty,
     risk_score, status, location, lat, lng, occurred_at)
  VALUES
    ('TXN-48721', inst_id, 'CUS-1001', 'Adamu Ibrahim',    14250000, 'Wire',   'Sokoto BDC Ltd',      92, 'flagged', 'Sokoto',        13.0059, 5.2476,  now() -  '2 minutes'::interval),
    ('TXN-48720', inst_id, 'CUS-1002', 'Folake Adesanya',    480000, 'Mobile', 'PiggyVest Wallet',    12, 'cleared', 'Lagos',          6.5244, 3.3792,  now() -  '3 minutes'::interval),
    ('TXN-48719', inst_id, 'CUS-1003', 'Chinedu Okeke',     7800000, 'Wire',   'Anonymous · Aba',     88, 'blocked', 'Onitsha',        6.1420, 6.7880,  now() -  '5 minutes'::interval),
    ('TXN-48718', inst_id, 'CUS-1004', 'Aisha Bello',       2400000, 'PoS',    'Shoprite Lekki',       8, 'cleared', 'Lagos',          6.4281, 3.4219,  now() -  '6 minutes'::interval),
    ('TXN-48717', inst_id, 'CUS-1005', 'Emeka Nwosu',      18500000, 'Wire',   'Cayman Holdings',     95, 'review',  'Port Harcourt',  4.8156, 7.0498,  now() -  '9 minutes'::interval),
    ('TXN-48716', inst_id, 'CUS-1006', 'Mariam Yusuf',       320000, 'Mobile', 'MTN Topup',            4, 'cleared', 'Kano',          12.0022, 8.5919,  now() - '11 minutes'::interval),
    ('TXN-48715', inst_id, 'CUS-1007', 'Tunde Bakare',      6200000, 'Wire',   'Ade Ventures',        64, 'review',  'Ibadan',         7.3775, 3.9470,  now() - '13 minutes'::interval),
    ('TXN-48714', inst_id, 'CUS-1008', 'Ifeoma Eze',        1850000, 'PoS',    'Slot Mall',           22, 'cleared', 'Enugu',          6.4584, 7.5464,  now() - '15 minutes'::interval),
    ('TXN-48713', inst_id, 'CUS-1009', 'Bashir Mohammed',   9400000, 'Wire',   'Katsina FX Bureau',   76, 'flagged', 'Katsina',       12.9908, 7.6017,  now() - '17 minutes'::interval),
    ('TXN-48712', inst_id, 'CUS-1010', 'Grace Williams',     540000, 'Mobile', 'Bolt Driver Payout',   6, 'cleared', 'Abuja',          9.0579, 7.4951,  now() - '19 minutes'::interval)
  ON CONFLICT (id) DO NOTHING;
END $$;
