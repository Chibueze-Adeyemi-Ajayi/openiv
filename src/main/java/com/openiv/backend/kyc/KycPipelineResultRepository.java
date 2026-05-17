package com.openiv.backend.kyc;

import com.openiv.backend.doja.PipelineStepResult;
import com.openiv.backend.doja.PipelineVerificationResult;
import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class KycPipelineResultRepository {

  private final Pool pool;

  public KycPipelineResultRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<KycPipelineResult> save(long institutionId, String customerId,
      PipelineVerificationResult result, String actionTaken,
      Long monthlyInflow, Long monthlyOutflow) {

    PipelineStepResult bvn  = findStep(result, "bvn_nin");
    PipelineStepResult ph   = findStep(result, "phone_match");
    PipelineStepResult liv  = findStep(result, "liveness");
    PipelineStepResult pep  = findStep(result, "pep_check");

    String sql = "INSERT INTO kyc_pipeline_results "
        + "(institution_id, customer_id, overall_risk_score, kyc_tier, overall_status, action_taken,"
        + " bvn_nin_status, bvn_nin_score, bvn_nin_detail,"
        + " phone_status, phone_score, phone_detail,"
        + " liveness_status, liveness_score, liveness_detail,"
        + " pep_status, pep_score, pep_detail, duration_ms, identity_photo_b64,"
        + " first_name, last_name, phone, date_of_birth,"
        + " monthly_inflow, monthly_outflow) "
        + "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26) "
        + "ON CONFLICT (institution_id, customer_id) DO UPDATE SET "
        + " run_at = NOW(),"
        + " overall_risk_score = EXCLUDED.overall_risk_score,"
        + " kyc_tier           = EXCLUDED.kyc_tier,"
        + " overall_status     = EXCLUDED.overall_status,"
        + " action_taken       = EXCLUDED.action_taken,"
        + " bvn_nin_status     = EXCLUDED.bvn_nin_status,"
        + " bvn_nin_score      = EXCLUDED.bvn_nin_score,"
        + " bvn_nin_detail     = EXCLUDED.bvn_nin_detail,"
        + " phone_status       = EXCLUDED.phone_status,"
        + " phone_score        = EXCLUDED.phone_score,"
        + " phone_detail       = EXCLUDED.phone_detail,"
        + " liveness_status    = EXCLUDED.liveness_status,"
        + " liveness_score     = EXCLUDED.liveness_score,"
        + " liveness_detail    = EXCLUDED.liveness_detail,"
        + " pep_status         = EXCLUDED.pep_status,"
        + " pep_score          = EXCLUDED.pep_score,"
        + " pep_detail         = EXCLUDED.pep_detail,"
        + " duration_ms        = EXCLUDED.duration_ms,"
        + " identity_photo_b64 = EXCLUDED.identity_photo_b64,"
        + " first_name         = EXCLUDED.first_name,"
        + " last_name          = EXCLUDED.last_name,"
        + " phone              = EXCLUDED.phone,"
        + " date_of_birth      = EXCLUDED.date_of_birth,"
        + " monthly_inflow     = EXCLUDED.monthly_inflow,"
        + " monthly_outflow    = EXCLUDED.monthly_outflow "
        + "RETURNING id, run_at";

    return pool.preparedQuery(sql)
        .execute(Tuple.of(
            institutionId, customerId,
            result.overallRiskScore(), result.kycTier(), result.overallStatus(), actionTaken,
            status(bvn),  score(bvn),  detail(bvn),
            status(ph),   score(ph),   detail(ph),
            status(liv),  score(liv),  detail(liv),
            status(pep),  score(pep),  detail(pep),
            result.totalDurationMs(), result.identityPhoto(),
            result.firstName(), result.lastName(), result.phone(), result.dateOfBirth(),
            monthlyInflow, monthlyOutflow))
        .map(rs -> {
          Row r = rs.iterator().next();
          return new KycPipelineResult(
              r.getLong("id"), institutionId, customerId, r.getOffsetDateTime("run_at"),
              result.overallRiskScore(), result.kycTier(), result.overallStatus(), actionTaken,
              status(bvn),  score(bvn),  detail(bvn),
              status(ph),   score(ph),   detail(ph),
              status(liv),  score(liv),  detail(liv),
              status(pep),  score(pep),  detail(pep),
              result.totalDurationMs(), result.identityPhoto(),
              result.firstName(), result.lastName(), result.phone(), result.dateOfBirth(),
              monthlyInflow, monthlyOutflow);
        });
  }

  public Future<Optional<KycPipelineResult>> findLatestByCustomer(long institutionId, String customerId) {
    return pool.preparedQuery(
        "SELECT * FROM kyc_pipeline_results WHERE institution_id=$1 AND customer_id=$2 ORDER BY run_at DESC LIMIT 1")
        .execute(Tuple.of(institutionId, customerId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapRow(it.next())) : Optional.<KycPipelineResult>empty();
        });
  }

  public Future<List<KycPipelineResult>> listByCustomer(long institutionId, String customerId, int limit) {
    return pool.preparedQuery(
        "SELECT * FROM kyc_pipeline_results WHERE institution_id=$1 AND customer_id=$2 ORDER BY run_at DESC LIMIT $3")
        .execute(Tuple.of(institutionId, customerId, limit))
        .map(rs -> {
          List<KycPipelineResult> list = new ArrayList<>();
          rs.forEach(r -> list.add(mapRow(r)));
          return list;
        });
  }

  public Future<List<KycPipelineResult>> listLatestPerCustomer(long institutionId) {
    return listLatestPerCustomerFiltered(institutionId, null, null);
  }

  public Future<List<KycPipelineResult>> listLatestPerCustomerFiltered(
      long institutionId, String filter, String search) {
    StringBuilder sql = new StringBuilder(
        "SELECT kpr.* FROM kyc_pipeline_results kpr "
        + "INNER JOIN ("
        + "  SELECT customer_id, MAX(run_at) as latest FROM kyc_pipeline_results "
        + "  WHERE institution_id = $1 GROUP BY customer_id"
        + ") mx ON kpr.customer_id = mx.customer_id AND kpr.run_at = mx.latest "
        + "WHERE kpr.institution_id = $1");

    if ("high-risk".equals(filter)) {
      sql.append(" AND kpr.overall_risk_score >= 75");
    } else if ("low-risk".equals(filter)) {
      sql.append(" AND kpr.overall_risk_score < 35");
    } else if ("verified".equals(filter)) {
      sql.append(" AND kpr.overall_status = 'verified'");
    } else if ("flagged".equals(filter)) {
      sql.append(" AND kpr.overall_status = 'flagged'");
    }

    Tuple params;
    if (search != null && !search.isBlank()) {
      sql.append(" AND (kpr.customer_id ILIKE $2"
          + " OR kpr.first_name ILIKE $2"
          + " OR kpr.last_name ILIKE $2"
          + " OR CONCAT(kpr.first_name, ' ', kpr.last_name) ILIKE $2)");
      params = Tuple.of(institutionId, "%" + search.trim() + "%");
    } else {
      params = Tuple.of(institutionId);
    }

    sql.append(" ORDER BY kpr.overall_risk_score DESC LIMIT 200");

    return pool.preparedQuery(sql.toString())
        .execute(params)
        .map(rs -> {
          List<KycPipelineResult> list = new ArrayList<>();
          rs.forEach(r -> list.add(mapRow(r)));
          return list;
        });
  }

  /**
   * Returns customer summaries with the full weighted total risk score
   * (20% KYC + 55% case history + 25% transaction) joined from the customers table.
   * The filter thresholds use total_risk rather than the KYC-only overallRiskScore.
   */
  public Future<List<JsonObject>> listCustomerSummaries(
      long institutionId, String filter, String search) {

    String base =
        "SELECT kpr.customer_id, kpr.overall_risk_score, kpr.kyc_tier,"
        + " kpr.overall_status, kpr.action_taken, kpr.run_at,"
        + " kpr.bvn_nin_status, kpr.bvn_nin_score,"
        + " kpr.phone_status,   kpr.phone_score,"
        + " kpr.liveness_status, kpr.liveness_score,"
        + " kpr.pep_status,     kpr.pep_score,"
        + " kpr.identity_photo_b64, kpr.first_name, kpr.last_name,"
        + " kpr.phone, kpr.date_of_birth,"
        + " COALESCE(c.overall_risk_score, kpr.overall_risk_score) AS total_risk_score"
        + " FROM kyc_pipeline_results kpr"
        + " INNER JOIN ("
        + "   SELECT customer_id, MAX(run_at) AS latest"
        + "   FROM kyc_pipeline_results WHERE institution_id = $1 GROUP BY customer_id"
        + " ) mx ON kpr.customer_id = mx.customer_id AND kpr.run_at = mx.latest"
        + " LEFT JOIN customers c"
        + "   ON c.institution_id = kpr.institution_id AND c.external_id = kpr.customer_id"
        + " WHERE kpr.institution_id = $1";

    StringBuilder sql = new StringBuilder(base);
    if ("high-risk".equals(filter)) {
      sql.append(" AND COALESCE(c.overall_risk_score, kpr.overall_risk_score) >= 75");
    } else if ("low-risk".equals(filter)) {
      sql.append(" AND COALESCE(c.overall_risk_score, kpr.overall_risk_score) < 35");
    } else if ("verified".equals(filter)) {
      sql.append(" AND kpr.overall_status = 'verified'");
    } else if ("flagged".equals(filter)) {
      sql.append(" AND kpr.overall_status = 'flagged'");
    }

    Tuple params;
    if (search != null && !search.isBlank()) {
      sql.append(" AND (kpr.customer_id ILIKE $2"
          + " OR kpr.first_name ILIKE $2"
          + " OR kpr.last_name ILIKE $2"
          + " OR CONCAT(kpr.first_name,' ',kpr.last_name) ILIKE $2)");
      params = Tuple.of(institutionId, "%" + search.trim() + "%");
    } else {
      params = Tuple.of(institutionId);
    }

    sql.append(" ORDER BY total_risk_score DESC LIMIT 200");

    return pool.preparedQuery(sql.toString())
        .execute(params)
        .map(rs -> {
          List<JsonObject> list = new ArrayList<>();
          rs.forEach(r -> list.add(new JsonObject()
              .put("customerId",       r.getString("customer_id"))
              .put("overallRiskScore", r.getInteger("overall_risk_score"))
              .put("totalRiskScore",   r.getInteger("total_risk_score"))
              .put("kycTier",          r.getInteger("kyc_tier"))
              .put("overallStatus",    r.getString("overall_status"))
              .put("actionTaken",      r.getString("action_taken"))
              .put("runAt",            r.getOffsetDateTime("run_at").toString())
              .put("bvnNinStatus",     r.getString("bvn_nin_status"))
              .put("bvnNinScore",      r.getInteger("bvn_nin_score"))
              .put("phoneStatus",      r.getString("phone_status"))
              .put("phoneScore",       r.getInteger("phone_score"))
              .put("livenessStatus",   r.getString("liveness_status"))
              .put("livenessScore",    r.getInteger("liveness_score"))
              .put("pepStatus",        r.getString("pep_status"))
              .put("pepScore",         r.getInteger("pep_score"))
              .put("identityPhoto",    r.getString("identity_photo_b64"))
              .put("firstName",        r.getString("first_name"))
              .put("lastName",         r.getString("last_name"))
              .put("phone",            r.getString("phone"))
              .put("dateOfBirth",      r.getString("date_of_birth"))));
          return list;
        });
  }

  public Future<JsonObject> getStats(long institutionId) {
    String sql =
        "SELECT"
        + " COUNT(*) AS total,"
        + " COUNT(*) FILTER (WHERE total_risk >= 75) AS high_risk,"
        + " COUNT(*) FILTER (WHERE total_risk < 35) AS low_risk,"
        + " COUNT(*) FILTER (WHERE overall_status = 'verified') AS verified,"
        + " COUNT(*) FILTER (WHERE overall_status = 'flagged') AS flagged"
        + " FROM ("
        + "   SELECT DISTINCT ON (kpr.customer_id) kpr.overall_status,"
        + "     COALESCE(c.overall_risk_score, kpr.overall_risk_score) AS total_risk"
        + "   FROM kyc_pipeline_results kpr"
        + "   LEFT JOIN customers c"
        + "     ON c.institution_id = kpr.institution_id AND c.external_id = kpr.customer_id"
        + "   WHERE kpr.institution_id = $1"
        + "   ORDER BY kpr.customer_id, kpr.run_at DESC"
        + " ) latest";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          Row r = rs.iterator().next();
          return new JsonObject()
              .put("total",    r.getLong("total"))
              .put("highRisk", r.getLong("high_risk"))
              .put("lowRisk",  r.getLong("low_risk"))
              .put("verified", r.getLong("verified"))
              .put("flagged",  r.getLong("flagged"));
        });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static PipelineStepResult findStep(PipelineVerificationResult r, String name) {
    return r.steps().stream().filter(s -> name.equals(s.step())).findFirst().orElse(null);
  }

  private static String status(PipelineStepResult s) { return s != null ? s.status() : null; }
  private static int    score(PipelineStepResult  s) { return s != null ? s.riskScore() : 50; }
  private static String detail(PipelineStepResult s) { return s != null ? s.detail() : null; }

  private static KycPipelineResult mapRow(Row r) {
    return new KycPipelineResult(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("customer_id"),
        r.getOffsetDateTime("run_at"),
        r.getInteger("overall_risk_score"),
        r.getInteger("kyc_tier"),
        r.getString("overall_status"),
        r.getString("action_taken"),
        r.getString("bvn_nin_status"),  safeInt(r, "bvn_nin_score"),  r.getString("bvn_nin_detail"),
        r.getString("phone_status"),    safeInt(r, "phone_score"),    r.getString("phone_detail"),
        r.getString("liveness_status"), safeInt(r, "liveness_score"), r.getString("liveness_detail"),
        r.getString("pep_status"),      safeInt(r, "pep_score"),      r.getString("pep_detail"),
        r.getLong("duration_ms") != null ? r.getLong("duration_ms") : 0L,
        r.getString("identity_photo_b64"),
        r.getString("first_name"),
        r.getString("last_name"),
        r.getString("phone"),
        r.getString("date_of_birth"),
        r.getLong("monthly_inflow"),
        r.getLong("monthly_outflow"));
  }

  private static int safeInt(Row r, String col) {
    Integer v = r.getInteger(col);
    return v != null ? v : 50;
  }
}
