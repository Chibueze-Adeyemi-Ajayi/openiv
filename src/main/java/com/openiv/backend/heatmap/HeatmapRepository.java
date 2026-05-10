package com.openiv.backend.heatmap;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Tuple;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

public final class HeatmapRepository {

  private final Pool pool;

  public HeatmapRepository(Pool pool) {
    this.pool = pool;
  }

  /** Aggregate transactions by calendar day within [from, to] inclusive.
   *  Day-bucket and date filter both use created_at (system ingestion time), not occurred_at. */
  public Future<List<HeatmapCell>> transactionCells(long institutionId, boolean abnormal, LocalDate from, LocalDate to) {
    String modeClause = abnormal
        ? "AND flagged_status IS NOT NULL"
        : "AND flagged_status IS NULL";
    String sql = """
        SELECT
          DATE(created_at AT TIME ZONE 'UTC') AS day,
          COUNT(*)::int                       AS count,
          AVG(risk_score)::float8             AS avg_risk
        FROM transactions
        WHERE institution_id = $1
          AND created_at >= $2
          AND created_at <  $3
          %s
        GROUP BY 1
        ORDER BY 1
        """.formatted(modeClause);
    return query(sql, institutionId, from, to, true);
  }

  /** Aggregate login events from beam_records by calendar day within [from, to] inclusive. */
  public Future<List<HeatmapCell>> activityCells(long institutionId, boolean abnormal, LocalDate from, LocalDate to) {
    String outcomeClause = abnormal
        ? "AND (payload::jsonb)->>'outcome' <> 'success'"
        : "AND (payload::jsonb)->>'outcome' = 'success'";
    String sql = """
        SELECT
          DATE(received_at AT TIME ZONE 'UTC') AS day,
          COUNT(*)::int                        AS count,
          NULL::float8                         AS avg_risk
        FROM beam_records
        WHERE institution_id = $1
          AND stream = 'logins'
          AND received_at >= $2
          AND received_at <  $3
          AND payload LIKE '{%%'
          %s
        GROUP BY 1
        ORDER BY 1
        """.formatted(outcomeClause);
    return query(sql, institutionId, from, to, false);
  }

  private Future<List<HeatmapCell>> query(String sql, long institutionId, LocalDate from, LocalDate to, boolean readRisk) {
    OffsetDateTime start = from.atStartOfDay().atOffset(ZoneOffset.UTC);
    OffsetDateTime end   = to.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC); // exclusive
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, start, end))
        .map(rows -> {
          var cells = new ArrayList<HeatmapCell>(rows.size());
          rows.forEach(r -> {
            LocalDate date  = r.getLocalDate("day");
            int       count = r.getInteger("count");
            Double    risk  = readRisk ? r.getDouble("avg_risk") : null;
            cells.add(new HeatmapCell(date, count, risk));
          });
          return cells;
        });
  }
}
