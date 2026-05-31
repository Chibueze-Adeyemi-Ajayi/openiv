package com.openiv.backend.billing;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class BillingRepository {

  private final Pool db;

  public BillingRepository(Pool db) {
    this.db = db;
  }

  public Pool getPool() {
    return db;
  }

  // ── Wallet ────────────────────────────────────────────────────────────────

  public Future<BillingWallet> getOrCreateWallet(long institutionId) {
    return db.withTransaction(conn ->
        conn.preparedQuery("""
            INSERT INTO billing_wallets (institution_id, balance_units, credit_expires_at)
            VALUES ($1, $2, now() + INTERVAL '30 days')
            ON CONFLICT (institution_id) DO UPDATE SET updated_at = billing_wallets.updated_at
            RETURNING *
            """).execute(Tuple.of(institutionId, BillingRates.WELCOME_CREDIT))
            .compose(rs -> {
              BillingWallet wallet = mapWallet(rs.iterator().next());
              return conn.preparedQuery("""
                  INSERT INTO billing_ledger
                    (institution_id, wallet_id, type, category, amount_units, balance_units, description, ref)
                  SELECT $1, $2, 'credit', 'welcome_credit', $3, $3, '30-day welcome credit · ₦500,000', 'WELCOME-CREDIT'
                  WHERE NOT EXISTS (
                    SELECT 1 FROM billing_ledger WHERE institution_id = $1 AND ref = 'WELCOME-CREDIT'
                  )
                  """).execute(Tuple.of(institutionId, wallet.id(), BillingRates.WELCOME_CREDIT))
                  .map(ignored -> wallet);
            }));
  }

  // Atomic debit: deducts from wallet and inserts ledger entry in one CTE.
  // Returns false when the wallet has insufficient balance.
  public Future<Boolean> debit(long institutionId, long walletId, long amountUnits,
      String category, String description, String ref) {
    return db.preparedQuery("""
        WITH deducted AS (
          UPDATE billing_wallets
          SET    balance_units = balance_units - $3,
                 updated_at   = now()
          WHERE  id = $2 AND balance_units >= $3
          RETURNING id, balance_units
        ),
        entry AS (
          INSERT INTO billing_ledger
            (institution_id, wallet_id, type, category, amount_units, balance_units, description, ref)
          SELECT $1, id, 'debit', $4, $3, balance_units, $5, $6
          FROM   deducted
        )
        SELECT COUNT(*) AS updated FROM deducted
        """).execute(Tuple.of(institutionId, walletId, amountUnits, category, description, ref))
        .map(rs -> rs.iterator().next().getLong("updated") > 0);
  }

  public Future<BillingWallet> credit(long institutionId, long walletId, long amountUnits,
      String category, String description, String ref) {
    return db.withTransaction(conn ->
        conn.preparedQuery("""
            UPDATE billing_wallets
            SET    balance_units = balance_units + $2,
                   updated_at   = now()
            WHERE  id = $1
            RETURNING *
            """).execute(Tuple.of(walletId, amountUnits))
            .compose(rs -> {
              BillingWallet wallet = mapWallet(rs.iterator().next());
              return conn.preparedQuery("""
                  INSERT INTO billing_ledger
                    (institution_id, wallet_id, type, category, amount_units, balance_units, description, ref)
                  VALUES ($1, $2, 'credit', $3, $4, $5, $6, $7)
                  """).execute(Tuple.of(
                      institutionId, walletId, category,
                      amountUnits, wallet.balanceUnits(), description, ref))
                  .map(ignored -> wallet);
            }));
  }

  // ── Ledger ────────────────────────────────────────────────────────────────

  public Future<List<BillingLedgerEntry>> listLedger(long institutionId, int limit) {
    return db.preparedQuery("""
        SELECT
          to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day_str,
          type,
          SUM(amount_units)  AS total_amount_units,
          MAX(balance_units) AS ending_balance_units,
          COUNT(*)           AS event_count,
          MAX(ref)           AS last_ref
        FROM billing_ledger
        WHERE institution_id = $1
        GROUP BY day_str, type
        ORDER BY day_str DESC, type
        LIMIT $2
        """).execute(Tuple.of(institutionId, limit))
        .map(rs -> {
          List<BillingLedgerEntry> result = new ArrayList<>();
          for (Row row : rs) result.add(mapLedger(row));
          return result;
        });
  }

  // ── Payment methods ───────────────────────────────────────────────────────

  public Future<List<PaymentMethod>> listPaymentMethods(long institutionId) {
    return db.preparedQuery(
        "SELECT * FROM payment_methods WHERE institution_id = $1 ORDER BY is_default DESC, created_at DESC")
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          List<PaymentMethod> result = new ArrayList<>();
          for (Row row : rs) result.add(mapPaymentMethod(row));
          return result;
        });
  }

  public Future<PaymentMethod> savePaymentMethod(long institutionId, String provider,
      String providerRef, String type, String displayName, String last4, boolean isDefault) {
    return db.withTransaction(conn -> {
      Future<Void> clearDefault = isDefault
          ? conn.preparedQuery(
              "UPDATE payment_methods SET is_default = false WHERE institution_id = $1")
              .execute(Tuple.of(institutionId)).mapEmpty()
          : Future.succeededFuture();
      return clearDefault.compose(ignored ->
          conn.preparedQuery("""
              INSERT INTO payment_methods
                (institution_id, provider, provider_ref, type, display_name, last4, is_default)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING *
              """).execute(Tuple.of(institutionId, provider, providerRef, type, displayName, last4, isDefault))
              .map(rs -> mapPaymentMethod(rs.iterator().next())));
    });
  }

  public Future<Boolean> deletePaymentMethod(long institutionId, long id) {
    return db.preparedQuery(
        "DELETE FROM payment_methods WHERE id = $1 AND institution_id = $2")
        .execute(Tuple.of(id, institutionId))
        .map(rs -> rs.rowCount() > 0);
  }

  public Future<Optional<PaymentMethod>> findPaymentMethod(long institutionId, long id) {
    return db.preparedQuery(
        "SELECT * FROM payment_methods WHERE id = $1 AND institution_id = $2")
        .execute(Tuple.of(id, institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapPaymentMethod(it.next())) : Optional.empty();
        });
  }

  // ── Usage (current billing period = calendar month) ──────────────────────
  //
  // Rolls up every category that actually appears in the ledger for the
  // current month. When new per-call charges are wired through to
  // {@link #debit}, their categories surface here automatically — no
  // hardcoded category list to keep in sync.

  public Future<BillingUsage> getUsage(long institutionId) {
    Future<Row> metaFuture = db.preparedQuery("""
        SELECT
          to_char(date_trunc('month', now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD')   AS period_start,
          to_char(
            date_trunc('month', now() AT TIME ZONE 'UTC')
              + INTERVAL '1 month' - INTERVAL '1 day', 'YYYY-MM-DD')             AS period_end,
          EXTRACT(DAY FROM now() AT TIME ZONE 'UTC')::int                         AS day_of_period,
          EXTRACT(DAY FROM
            date_trunc('month', now() AT TIME ZONE 'UTC')
              + INTERVAL '1 month' - INTERVAL '1 day')::int                      AS days_in_period
        """).execute(Tuple.tuple())
        .map(rs -> rs.iterator().next());

    Future<List<BillingUsage.CategoryUsage>> catFuture = db.preparedQuery("""
        SELECT
          category,
          COUNT(*)           AS event_count,
          SUM(amount_units)  AS total_amount_units
        FROM billing_ledger
        WHERE institution_id = $1
          AND type = 'debit'
          AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC')
          AND created_at <  date_trunc('month', now() AT TIME ZONE 'UTC') + INTERVAL '1 month'
        GROUP BY category
        ORDER BY category
        """).execute(Tuple.of(institutionId))
        .map(rs -> {
          List<BillingUsage.CategoryUsage> cats = new ArrayList<>();
          long totalUnits = 0;
          for (Row row : rs) {
            long amount = row.getLong("total_amount_units");
            long count  = row.getLong("event_count");
            cats.add(new BillingUsage.CategoryUsage(
                row.getString("category"), count, amount,
                count > 0 ? amount / count : 0L));
            totalUnits += amount;
          }
          return cats;
        });

    Future<OffsetDateTime> creditFuture = db.preparedQuery(
        "SELECT credit_expires_at FROM billing_wallets WHERE institution_id = $1")
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? it.next().getOffsetDateTime("credit_expires_at") : null;
        });

    return Future.all(metaFuture, catFuture, creditFuture).map(cf -> {
      Row                              meta            = cf.resultAt(0);
      List<BillingUsage.CategoryUsage> cats            = cf.resultAt(1);
      OffsetDateTime                   creditExpiresAt = cf.resultAt(2);

      long totalDebitUnits = cats.stream()
          .mapToLong(BillingUsage.CategoryUsage::totalAmountUnits).sum();

      boolean isInFreePeriod = creditExpiresAt != null
          && creditExpiresAt.isAfter(OffsetDateTime.now());

      return new BillingUsage(
          meta.getString("period_start"),
          meta.getString("period_end"),
          meta.getInteger("day_of_period"),
          meta.getInteger("days_in_period"),
          totalDebitUnits,
          creditExpiresAt != null ? creditExpiresAt.toString() : null,
          isInFreePeriod,
          cats);
    });
  }

  // ── Mappers ───────────────────────────────────────────────────────────────

  private static BillingWallet mapWallet(Row row) {
    return new BillingWallet(
        row.getLong("id"),
        row.getLong("institution_id"),
        row.getLong("balance_units"),
        row.getOffsetDateTime("credit_expires_at"),
        row.getOffsetDateTime("created_at"),
        row.getOffsetDateTime("updated_at"));
  }

  private static BillingLedgerEntry mapLedger(Row row) {
    return new BillingLedgerEntry(
        row.getString("day_str"),
        row.getString("type"),
        row.getLong("total_amount_units"),
        row.getLong("ending_balance_units"),
        row.getLong("event_count"),
        row.getString("last_ref"));
  }

  private static PaymentMethod mapPaymentMethod(Row row) {
    return new PaymentMethod(
        row.getLong("id"),
        row.getLong("institution_id"),
        row.getString("provider"),
        row.getString("provider_ref"),
        row.getString("type"),
        row.getString("display_name"),
        row.getString("last4"),
        Boolean.TRUE.equals(row.getBoolean("is_default")),
        row.getOffsetDateTime("created_at"));
  }
}
