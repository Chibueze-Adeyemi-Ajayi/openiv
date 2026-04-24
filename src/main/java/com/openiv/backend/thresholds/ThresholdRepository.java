package com.openiv.backend.thresholds;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class ThresholdRepository {

  private final Pool pool;

  public ThresholdRepository(Pool pool) {
    this.pool = pool;
  }

  private record DefaultRule(String ruleId, String name, String description, String tag,
      long threshold, String unit, long min, long max, long step, boolean active) {}

  private static final List<DefaultRule> DEFAULTS = List.of(
      new DefaultRule("high-value-wire",
          "High-value wire transfer",
          "Single wire transfer exceeding threshold triggers review",
          "AML", 5_000_000L, "₦", 100_000L, 50_000_000L, 100_000L, true),
      new DefaultRule("velocity-cluster",
          "Velocity — same beneficiary",
          "More than N transactions to same beneficiary in 1 hour",
          "Fraud", 5L, "count", 1L, 50L, 1L, true),
      new DefaultRule("cross-border-bdc",
          "Cross-border BDC threshold",
          "Cumulative BDC outflow per customer per day",
          "AML", 10_000_000L, "₦", 100_000L, 50_000_000L, 100_000L, true),
      new DefaultRule("late-night-large",
          "Late-night large transfer",
          "Transactions over threshold between 23:00–05:00",
          "Fraud", 1_000_000L, "₦", 100_000L, 50_000_000L, 100_000L, true),
      new DefaultRule("dormant-reactivation",
          "Dormant account reactivation",
          "Account inactive >90 days transacting above threshold",
          "KYC", 500_000L, "₦", 100_000L, 50_000_000L, 100_000L, false)
  );

  private static final String SELECT_COLS =
      "id, institution_id, rule_id, name, description, tag, "
      + "threshold_value, unit, min_value, max_value, step_value, "
      + "is_active, fired_count, created_at, updated_at";

  // ── List ──────────────────────────────────────────────────────────────────

  public Future<List<ThresholdRecord>> list(long institutionId) {
    String sql = "SELECT " + SELECT_COLS
        + " FROM detection_thresholds WHERE institution_id = $1 ORDER BY id ASC";
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId))
        .map(rs -> {
          var list = new ArrayList<ThresholdRecord>();
          rs.forEach(r -> list.add(mapRow(r)));
          return List.copyOf(list);
        });
  }

  // ── Find by id ────────────────────────────────────────────────────────────

  public Future<Optional<ThresholdRecord>> findById(long id, long institutionId) {
    String sql = "SELECT " + SELECT_COLS
        + " FROM detection_thresholds WHERE id = $1 AND institution_id = $2";
    return pool.preparedQuery(sql).execute(Tuple.of(id, institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapRow(it.next())) : Optional.empty();
        });
  }

  // ── Seed defaults if none exist ───────────────────────────────────────────

  public Future<Void> seedIfEmpty(long institutionId) {
    String countSql = "SELECT COUNT(*) FROM detection_thresholds WHERE institution_id = $1";
    return pool.preparedQuery(countSql).execute(Tuple.of(institutionId))
        .compose(rs -> {
          if (rs.iterator().next().getLong(0) > 0) return Future.succeededFuture();

          String insertSql =
              "INSERT INTO detection_thresholds "
              + "(institution_id, rule_id, name, description, tag, threshold_value, "
              + " unit, min_value, max_value, step_value, is_active) "
              + "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING";

          Future<Void> chain = Future.succeededFuture();
          for (DefaultRule d : DEFAULTS) {
            final DefaultRule dr = d;
            chain = chain.compose(v ->
                pool.preparedQuery(insertSql).execute(Tuple.of(
                    institutionId, dr.ruleId(), dr.name(), dr.description(),
                    dr.tag(), dr.threshold(), dr.unit(),
                    dr.min(), dr.max(), dr.step(), dr.active()
                )).mapEmpty()
            );
          }
          return chain;
        });
  }

  // ── Update threshold value ────────────────────────────────────────────────

  public Future<Boolean> updateValue(long id, long institutionId, long newValue) {
    String sql = "UPDATE detection_thresholds SET threshold_value = $1, updated_at = now() "
        + "WHERE id = $2 AND institution_id = $3";
    return pool.preparedQuery(sql).execute(Tuple.of(newValue, id, institutionId))
        .map(rs -> rs.rowCount() > 0);
  }

  // ── Update is_active ──────────────────────────────────────────────────────

  public Future<Boolean> updateActive(long id, long institutionId, boolean isActive) {
    String sql = "UPDATE detection_thresholds SET is_active = $1, updated_at = now() "
        + "WHERE id = $2 AND institution_id = $3";
    return pool.preparedQuery(sql).execute(Tuple.of(isActive, id, institutionId))
        .map(rs -> rs.rowCount() > 0);
  }

  // ── Log a change ─────────────────────────────────────────────────────────

  public Future<Void> addChange(long thresholdId, long institutionId,
      long changedBy, String field, String oldValue, String newValue) {
    String sql =
        "INSERT INTO threshold_changes "
        + "(threshold_id, institution_id, changed_by, field, old_value, new_value) "
        + "VALUES ($1,$2,$3,$4,$5,$6)";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(thresholdId, institutionId, changedBy, field, oldValue, newValue))
        .mapEmpty();
  }

  // ── Change history ────────────────────────────────────────────────────────

  public Future<List<ThresholdChange>> history(long thresholdId, long institutionId) {
    String sql =
        "SELECT tc.id, tc.threshold_id, tc.institution_id, tc.changed_by, "
        + "COALESCE(u.full_name, u.email) AS changed_by_name, "
        + "tc.field, tc.old_value, tc.new_value, tc.created_at "
        + "FROM threshold_changes tc "
        + "LEFT JOIN users u ON u.id = tc.changed_by "
        + "WHERE tc.threshold_id = $1 AND tc.institution_id = $2 "
        + "ORDER BY tc.created_at DESC LIMIT 100";
    return pool.preparedQuery(sql).execute(Tuple.of(thresholdId, institutionId))
        .map(rs -> {
          var list = new ArrayList<ThresholdChange>();
          rs.forEach(r -> list.add(new ThresholdChange(
              r.getLong("id"),
              r.getLong("threshold_id"),
              r.getLong("institution_id"),
              r.getLong("changed_by"),
              r.getString("changed_by_name"),
              r.getString("field"),
              r.getString("old_value"),
              r.getString("new_value"),
              r.getOffsetDateTime("created_at")
          )));
          return List.copyOf(list);
        });
  }

  // ── Metrics ───────────────────────────────────────────────────────────────

  public Future<ThresholdMetrics> metrics(long institutionId) {
    String sql =
        "SELECT "
        + "COUNT(*) FILTER (WHERE is_active)      AS active_count, "
        + "COUNT(*) FILTER (WHERE NOT is_active)  AS paused_count, "
        + "COALESCE(SUM(fired_count), 0)          AS total_fired "
        + "FROM detection_thresholds WHERE institution_id = $1";
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId))
        .map(rs -> {
          Row r = rs.iterator().next();
          return new ThresholdMetrics(
              r.getLong("active_count"),
              r.getLong("paused_count"),
              r.getLong("total_fired"));
        });
  }

  // ── Mapper ────────────────────────────────────────────────────────────────

  private static ThresholdRecord mapRow(Row r) {
    return new ThresholdRecord(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("rule_id"),
        r.getString("name"),
        r.getString("description"),
        r.getString("tag"),
        r.getLong("threshold_value"),
        r.getString("unit"),
        r.getLong("min_value"),
        r.getLong("max_value"),
        r.getLong("step_value"),
        r.getBoolean("is_active"),
        r.getInteger("fired_count"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at")
    );
  }
}
