package com.openiv.backend.alerts;

import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.RowSet;
import io.vertx.sqlclient.Tuple;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class InstitutionAlertRepository {

  private final Pool pool;

  public InstitutionAlertRepository(Pool pool) {
    this.pool = pool;
  }

  private static final String COLS =
      "id, institution_id, alert_type, title, message, severity, status, metadata, created_at, updated_at";

  public Future<List<InstitutionAlert>> listByInstitution(long institutionId) {
    return pool.preparedQuery(
            "SELECT " + COLS + " FROM institution_alerts WHERE institution_id = $1 ORDER BY created_at DESC LIMIT 100")
        .execute(Tuple.of(institutionId))
        .map(InstitutionAlertRepository::mapList);
  }

  public Future<Optional<InstitutionAlert>> findOpenSurge(long institutionId, OffsetDateTime since) {
    return pool.preparedQuery(
            "SELECT " + COLS + " FROM institution_alerts " +
            "WHERE institution_id = $1 AND alert_type = 'TRANSACTION_SURGE' AND status IN ('open','investigating') " +
            "AND created_at >= $2 ORDER BY created_at DESC LIMIT 1")
        .execute(Tuple.of(institutionId, since))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(map(it.next())) : Optional.empty();
        });
  }

  public Future<InstitutionAlert> create(long institutionId, String alertType, String title,
                                         String message, String severity, JsonObject metadata) {
    return pool.preparedQuery(
            "INSERT INTO institution_alerts (institution_id, alert_type, title, message, severity, metadata) " +
            "VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING " + COLS)
        .execute(Tuple.of(institutionId, alertType, title, message, severity,
            metadata != null ? metadata.encode() : null))
        .map(rs -> map(rs.iterator().next()));
  }

  public Future<InstitutionAlert> updateStatus(long id, long institutionId, String status) {
    return pool.preparedQuery(
            "UPDATE institution_alerts SET status = $3, updated_at = NOW() " +
            "WHERE id = $1 AND institution_id = $2 RETURNING " + COLS)
        .execute(Tuple.of(id, institutionId, status))
        .map(rs -> map(rs.iterator().next()));
  }

  /** Groups all transactions from the last 24 hours by customer, ranked by suspiciousness. */
  public Future<List<SuspiciousCustomer>> investigateAlert(long institutionId) {
    String sql =
        "SELECT c.id AS customer_id, c.name AS customer_name, " +
        "       COALESCE(c.overall_risk_score, 0) AS overall_risk_score, " +
        "       COUNT(t.id) AS txn_count, " +
        "       COALESCE(SUM(t.amount), 0) AS total_amount, " +
        "       COALESCE(AVG(t.risk_score), 0) AS avg_risk_score, " +
        "       COUNT(t.id) FILTER (WHERE t.risk_score >= 51) AS flagged_count, " +
        "       COUNT(t.id) FILTER (WHERE t.risk_score >= 81) AS cased_count " +
        "FROM transactions t " +
        "JOIN customers c ON t.customer_id = c.id AND c.institution_id = $1 " +
        "WHERE t.institution_id = $1 AND t.created_at >= NOW() - INTERVAL '24 hours' " +
        "GROUP BY c.id, c.name, c.overall_risk_score " +
        "HAVING COUNT(t.id) FILTER (WHERE t.risk_score >= 51) > 0 OR AVG(t.risk_score) > 30 " +
        "ORDER BY cased_count DESC, flagged_count DESC, avg_risk_score DESC " +
        "LIMIT 25";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          List<SuspiciousCustomer> list = new ArrayList<>();
          for (Row row : rs) {
            list.add(new SuspiciousCustomer(
                row.getLong("customer_id"),
                row.getString("customer_name"),
                row.getInteger("overall_risk_score"),
                row.getLong("txn_count"),
                row.getBigDecimal("total_amount"),
                row.getDouble("avg_risk_score"),
                row.getLong("flagged_count"),
                row.getLong("cased_count")));
          }
          return list;
        });
  }

  public record SuspiciousCustomer(
      long       customerId,
      String     customerName,
      int        overallRiskScore,
      long       txnCount,
      BigDecimal totalAmount,
      double     avgRiskScore,
      long       flaggedCount,
      long       casedCount
  ) {}

  private static InstitutionAlert map(Row r) {
    // metadata is JSONB — Vert.x returns it as a JsonObject, not a String.
    JsonObject meta = r.getJsonObject("metadata");
    return new InstitutionAlert(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("alert_type"),
        r.getString("title"),
        r.getString("message"),
        r.getString("severity"),
        r.getString("status"),
        meta != null ? meta : new JsonObject(),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"));
  }

  private static List<InstitutionAlert> mapList(RowSet<Row> rs) {
    List<InstitutionAlert> list = new ArrayList<>();
    for (Row r : rs) list.add(map(r));
    return list;
  }
}
