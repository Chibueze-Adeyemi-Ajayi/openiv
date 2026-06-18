package com.openiv.backend.kyc;

import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.openiv.backend.dojah.PipelineStepResult;
import com.openiv.backend.dojah.PipelineVerificationResult;

public final class KycPipelineResultRepository {

  private final Pool pool;

  public KycPipelineResultRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<KycPipelineResult> save(long institutionId, String customerId,
      PipelineVerificationResult result, String actionTaken,
      Long monthlyInflow, Long monthlyOutflow) {
    return save(institutionId, customerId, result, actionTaken, monthlyInflow, monthlyOutflow, null);
  }

  public Future<KycPipelineResult> save(long institutionId, String customerId,
      PipelineVerificationResult result, String actionTaken,
      Long monthlyInflow, Long monthlyOutflow, Integer institutionKycTier) {

    PipelineStepResult bvn = findStep(result, "bvn_nin");
    PipelineStepResult ph = aggregatePhoneSteps(result);
    PipelineStepResult liv = findStep(result, "liveness");
    PipelineStepResult pep = findStep(result, "pep_check");

    String knowledgeLevel = toKnowledgeLevel(result.kycTier());

    String sql = "INSERT INTO kyc_pipeline_results "
        + "(institution_id, customer_id, overall_risk_score, knowledge_level, institution_kyc_tier,"
        + " overall_status, action_taken,"
        + " bvn_nin_status, bvn_nin_score, bvn_nin_detail,"
        + " phone_status, phone_score, phone_detail,"
        + " liveness_status, liveness_score, liveness_detail,"
        + " pep_status, pep_score, pep_detail, duration_ms, identity_photo_b64,"
        + " first_name, last_name, phone, date_of_birth,"
        + " monthly_inflow, monthly_outflow) "
        + "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) "
        + "ON CONFLICT (institution_id, customer_id) DO UPDATE SET "
        + " run_at = NOW(),"
        + " overall_risk_score    = EXCLUDED.overall_risk_score,"
        + " knowledge_level       = EXCLUDED.knowledge_level,"
        + " institution_kyc_tier  = EXCLUDED.institution_kyc_tier,"
        + " overall_status        = EXCLUDED.overall_status,"
        + " action_taken          = EXCLUDED.action_taken,"
        + " bvn_nin_status        = EXCLUDED.bvn_nin_status,"
        + " bvn_nin_score         = EXCLUDED.bvn_nin_score,"
        + " bvn_nin_detail        = EXCLUDED.bvn_nin_detail,"
        + " phone_status          = EXCLUDED.phone_status,"
        + " phone_score           = EXCLUDED.phone_score,"
        + " phone_detail          = EXCLUDED.phone_detail,"
        + " liveness_status       = EXCLUDED.liveness_status,"
        + " liveness_score        = EXCLUDED.liveness_score,"
        + " liveness_detail       = EXCLUDED.liveness_detail,"
        + " pep_status            = EXCLUDED.pep_status,"
        + " pep_score             = EXCLUDED.pep_score,"
        + " pep_detail            = EXCLUDED.pep_detail,"
        + " duration_ms           = EXCLUDED.duration_ms,"
        + " identity_photo_b64    = COALESCE(EXCLUDED.identity_photo_b64, kyc_pipeline_results.identity_photo_b64),"
        + " first_name            = EXCLUDED.first_name,"
        + " last_name             = EXCLUDED.last_name,"
        + " phone                 = EXCLUDED.phone,"
        + " date_of_birth         = EXCLUDED.date_of_birth,"
        + " monthly_inflow        = EXCLUDED.monthly_inflow,"
        + " monthly_outflow       = EXCLUDED.monthly_outflow "
        + "RETURNING id, run_at";

    return pool.preparedQuery(sql)
        .execute(Tuple.of(
            institutionId, customerId,
            result.overallRiskScore(), knowledgeLevel, institutionKycTier,
            result.overallStatus(), actionTaken,
            status(bvn), score(bvn), detail(bvn),
            status(ph), score(ph), detail(ph),
            status(liv), score(liv), detail(liv),
            status(pep), score(pep), detail(pep),
            result.totalDurationMs(), result.identityPhoto(),
            result.firstName(), result.lastName(), result.phone(), result.dateOfBirth(),
            monthlyInflow, monthlyOutflow))
        .map(rs -> {
          Row r = rs.iterator().next();
          return new KycPipelineResult(
              r.getLong("id"), institutionId, customerId, r.getOffsetDateTime("run_at"),
              result.overallRiskScore(), knowledgeLevel, institutionKycTier,
              result.overallStatus(), actionTaken,
              status(bvn), score(bvn), detail(bvn),
              status(ph), score(ph), detail(ph),
              status(liv), score(liv), detail(liv),
              status(pep), score(pep), detail(pep),
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
   * (20% KYC + 55% case history + 25% transaction) joined from the customers
   * table.
   * The filter thresholds use total_risk rather than the KYC-only
   * overallRiskScore.
   */
  public Future<List<JsonObject>> listCustomerSummaries(
      long institutionId, String filter, String search) {

    // Customers table is the source of truth — includes workflow-imported customers
    // that never went through the KYC pipeline. KYC pipeline data is joined in
    // as supplementary detail (LATERAL gets latest row per customer).
    String base =
        "SELECT"
        + "  c.external_id         AS customer_id,"
        + "  c.name                AS customer_name,"
        + "  c.phone               AS customer_phone,"
        + "  c.dob                 AS customer_dob,"
        + "  c.photo               AS customer_photo,"
        + "  c.selfie_photo,"
        + "  c.last_evaluated_at,"
        + "  COALESCE(c.cdd_risk_score, c.risk_score, 0) AS risk_score,"
        + "  c.cdd_concerns,"
        + "  c.cdd_step_scores,"
        + "  kpr.overall_risk_score, kpr.knowledge_level, kpr.institution_kyc_tier,"
        + "  kpr.overall_status, kpr.action_taken, kpr.run_at,"
        + "  kpr.bvn_nin_status, kpr.bvn_nin_score,"
        + "  kpr.phone_status,   kpr.phone_score,"
        + "  kpr.liveness_status, kpr.liveness_score,"
        + "  kpr.pep_status,      kpr.pep_score,"
        + "  kpr.identity_photo_b64,"
        + "  kpr.first_name, kpr.last_name,"
        + "  kpr.phone AS kpr_phone,"
        + "  kpr.date_of_birth,"
        + "  EXISTS ("
        + "    SELECT 1 FROM cases ic"
        + "    WHERE ic.customer_id = c.external_id"
        + "    AND ic.institution_id = c.institution_id"
        + "    AND ic.status != 'closed'"
        + "  ) AS has_active_case"
        + " FROM customers c"
        + " LEFT JOIN LATERAL ("
        + "   SELECT * FROM kyc_pipeline_results kpr2"
        + "   WHERE kpr2.institution_id = c.institution_id AND kpr2.customer_id = c.external_id"
        + "   ORDER BY kpr2.run_at DESC LIMIT 1"
        + " ) kpr ON true"
        + " WHERE c.institution_id = $1";

    StringBuilder sql = new StringBuilder(base);
    if ("high-risk".equals(filter)) {
      sql.append(" AND COALESCE(c.cdd_risk_score, c.risk_score, 0) >= 75");
    } else if ("medium-risk".equals(filter)) {
      sql.append(" AND COALESCE(c.cdd_risk_score, c.risk_score, 0) >= 35"
               + " AND COALESCE(c.cdd_risk_score, c.risk_score, 0) < 75");
    } else if ("low-risk".equals(filter)) {
      sql.append(" AND COALESCE(c.cdd_risk_score, c.risk_score, 0) < 35");
    } else if ("verified".equals(filter)) {
      sql.append(" AND kpr.overall_status = 'verified'");
    } else if ("flagged".equals(filter)) {
      sql.append(" AND kpr.overall_status = 'flagged'");
    } else if ("active-cases".equals(filter)) {
      sql.append(" AND EXISTS (SELECT 1 FROM cases ic WHERE ic.customer_id = c.external_id AND ic.institution_id = c.institution_id AND ic.status != 'closed')");
    }

    Tuple params;
    if (search != null && !search.isBlank()) {
      sql.append(" AND (c.external_id ILIKE $2 OR c.name ILIKE $2"
          + " OR kpr.first_name ILIKE $2 OR kpr.last_name ILIKE $2)");
      params = Tuple.of(institutionId, "%" + search.trim() + "%");
    } else {
      params = Tuple.of(institutionId);
    }

    sql.append(" ORDER BY risk_score DESC, c.name ASC LIMIT 200");

    return pool.preparedQuery(sql.toString())
        .execute(params)
        .map(rs -> {
          List<JsonObject> list = new ArrayList<>();
          rs.forEach(r -> {
            int score = r.getInteger("risk_score") != null ? r.getInteger("risk_score") : 0;
            JsonObject obj = new JsonObject()
                .put("customerId",      r.getString("customer_id"))
                .put("name",            r.getString("customer_name"))
                .put("overallRiskScore", score)
                .put("totalRiskScore",  score)
                .put("knowledgeLevel",  r.getString("knowledge_level"))
                .put("institutionKycTier", r.getInteger("institution_kyc_tier"))
                .put("overallStatus",   r.getString("overall_status"))
                .put("actionTaken",     r.getString("action_taken"))
                .put("bvnNinStatus",    r.getString("bvn_nin_status"))
                .put("bvnNinScore",     r.getInteger("bvn_nin_score"))
                .put("phoneStatus",     r.getString("phone_status"))
                .put("phoneScore",      r.getInteger("phone_score"))
                .put("livenessStatus",  r.getString("liveness_status"))
                .put("livenessScore",   r.getInteger("liveness_score"))
                .put("pepStatus",       r.getString("pep_status"))
                .put("pepScore",        r.getInteger("pep_score"))
                .put("identityPhoto",   r.getString("identity_photo_b64") != null
                    ? r.getString("identity_photo_b64") : r.getString("customer_photo"))
                .put("selfiePhoto",     r.getString("selfie_photo"))
                .put("firstName",       r.getString("first_name"))
                .put("lastName",        r.getString("last_name"))
                .put("phone",           r.getString("kpr_phone") != null
                    ? r.getString("kpr_phone") : r.getString("customer_phone"))
                .put("dateOfBirth",     r.getString("date_of_birth"))
                .put("lastEvaluatedAt", r.getOffsetDateTime("last_evaluated_at") != null
                    ? r.getOffsetDateTime("last_evaluated_at").toString() : null);
            if (r.getOffsetDateTime("run_at") != null)
              obj.put("runAt", r.getOffsetDateTime("run_at").toString());
            if (r.getValue("cdd_concerns") != null)
              obj.put("cddConcerns", r.getValue("cdd_concerns"));
            if (r.getValue("cdd_step_scores") != null)
              obj.put("cddStepScores", r.getValue("cdd_step_scores").toString());
            if (Boolean.TRUE.equals(r.getBoolean("has_active_case")))
              obj.put("hasActiveCase", true);
            list.add(obj);
          });
          return list;
        });
  }

  public Future<JsonObject> getStats(long institutionId) {
    // Count from customers table so workflow-imported customers are included.
    // kpr is joined only for overall_status (verified/flagged).
    String sql =
        "SELECT"
        + " COUNT(*) AS total,"
        + " COUNT(*) FILTER (WHERE COALESCE(c.cdd_risk_score, c.risk_score, 0) >= 75) AS high_risk,"
        + " COUNT(*) FILTER (WHERE COALESCE(c.cdd_risk_score, c.risk_score, 0) >= 35"
        + "                    AND COALESCE(c.cdd_risk_score, c.risk_score, 0) < 75) AS medium_risk,"
        + " COUNT(*) FILTER (WHERE COALESCE(c.cdd_risk_score, c.risk_score, 0) < 35) AS low_risk,"
        + " COUNT(*) FILTER (WHERE kpr.overall_status = 'verified') AS verified,"
        + " COUNT(*) FILTER (WHERE kpr.overall_status = 'flagged') AS flagged,"
        + " COUNT(*) FILTER (WHERE EXISTS ("
        + "   SELECT 1 FROM cases ic"
        + "   WHERE ic.customer_id = c.external_id AND ic.institution_id = c.institution_id"
        + "   AND ic.status != 'closed'"
        + " )) AS active_cases"
        + " FROM customers c"
        + " LEFT JOIN LATERAL ("
        + "   SELECT overall_status FROM kyc_pipeline_results kpr2"
        + "   WHERE kpr2.institution_id = c.institution_id AND kpr2.customer_id = c.external_id"
        + "   ORDER BY kpr2.run_at DESC LIMIT 1"
        + " ) kpr ON true"
        + " WHERE c.institution_id = $1";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          Row r = rs.iterator().next();
          return new JsonObject()
              .put("total",      r.getLong("total"))
              .put("highRisk",   r.getLong("high_risk"))
              .put("mediumRisk", r.getLong("medium_risk"))
              .put("lowRisk",    r.getLong("low_risk"))
              .put("verified",   r.getLong("verified"))
              .put("flagged",    r.getLong("flagged"))
              .put("activeCases", r.getLong("active_cases"));
        });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static PipelineStepResult findStep(PipelineVerificationResult r, String name) {
    return r.steps().stream().filter(s -> name.equals(s.step())).findFirst().orElse(null);
  }

  /**
   * The pipeline emits up to 4 phone steps (record_basic, record_fraud,
   * beam_basic, beam_fraud) but the legacy {@code kyc_pipeline_results} table
   * carries a single {@code phone_*} triplet. Aggregate by worst-status:
   * any {@code fail} wins, then {@code error}, then {@code unverified},
   * else {@code pass}. Detail concatenates the offending step messages.
   * Skipped same-phone steps are ignored.
   */
  private static PipelineStepResult aggregatePhoneSteps(PipelineVerificationResult r) {
    var phoneSteps = r.steps().stream()
        .filter(s -> s.step() != null && s.step().startsWith("phone_") && !s.skipped())
        .toList();
    if (phoneSteps.isEmpty())
      return null;

    // Status priority: fail > error > unverified > pass
    String aggregateStatus = "pass";
    for (var s : phoneSteps) {
      if ("fail".equals(s.status())) {
        aggregateStatus = "fail";
        break;
      }
      if ("error".equals(s.status()) && !"fail".equals(aggregateStatus))
        aggregateStatus = "error";
      else if ("unverified".equals(s.status()) && "pass".equals(aggregateStatus))
        aggregateStatus = "unverified";
    }

    int maxScore = phoneSteps.stream().mapToInt(PipelineStepResult::riskScore).max().orElse(50);
    long totalMs = phoneSteps.stream().mapToLong(PipelineStepResult::durationMs).sum();
    boolean anyDojahCalled = phoneSteps.stream().anyMatch(PipelineStepResult::dojahCalled);

    StringBuilder detail = new StringBuilder();
    for (var s : phoneSteps) {
      if (detail.length() > 0)
        detail.append(" · ");
      detail.append(s.step()).append(": ").append(s.detail());
    }

    return new PipelineStepResult("phone_match", aggregateStatus, detail.toString(),
        totalMs, maxScore, anyDojahCalled);
  }

  private static String status(PipelineStepResult s) {
    return s != null ? s.status() : null;
  }

  private static int score(PipelineStepResult s) {
    return s != null ? s.riskScore() : 50;
  }

  private static String detail(PipelineStepResult s) {
    return s != null ? s.detail() : null;
  }

  private static KycPipelineResult mapRow(Row r) {
    return new KycPipelineResult(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("customer_id"),
        r.getOffsetDateTime("run_at"),
        r.getInteger("overall_risk_score"),
        r.getString("knowledge_level"),
        r.getInteger("institution_kyc_tier"),
        r.getString("overall_status"),
        r.getString("action_taken"),
        r.getString("bvn_nin_status"), safeInt(r, "bvn_nin_score"), r.getString("bvn_nin_detail"),
        r.getString("phone_status"), safeInt(r, "phone_score"), r.getString("phone_detail"),
        r.getString("liveness_status"), safeInt(r, "liveness_score"), r.getString("liveness_detail"),
        r.getString("pep_status"), safeInt(r, "pep_score"), r.getString("pep_detail"),
        r.getLong("duration_ms") != null ? r.getLong("duration_ms") : 0L,
        r.getString("identity_photo_b64"),
        r.getString("first_name"),
        r.getString("last_name"),
        r.getString("phone"),
        r.getString("date_of_birth"),
        r.getLong("monthly_inflow"),
        r.getLong("monthly_outflow"));
  }

  /** Convert pipeline integer tier (1/2/3) to knowledge_level string. */
  public static String toKnowledgeLevel(int tier) {
    return switch (tier) {
      case 2 -> "t2";
      case 3 -> "t3";
      default -> "t1";
    };
  }

  /** Convert knowledge_level string back to integer for limit lookups. */
  public static int fromKnowledgeLevel(String level) {
    if (level == null)
      return 1;
    return switch (level) {
      case "t2" -> 2;
      case "t3" -> 3;
      default -> 1;
    };
  }

  private static int safeInt(Row r, String col) {
    Integer v = r.getInteger(col);
    return v != null ? v : 50;
  }
}
