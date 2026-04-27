package com.openiv.backend.dashboard;

import com.openiv.backend.beam.OtpAlert;
import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

public final class DashboardRepository {

  private final Pool pool;

  public DashboardRepository(Pool pool) {
    this.pool = pool;
  }

  // ── Dashboard stats ────────────────────────────────────────────────────────

  public Future<DashboardStats> stats(long institutionId) {
    OffsetDateTime now           = OffsetDateTime.now(ZoneOffset.UTC);
    LocalDate      today         = now.toLocalDate();
    OffsetDateTime todayStart    = today.atStartOfDay().atOffset(ZoneOffset.UTC);
    OffsetDateTime tomorrowStart = today.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);
    OffsetDateTime yesterdayStart= today.minusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);

    String sql = """
        SELECT
          COALESCE((SELECT COUNT(*)::int FROM transactions
                    WHERE institution_id = $1 AND occurred_at >= $2 AND occurred_at < $3), 0)   AS total_today,
          COALESCE((SELECT COUNT(*)::int FROM transactions
                    WHERE institution_id = $1 AND occurred_at >= $2 AND occurred_at < $3
                      AND flagged_status IS NOT NULL), 0)                                        AS flagged_today,
          COALESCE((SELECT COUNT(*)::int FROM transactions
                    WHERE institution_id = $1 AND occurred_at >= $4 AND occurred_at < $2), 0)   AS total_yesterday,
          COALESCE((SELECT COUNT(*)::int FROM transactions
                    WHERE institution_id = $1 AND occurred_at >= $4 AND occurred_at < $2
                      AND flagged_status IS NOT NULL), 0)                                        AS flagged_yesterday,
          COALESCE((SELECT COUNT(*)::int FROM cases
                    WHERE institution_id = $1
                      AND status NOT IN ('closed')), 0)                                          AS open_cases
        """;

    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, todayStart, tomorrowStart, yesterdayStart))
        .map(rows -> {
          var r = rows.iterator().next();
          return new DashboardStats(
              r.getInteger("total_today"),
              r.getInteger("flagged_today"),
              r.getInteger("total_yesterday"),
              r.getInteger("flagged_yesterday"),
              r.getInteger("open_cases")
          );
        });
  }

  // ── 24-hour transaction flow ───────────────────────────────────────────────

  public Future<List<HourlyBucket>> hourlyFlow(long institutionId) {
    OffsetDateTime now  = OffsetDateTime.now(ZoneOffset.UTC);
    OffsetDateTime from = now.minusHours(24);

    String sql = """
        WITH hours AS (SELECT generate_series(0, 23) AS h)
        SELECT h.h AS hour,
               COALESCE(t.total,   0) AS total,
               COALESCE(t.flagged, 0) AS flagged,
               COALESCE(t.blocked, 0) AS blocked
        FROM hours h
        LEFT JOIN (
          SELECT
            EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'UTC')::int AS hour,
            COUNT(*)::int                                            AS total,
            COUNT(*) FILTER (WHERE flagged_status IS NOT NULL)::int  AS flagged,
            COUNT(*) FILTER (WHERE flagged_status = 'blocked')::int  AS blocked
          FROM transactions
          WHERE institution_id = $1
            AND occurred_at >= $2
            AND occurred_at <  $3
          GROUP BY 1
        ) t ON t.hour = h.h
        ORDER BY h.h
        """;

    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, from, now))
        .map(rows -> {
          var list = new ArrayList<HourlyBucket>(24);
          rows.forEach(r -> list.add(new HourlyBucket(
              r.getInteger("hour"),
              r.getInteger("total"),
              r.getInteger("flagged"),
              r.getInteger("blocked")
          )));
          return list;
        });
  }

  // ── Risk-map points ────────────────────────────────────────────────────────

  public Future<List<RiskPoint>> riskMapPoints(long institutionId,
                                                OffsetDateTime from, OffsetDateTime to) {
    String sql = """
        SELECT
          ROUND(lat::numeric, 2)::float8          AS lat,
          ROUND(lng::numeric, 2)::float8          AS lng,
          COUNT(*)::int                           AS count,
          AVG(risk_score)::float8                 AS avg_risk,
          BOOL_OR(flagged_status IS NOT NULL)     AS has_flag
        FROM transactions
        WHERE institution_id = $1
          AND lat IS NOT NULL AND lng IS NOT NULL
          AND occurred_at >= $2 AND occurred_at < $3
        GROUP BY 1, 2
        ORDER BY count DESC
        LIMIT 2000
        """;

    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, from, to))
        .map(rows -> {
          var list = new ArrayList<RiskPoint>(rows.size());
          rows.forEach(r -> list.add(new RiskPoint(
              r.getDouble("lat"),
              r.getDouble("lng"),
              r.getInteger("count"),
              r.getDouble("avg_risk"),
              Boolean.TRUE.equals(r.getBoolean("has_flag"))
          )));
          return list;
        });
  }

  // ── Activity feed ─────────────────────────────────────────────────────────

  public Future<List<ActivityEvent>> recentActivity(long institutionId) {
    String sql = """
        SELECT id, source, severity, title, detail, entity_id, entity_type, actor, occurred_at
        FROM activity_events
        WHERE institution_id = $1
        ORDER BY id DESC
        LIMIT 30
        """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId))
        .map(rows -> {
          var list = new ArrayList<ActivityEvent>(rows.size());
          rows.forEach(r -> list.add(mapEvent(r)));
          return list;
        });
  }

  public Future<List<ActivityEvent>> activitySince(long institutionId, long lastId) {
    String sql = """
        SELECT id, source, severity, title, detail, entity_id, entity_type, actor, occurred_at
        FROM activity_events
        WHERE institution_id = $1 AND id > $2
        ORDER BY id DESC
        LIMIT 50
        """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, lastId))
        .map(rows -> {
          var list = new ArrayList<ActivityEvent>(rows.size());
          rows.forEach(r -> list.add(mapEvent(r)));
          return list;
        });
  }

  // ── Export CSV ────────────────────────────────────────────────────────────

  public Future<String> exportCsv(long institutionId, OffsetDateTime from, OffsetDateTime to) {
    String sql = """
        SELECT id, customer_id, customer_name, channel, amount, occurred_at,
               status, flagged_status, risk_score, location
        FROM transactions
        WHERE institution_id = $1
          AND occurred_at >= $2
          AND occurred_at <  $3
        ORDER BY occurred_at DESC
        LIMIT 10000
        """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, from, to))
        .map(rows -> {
          var sb = new StringBuilder();
          sb.append("ID,Date,Customer ID,Customer Name,Channel,Amount,Status,Flagged Status,Risk Score,Location\n");
          rows.forEach(r -> {
            sb.append(csv(r.getString("id"))).append(',')
              .append(csv(r.getOffsetDateTime("occurred_at").toString())).append(',')
              .append(csv(r.getString("customer_id"))).append(',')
              .append(csv(r.getString("customer_name"))).append(',')
              .append(csv(r.getString("channel"))).append(',')
              .append(r.getBigDecimal("amount")).append(',')
              .append(csv(r.getString("status"))).append(',')
              .append(csv(nvl(r.getString("flagged_status")))).append(',')
              .append(r.getInteger("risk_score")).append(',')
              .append(csv(nvl(r.getString("location")))).append('\n');
          });
          return sb.toString();
        });
  }

  // ── NFIU return ────────────────────────────────────────────────────────────

  public Future<NfiuReturn> fileNfiuReturn(long institutionId, long filedBy,
                                            LocalDate periodFrom, LocalDate periodTo) {
    OffsetDateTime start = periodFrom.atStartOfDay().atOffset(ZoneOffset.UTC);
    OffsetDateTime end   = periodTo.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);

    String aggrSql = """
        SELECT COUNT(*)::bigint AS total,
               COUNT(*) FILTER (WHERE flagged_status IS NOT NULL)::int AS flagged,
               COALESCE(SUM(amount) FILTER (WHERE flagged_status IS NOT NULL), 0) AS flagged_amount
        FROM transactions
        WHERE institution_id = $1 AND occurred_at >= $2 AND occurred_at < $3
        """;

    return pool.preparedQuery(aggrSql)
        .execute(Tuple.of(institutionId, start, end))
        .compose(aggr -> {
          var row          = aggr.iterator().next();
          long   total     = row.getLong("total");
          int    flagged   = row.getInteger("flagged");
          BigDecimal amount= row.getBigDecimal("flagged_amount");

          String ref = "NFIU-" + periodTo + "-" + institutionId;

          String insertSql = """
              INSERT INTO nfiu_returns
                (institution_id, reference, period_from, period_to,
                 total_transactions, flagged_count, total_flagged_amount, filed_by)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (reference) DO UPDATE
                SET status = 'pending_review', submitted_at = now()
              RETURNING id, reference, period_from, period_to,
                        total_transactions, flagged_count, total_flagged_amount,
                        status, submitted_at
              """;
          return pool.preparedQuery(insertSql)
              .execute(Tuple.of(institutionId, ref, periodFrom, periodTo,
                  total, flagged, amount, filedBy))
              .map(rows -> {
                var r2 = rows.iterator().next();
                return new NfiuReturn(
                    r2.getLong("id"),
                    r2.getString("reference"),
                    r2.getLocalDate("period_from"),
                    r2.getLocalDate("period_to"),
                    r2.getLong("total_transactions"),
                    r2.getInteger("flagged_count"),
                    r2.getBigDecimal("total_flagged_amount"),
                    r2.getString("status"),
                    r2.getOffsetDateTime("submitted_at")
                );
              });
        });
  }

  // ── OTP alerts ────────────────────────────────────────────────────────────

  public Future<List<OtpAlert>> recentOtpAlerts(long institutionId) {
    String sql = """
        SELECT id, institution_id, rule, severity, customer_id, device_id,
               channel, otp_type, event_count, detail, fired_at
        FROM otp_alerts
        WHERE institution_id = $1
        ORDER BY id DESC
        LIMIT 30
        """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId))
        .map(rows -> {
          var list = new ArrayList<OtpAlert>(rows.size());
          rows.forEach(r -> list.add(mapOtpAlert(r)));
          return list;
        });
  }

  public Future<List<OtpAlert>> otpAlertsSince(long institutionId, long lastId) {
    String sql = """
        SELECT id, institution_id, rule, severity, customer_id, device_id,
               channel, otp_type, event_count, detail, fired_at
        FROM otp_alerts
        WHERE institution_id = $1 AND id > $2
        ORDER BY id DESC
        LIMIT 50
        """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, lastId))
        .map(rows -> {
          var list = new ArrayList<OtpAlert>(rows.size());
          rows.forEach(r -> list.add(mapOtpAlert(r)));
          return list;
        });
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private static ActivityEvent mapEvent(Row r) {
    return new ActivityEvent(
        r.getLong("id"),
        r.getString("source"),
        r.getString("severity"),
        r.getString("title"),
        r.getString("detail"),
        r.getString("entity_id"),
        r.getString("entity_type"),
        r.getString("actor"),
        r.getOffsetDateTime("occurred_at")
    );
  }

  private static OtpAlert mapOtpAlert(Row r) {
    return new OtpAlert(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("rule"),
        r.getString("severity"),
        r.getString("customer_id"),
        r.getString("device_id"),
        r.getString("channel"),
        r.getString("otp_type"),
        r.getInteger("event_count"),
        r.getString("detail"),
        r.getOffsetDateTime("fired_at")
    );
  }

  private static String csv(String s) {
    if (s == null) return "";
    if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
      return "\"" + s.replace("\"", "\"\"") + "\"";
    }
    return s;
  }

  private static String nvl(String s) { return s == null ? "" : s; }
}
