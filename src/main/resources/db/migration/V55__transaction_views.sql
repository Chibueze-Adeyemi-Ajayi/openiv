-- Tracks which users have viewed (opened the detail panel for) each transaction.
-- Used to show seen/unseen indicators on the transaction list.
CREATE TABLE transaction_views (
  transaction_id TEXT        NOT NULL,
  institution_id BIGINT      NOT NULL,
  user_id        BIGINT      NOT NULL,
  viewed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (transaction_id, user_id)
);

CREATE INDEX transaction_views_inst_user ON transaction_views (institution_id, user_id);
