package com.openiv.backend.billing;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Tuple;

import java.time.OffsetDateTime;

/**
 * Atomic monthly usage tracking for transaction and KYC caps.
 *
 * <p>Each check-and-increment is a single UPDATE statement that:
 * <ol>
 *   <li>Reads the current counter and plan limit from a CTE snapshot.</li>
 *   <li>Conditionally resets the counter when the 30-day period has elapsed.</li>
 *   <li>Increments the counter only when the result would be within the plan cap.</li>
 * </ol>
 * Zero rows returned = limit already reached (or institution not found).
 * One row returned = increment succeeded; {@code allowed = true}.
 *
 * <p>Concurrent requests are safe: PostgreSQL acquires a row-level lock on the
 * institutions row during the UPDATE, so two simultaneous requests cannot both
 * succeed when only one slot remains.
 */
public final class UsageRepository {

  private final Pool db;

  public UsageRepository(Pool db) {
    this.db = db;
  }

  public record UsageResult(boolean allowed, long used, long limit, String planSlug) {}

  public record UsageSummary(
      long monthlyTxnUsed,
      long monthlyKycUsed,
      long monthlyNfiuUsed,
      long monthlyCasesUsed,
      OffsetDateTime usagePeriodStart) {}

  /** Check + increment monthly transaction usage. */
  public Future<UsageResult> checkAndIncrementTxn(long institutionId) {
    return checkAndIncrement(institutionId, "monthly_txn_used", "max_monthly_transactions");
  }

  /** Check + increment monthly KYC step usage by 1 (single-step path). */
  public Future<UsageResult> checkAndIncrementKyc(long institutionId) {
    return checkAndIncrement(institutionId, "monthly_kyc_used", "max_monthly_kyc_lookups");
  }

  /**
   * Atomically reserve {@code points} KYC steps up-front for a pipeline run.
   *
   * Pipelines forecast a worst-case step count (e.g. 7), reserve that many
   * before the first Dojah call, then refund whatever they didn't actually
   * spend. This makes the meter race-safe under concurrent pipelines: if
   * two pipelines try to reserve 7 with only 8 remaining, exactly one wins
   * — the other receives {@code allowed = false} and never makes a Dojah call.
   *
   * @param points worst-case step count required to complete the pipeline
   */
  public Future<UsageResult> reserveKycPoints(long institutionId, int points) {
    if (points <= 0) {
      // Nothing to reserve — treat as allowed pass-through.
      return getSummary(institutionId).map(s -> new UsageResult(
          true, s.monthlyKycUsed(), -1, "unknown"));
    }
    return reserveBatch(institutionId, "monthly_kyc_used", "max_monthly_kyc_lookups", points);
  }

  /**
   * Refund unused points reserved by {@link #reserveKycPoints}.
   *
   * Called at the end of every pipeline run (success, failure, or partial)
   * so the meter reflects actual Dojah usage, not the conservative forecast.
   * Clamps at 0 — counter can never go negative.
   */
  public Future<Void> refundKycPoints(long institutionId, int points) {
    if (points <= 0) return Future.succeededFuture();
    return db.preparedQuery("""
        UPDATE institutions
        SET monthly_kyc_used = GREATEST(monthly_kyc_used - $2, 0)
        WHERE id = $1
        """).execute(Tuple.of(institutionId, (long) points))
        .mapEmpty();
  }

  /** Check + increment monthly NFIU filing usage. */
  public Future<UsageResult> checkAndIncrementNfiu(long institutionId) {
    return checkAndIncrement(institutionId, "monthly_nfiu_used", "max_monthly_nfiu_filings");
  }

  /** Check + increment monthly case-opened usage. */
  public Future<UsageResult> checkAndIncrementCase(long institutionId) {
    return checkAndIncrement(institutionId, "monthly_cases_used", "max_monthly_cases");
  }

  /** Read current usage totals without modifying counters (used by the profile endpoint). */
  public Future<UsageSummary> getSummary(long institutionId) {
    return db.preparedQuery("""
        SELECT monthly_txn_used, monthly_kyc_used, monthly_nfiu_used,
               monthly_cases_used, usage_period_start
        FROM institutions WHERE id = $1
        """)
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) return new UsageSummary(0, 0, 0, 0, null);
          var row = it.next();
          return new UsageSummary(
              row.getLong("monthly_txn_used"),
              row.getLong("monthly_kyc_used"),
              row.getLong("monthly_nfiu_used"),
              row.getLong("monthly_cases_used"),
              row.getOffsetDateTime("usage_period_start"));
        });
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Atomic check-and-increment-by-N. Same semantics as {@link #checkAndIncrement}
   * but reserves {@code points} slots in one shot. Returns {@code allowed=false}
   * if even one slot is missing — never partial reservations.
   */
  private Future<UsageResult> reserveBatch(long institutionId,
      String usedCol, String limitCol, int points) {
    String sql = """
        WITH plan_info AS (
          SELECT
            i.%s                    AS cur_used,
            i.usage_period_start    AS period_start,
            COALESCE(sp.%s, -1)     AS cap,
            COALESCE(sp.slug, 'none') AS plan_slug
          FROM institutions i
          LEFT JOIN subscription_plans sp ON sp.id = i.plan_id
          WHERE i.id = $1
        ),
        updated AS (
          UPDATE institutions
          SET
            %s = CASE
              WHEN p.period_start < now() - INTERVAL '30 days' THEN $2::bigint
              ELSE p.cur_used + $2::bigint
            END,
            usage_period_start = CASE
              WHEN p.period_start < now() - INTERVAL '30 days' THEN now()
              ELSE p.period_start
            END
          FROM plan_info p
          WHERE institutions.id = $1
            AND (
              p.cap = -1
              OR CASE WHEN p.period_start < now() - INTERVAL '30 days'
                 THEN 0 ELSE p.cur_used END + $2::bigint <= p.cap
            )
          RETURNING institutions.%s AS new_used, p.cap, p.plan_slug
        )
        SELECT new_used, cap, plan_slug FROM updated
        """.formatted(usedCol, limitCol, usedCol, usedCol);

    return db.preparedQuery(sql).execute(Tuple.of(institutionId, (long) points))
        .compose(rs -> {
          var it = rs.iterator();
          if (it.hasNext()) {
            var row = it.next();
            return Future.succeededFuture(new UsageResult(
                true,
                row.getLong("new_used"),
                row.getLong("cap"),
                row.getString("plan_slug")));
          }
          // Reservation refused — read current state so we can report deficit
          return db.preparedQuery("""
              SELECT i.%s AS cur_used, COALESCE(sp.%s, -1) AS cap,
                     COALESCE(sp.slug, 'none') AS plan_slug
              FROM institutions i
              LEFT JOIN subscription_plans sp ON sp.id = i.plan_id
              WHERE i.id = $1
              """.formatted(usedCol, limitCol))
              .execute(Tuple.of(institutionId))
              .map(rs2 -> {
                var it2 = rs2.iterator();
                if (!it2.hasNext()) return new UsageResult(false, -1, -1, "unknown");
                var row = it2.next();
                return new UsageResult(false,
                    row.getLong("cur_used"),
                    row.getLong("cap"),
                    row.getString("plan_slug"));
              });
        });
  }

  private Future<UsageResult> checkAndIncrement(long institutionId,
      String usedCol, String limitCol) {
    // The CTE snapshots current state before the UPDATE runs.  The UPDATE CTE
    // conditionally resets the period if expired, then increments — but only
    // when the effective current count is below the plan cap.
    // cap = -1 means unlimited; no plan (LEFT JOIN miss) → COALESCE to -1.
    String sql = """
        WITH plan_info AS (
          SELECT
            i.%s              AS cur_used,
            i.usage_period_start      AS period_start,
            COALESCE(sp.%s, -1)       AS cap,
            COALESCE(sp.slug, 'none') AS plan_slug
          FROM institutions i
          LEFT JOIN subscription_plans sp ON sp.id = i.plan_id
          WHERE i.id = $1
        ),
        updated AS (
          UPDATE institutions
          SET
            %s = CASE
              WHEN p.period_start < now() - INTERVAL '30 days' THEN 1
              ELSE p.cur_used + 1
            END,
            usage_period_start = CASE
              WHEN p.period_start < now() - INTERVAL '30 days' THEN now()
              ELSE p.period_start
            END
          FROM plan_info p
          WHERE institutions.id = $1
            AND (
              p.cap = -1
              OR CASE WHEN p.period_start < now() - INTERVAL '30 days'
                 THEN 0 ELSE p.cur_used END < p.cap
            )
          RETURNING institutions.%s AS new_used, p.cap, p.plan_slug
        )
        SELECT new_used, cap, plan_slug FROM updated
        """.formatted(usedCol, limitCol, usedCol, usedCol);

    return db.preparedQuery(sql).execute(Tuple.of(institutionId))
        .map(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) {
            return new UsageResult(false, -1, -1, "unknown");
          }
          var row = it.next();
          return new UsageResult(
              true,
              row.getLong("new_used"),
              row.getLong("cap"),
              row.getString("plan_slug"));
        });
  }
}
