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
      long threshold, String unit, long min, long max, long step, boolean active, int riskScore) {}

  private static final List<DefaultRule> DEFAULTS = List.of(
      new DefaultRule("high-value-wire",
          "High-value wire transfer",
          "Single wire transfer exceeding threshold triggers review",
          "AML", 5_000_000L, "₦", 100_000L, 50_000_000L, 100_000L, true, 35),
      new DefaultRule("velocity-cluster",
          "Velocity — same beneficiary",
          "More than N transactions to same beneficiary in 1 hour",
          "Fraud", 5L, "count", 1L, 50L, 1L, true, 25),
      new DefaultRule("cross-border-bdc",
          "Cross-border BDC threshold",
          "Cumulative BDC outflow per customer per day",
          "AML", 10_000_000L, "₦", 100_000L, 50_000_000L, 100_000L, true, 30),
      new DefaultRule("late-night-large",
          "Late-night large transfer",
          "Transactions over threshold between 23:00–05:00",
          "Fraud", 1_000_000L, "₦", 100_000L, 50_000_000L, 100_000L, true, 30),
      new DefaultRule("dormant-reactivation",
          "Dormant account reactivation",
          "Account inactive >90 days transacting above threshold",
          "KYC", 500_000L, "₦", 100_000L, 50_000_000L, 100_000L, false, 20),
      new DefaultRule("velocity-spike",
          "Institution Volume Spike",
          "Flags when today's institution-wide transaction count exceeds yesterday's by the configured percentage. Set threshold_value to 130 for a 30% spike.",
          "AML", 130L, "%", 105L, 400L, 5L, true, 20)
  );

  private static final String SELECT_COLS =
      "id, institution_id, rule_id, name, description, tag, "
      + "threshold_value, unit, min_value, max_value, step_value, "
      + "is_active, fired_count, created_at, updated_at, threshold_outward, threshold_inward, risk_score";

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
              + " unit, min_value, max_value, step_value, is_active, threshold_outward, threshold_inward, risk_score) "
              + "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13) ON CONFLICT DO NOTHING";

          Future<Void> chain = Future.succeededFuture();
          for (DefaultRule d : DEFAULTS) {
            final DefaultRule dr = d;
            chain = chain.compose(v ->
                pool.preparedQuery(insertSql).execute(Tuple.of(
                    institutionId, dr.ruleId(), dr.name(), dr.description(),
                    dr.tag(), dr.threshold(), dr.unit(),
                    dr.min(), dr.max(), dr.step(), dr.active(), dr.threshold(), dr.riskScore()
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

  // ── Update per-direction thresholds ──────────────────────────────────────

  public Future<Boolean> updateOutwardThreshold(long id, long institutionId, Long value) {
    String sql = "UPDATE detection_thresholds SET threshold_outward = $1, updated_at = now() "
        + "WHERE id = $2 AND institution_id = $3";
    return pool.preparedQuery(sql).execute(Tuple.of(value, id, institutionId))
        .map(rs -> rs.rowCount() > 0);
  }

  public Future<Boolean> updateInwardThreshold(long id, long institutionId, Long value) {
    String sql = "UPDATE detection_thresholds SET threshold_inward = $1, updated_at = now() "
        + "WHERE id = $2 AND institution_id = $3";
    return pool.preparedQuery(sql).execute(Tuple.of(value, id, institutionId))
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
        + "tc.field, tc.old_value, tc.new_value, tc.created_at, dt.name AS rule_name "
        + "FROM threshold_changes tc "
        + "LEFT JOIN users u ON u.id = tc.changed_by "
        + "LEFT JOIN detection_thresholds dt ON dt.id = tc.threshold_id "
        + "WHERE tc.threshold_id = $1 AND tc.institution_id = $2 "
        + "ORDER BY tc.created_at DESC LIMIT 100";
    return pool.preparedQuery(sql).execute(Tuple.of(thresholdId, institutionId))
        .map(rs -> {
          var list = new ArrayList<ThresholdChange>();
          rs.forEach(r -> list.add(mapChange(r)));
          return List.copyOf(list);
        });
  }

  public Future<List<ThresholdChange>> allHistory(long institutionId) {
    String sql =
        "SELECT tc.id, tc.threshold_id, tc.institution_id, tc.changed_by, "
        + "COALESCE(u.full_name, u.email) AS changed_by_name, "
        + "tc.field, tc.old_value, tc.new_value, tc.created_at, dt.name AS rule_name "
        + "FROM threshold_changes tc "
        + "LEFT JOIN users u ON u.id = tc.changed_by "
        + "LEFT JOIN detection_thresholds dt ON dt.id = tc.threshold_id "
        + "WHERE tc.institution_id = $1 "
        + "ORDER BY tc.created_at DESC LIMIT 200";
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId))
        .map(rs -> {
          var list = new ArrayList<ThresholdChange>();
          rs.forEach(r -> list.add(mapChange(r)));
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

  // ── KYC Suppression ───────────────────────────────────────────────────────

  public Future<Boolean> getKycSuppressed(long institutionId) {
    String sql = "SELECT kyc_warning_suppressed FROM institutions WHERE id = $1";
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() && it.next().getBoolean("kyc_warning_suppressed");
        });
  }

  public Future<Void> setKycSuppressed(long institutionId, boolean suppressed) {
    String sql = "UPDATE institutions SET kyc_warning_suppressed = $1, updated_at = now() WHERE id = $2";
    return pool.preparedQuery(sql).execute(Tuple.of(suppressed, institutionId)).mapEmpty();
  }

  // ── KYC Tier Thresholds ────────────────────────────────────────────────────

  public Future<Void> seedKycTiersIfEmpty(long institutionId) {
    String countSql = "SELECT COUNT(*) FROM threshold_by_kyc_tier WHERE institution_id = $1";
    return pool.preparedQuery(countSql).execute(Tuple.of(institutionId))
        .compose(rs -> {
          if (rs.iterator().next().getLong(0) > 0) return Future.succeededFuture();

          // CBN-aligned defaults per tier: Tier 0 (Unverified) → Tier 3 (Full KYC)
          record TierDefaults(int tier, long dWire, long dMobile, long dUssd, long dBdc, long dOther,
              long dWireIn, long dWireOut, long dMobileIn, long dMobileOut,
              long dUssdIn, long dUssdOut, long dBdcIn, long dBdcOut,
              long dOtherIn, long dOtherOut,
              long sTxnWire, long sTxnMobile, long sTxnUssd, long sTxnBdc, long sTxnOther,
              int maxHr, int maxDay, int boost, boolean addlVerify) {}

          List<TierDefaults> defaults = List.of(
              new TierDefaults(0,
                    500_000L,  100_000L,  50_000L,  1_000_000L,  100_000L,
                    500_000L,  200_000L,  100_000L,   50_000L,   50_000L,  25_000L, 1_000_000L, 500_000L,  100_000L,  50_000L,
                    250_000L,   50_000L,  25_000L,    500_000L,   50_000L, 5,  10, 20, true),
              new TierDefaults(1,
                  2_000_000L,  500_000L, 200_000L,  3_000_000L,  500_000L,
                  2_000_000L, 1_000_000L, 500_000L, 250_000L, 200_000L, 100_000L, 3_000_000L, 1_500_000L, 500_000L, 250_000L,
                  1_000_000L,  250_000L, 100_000L,  1_500_000L,  250_000L, 8,  30, 10, false),
              new TierDefaults(2,
                  5_000_000L, 2_000_000L, 500_000L, 10_000_000L, 1_000_000L,
                  5_000_000L, 3_000_000L, 2_000_000L, 1_000_000L, 500_000L, 300_000L, 10_000_000L, 6_000_000L, 1_000_000L, 600_000L,
                  2_500_000L, 1_000_000L, 250_000L,  5_000_000L,  500_000L, 10, 50,  5, false),
              new TierDefaults(3,
                  50_000_000L, 10_000_000L, 2_000_000L, 100_000_000L, 5_000_000L,
                  50_000_000L, 30_000_000L, 10_000_000L, 6_000_000L, 2_000_000L, 1_000_000L, 100_000_000L, 50_000_000L, 5_000_000L, 3_000_000L,
                  25_000_000L,  5_000_000L, 1_000_000L, 50_000_000L, 2_000_000L, 20, 100, 0, false)
          );

          String insertSql =
              "INSERT INTO threshold_by_kyc_tier "
              + "(institution_id, kyc_tier, daily_limit_wire, daily_limit_mobile, daily_limit_ussd, "
              + " daily_limit_bdc, daily_limit_other, "
              + " daily_limit_wire_inward, daily_limit_wire_outward, daily_limit_mobile_inward, daily_limit_mobile_outward, "
              + " daily_limit_ussd_inward, daily_limit_ussd_outward, daily_limit_bdc_inward, daily_limit_bdc_outward, "
              + " daily_limit_other_inward, daily_limit_other_outward, "
              + " single_txn_limit_wire, single_txn_limit_mobile, "
              + " single_txn_limit_ussd, single_txn_limit_bdc, single_txn_limit_other, "
              + " max_txns_per_hour, max_txns_per_day, risk_score_boost, requires_additional_verification) "
              + "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26) ON CONFLICT DO NOTHING";

          Future<Void> chain = Future.succeededFuture();
          for (TierDefaults d : defaults) {
            final TierDefaults td = d;
            chain = chain.compose(v ->
                pool.preparedQuery(insertSql).execute(Tuple.of(
                    institutionId, td.tier(),
                    td.dWire(), td.dMobile(), td.dUssd(), td.dBdc(), td.dOther(),
                    td.dWireIn(), td.dWireOut(), td.dMobileIn(), td.dMobileOut(),
                    td.dUssdIn(), td.dUssdOut(), td.dBdcIn(), td.dBdcOut(),
                    td.dOtherIn(), td.dOtherOut(),
                    td.sTxnWire(), td.sTxnMobile(), td.sTxnUssd(), td.sTxnBdc(), td.sTxnOther(),
                    td.maxHr(), td.maxDay(), td.boost(), td.addlVerify()
                )).mapEmpty()
            );
          }
          return chain;
        });
  }

  public Future<List<KycTierRecord>> listKycTierThresholds(long institutionId) {
    String sql = "SELECT id, institution_id, kyc_tier, daily_limit_wire, daily_limit_mobile, daily_limit_ussd, "
        + "daily_limit_bdc, daily_limit_other, "
        + "daily_limit_wire_inward, daily_limit_wire_outward, daily_limit_mobile_inward, daily_limit_mobile_outward, "
        + "daily_limit_ussd_inward, daily_limit_ussd_outward, daily_limit_bdc_inward, daily_limit_bdc_outward, "
        + "daily_limit_other_inward, daily_limit_other_outward, "
        + "single_txn_limit_wire, single_txn_limit_mobile, "
        + "single_txn_limit_ussd, single_txn_limit_bdc, single_txn_limit_other, max_txns_per_hour, "
        + "max_txns_per_day, risk_score_boost, requires_additional_verification, created_at, updated_at "
        + "FROM threshold_by_kyc_tier WHERE institution_id = $1 ORDER BY kyc_tier ASC";
    return seedKycTiersIfEmpty(institutionId)
        .compose(v -> pool.preparedQuery(sql).execute(Tuple.of(institutionId)))
        .map(rs -> {
          var list = new ArrayList<KycTierRecord>();
          rs.forEach(r -> list.add(mapKycTierRow(r)));
          return List.copyOf(list);
        });
  }

  public Future<Void> updateKycTierThreshold(long institutionId, int tier, String field, long value) {
    // Basic SQL injection protection by only allowing known fields
    List<String> allowedFields = List.of(
        "daily_limit_wire", "daily_limit_mobile", "daily_limit_ussd", "daily_limit_bdc", "daily_limit_other",
        "daily_limit_wire_inward", "daily_limit_wire_outward",
        "daily_limit_mobile_inward", "daily_limit_mobile_outward",
        "daily_limit_ussd_inward", "daily_limit_ussd_outward",
        "daily_limit_bdc_inward", "daily_limit_bdc_outward",
        "daily_limit_other_inward", "daily_limit_other_outward",
        "single_txn_limit_wire", "single_txn_limit_mobile", "single_txn_limit_ussd", "single_txn_limit_bdc", "single_txn_limit_other",
        "max_txns_per_hour", "max_txns_per_day", "risk_score_boost"
    );
    if (!allowedFields.contains(field)) {
      return Future.failedFuture(new IllegalArgumentException("Invalid field: " + field));
    }

    String sql = "UPDATE threshold_by_kyc_tier SET " + field + " = $1, updated_at = now() "
        + "WHERE institution_id = $2 AND kyc_tier = $3";
    return pool.preparedQuery(sql).execute(Tuple.of(value, institutionId, tier)).mapEmpty();
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
        r.getOffsetDateTime("updated_at"),
        r.getLong("threshold_outward"),
        r.getLong("threshold_inward"),
        r.getInteger("risk_score")
    );
  }

  private static ThresholdChange mapChange(Row r) {
    return new ThresholdChange(
        r.getLong("id"),
        r.getLong("threshold_id"),
        r.getLong("institution_id"),
        r.getLong("changed_by"),
        r.getString("changed_by_name"),
        r.getString("field"),
        r.getString("old_value"),
        r.getString("new_value"),
        r.getOffsetDateTime("created_at"),
        r.getString("rule_name")
    );
  }

  private static KycTierRecord mapKycTierRow(Row r) {
    return new KycTierRecord(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getInteger("kyc_tier"),
        r.getLong("daily_limit_wire"),
        r.getLong("daily_limit_mobile"),
        r.getLong("daily_limit_ussd"),
        r.getLong("daily_limit_bdc"),
        r.getLong("daily_limit_other"),
        r.getLong("daily_limit_wire_inward"),
        r.getLong("daily_limit_wire_outward"),
        r.getLong("daily_limit_mobile_inward"),
        r.getLong("daily_limit_mobile_outward"),
        r.getLong("daily_limit_ussd_inward"),
        r.getLong("daily_limit_ussd_outward"),
        r.getLong("daily_limit_bdc_inward"),
        r.getLong("daily_limit_bdc_outward"),
        r.getLong("daily_limit_other_inward"),
        r.getLong("daily_limit_other_outward"),
        r.getLong("single_txn_limit_wire"),
        r.getLong("single_txn_limit_mobile"),
        r.getLong("single_txn_limit_ussd"),
        r.getLong("single_txn_limit_bdc"),
        r.getLong("single_txn_limit_other"),
        r.getInteger("max_txns_per_hour"),
        r.getInteger("max_txns_per_day"),
        r.getInteger("risk_score_boost"),
        r.getBoolean("requires_additional_verification"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at")
    );
  }
}
