package com.openiv.backend.customers;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class CustomerRepository {

  private static final String SELECT_COLS =
      "id, institution_id, external_id, name, email, phone, risk_score,"
      + " bvn, nin, photo, account_number, subject_type, dob, address, created_at, updated_at,"
      + " watchlisted, watchlisted_at, watchlisted_reason, last_evaluated_at,"
      + " cdd_risk_score, cdd_concerns::text AS cdd_concerns, cdd_step_scores::text AS cdd_step_scores,"
      + " selfie_photo, identity_photo_b64";

  private static final String READ_COLS =
      "c.id, c.institution_id, c.external_id, c.name, c.email, c.phone, c.risk_score,"
      + " c.bvn, c.nin, c.photo, c.account_number, c.subject_type, c.dob, c.address,"
      + " c.created_at, c.updated_at, c.watchlisted, c.watchlisted_at, c.watchlisted_reason,"
      + " c.last_evaluated_at,"
      + " c.cdd_risk_score, c.cdd_concerns::text AS cdd_concerns, c.cdd_step_scores::text AS cdd_step_scores,"
      + " c.selfie_photo, c.identity_photo_b64";

  private final Pool pool;

  public CustomerRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Customer> upsert(long institutionId, String externalId, String name) {
    String sql =
        "INSERT INTO customers (institution_id, external_id, name, updated_at)"
        + " VALUES ($1, $2, $3, now())"
        + " ON CONFLICT (institution_id, external_id) DO UPDATE"
        + " SET name = COALESCE(EXCLUDED.name, customers.name), updated_at = now()"
        + " RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId, name))
        .map(rs -> mapRow(rs.iterator().next()));
  }

  /**
   * Full upsert from a workflow import payload — creates or enriches the customer row
   * with every field the caller provides, without overwriting existing non-null values.
   */
  public Future<Void> upsertFromWorkflow(long institutionId, String externalId,
      String name, String phone, String bvn, String nin, String dob) {
    java.time.LocalDate dobDate = null;
    if (dob != null && !dob.isBlank()) {
      try { dobDate = java.time.LocalDate.parse(dob.trim()); } catch (Exception ignored) {}
    }
    String sql =
        "INSERT INTO customers (institution_id, external_id, name, phone, bvn, nin, dob, updated_at)"
        + " VALUES ($1, $2, $3, $4, $5, $6, $7, now())"
        + " ON CONFLICT (institution_id, external_id) DO UPDATE"
        + " SET name  = COALESCE(EXCLUDED.name,  customers.name),"
        + "     phone = COALESCE(EXCLUDED.phone, customers.phone),"
        + "     bvn   = COALESCE(EXCLUDED.bvn,   customers.bvn),"
        + "     nin   = COALESCE(EXCLUDED.nin,   customers.nin),"
        + "     dob   = COALESCE(EXCLUDED.dob,   customers.dob),"
        + "     updated_at = now()";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId, name, phone, bvn, nin, dobDate))
        .mapEmpty();
  }

  /**
   * Returns a map of externalId → stored {bvn, nin} for any of the given IDs that already exist
   * for this institution. Used to detect credential conflicts before running an import.
   */
  public Future<Map<String, String[]>> findCredentialConflicts(long institutionId, List<String> externalIds) {
    if (externalIds.isEmpty()) return Future.succeededFuture(Map.of());
    String sql = "SELECT external_id, bvn, nin FROM customers WHERE institution_id=$1 AND external_id = ANY($2)";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, (Object) externalIds.toArray(new String[0])))
        .map(rs -> {
          Map<String, String[]> out = new HashMap<>();
          rs.forEach(r -> out.put(r.getString("external_id"),
              new String[]{ r.getString("bvn"), r.getString("nin") }));
          return out;
        });
  }

  public Future<Optional<Customer>> findByExternalId(long institutionId, String externalId) {
    String sql = "SELECT " + READ_COLS + " FROM customers c"
        + " WHERE c.institution_id = $1 AND c.external_id = $2";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapRow(it.next())) : Optional.empty();
        });
  }

  public Future<List<Customer>> list(long institutionId, String q, int pageSize, int offset) {
    String sql = "SELECT " + READ_COLS + " FROM customers c"
        + " WHERE c.institution_id = $1"
        + "   AND ($2::text IS NULL OR c.name ILIKE '%' || $2 || '%'"
        + "                        OR c.external_id ILIKE '%' || $2 || '%'"
        + "                        OR c.email ILIKE '%' || $2 || '%')"
        + " ORDER BY c.risk_score DESC, c.name ASC"
        + " LIMIT $3 OFFSET $4";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, q, pageSize, offset))
        .map(rs -> {
          List<Customer> list = new ArrayList<>();
          rs.forEach(r -> list.add(mapRow(r)));
          return list;
        });
  }

  /** Full-schema search for Eureka AI — matches across all text columns. */
  public Future<List<Customer>> aiSearch(long institutionId, String q, int limit) {
    String sql = "SELECT " + READ_COLS + " FROM customers c"
        + " WHERE c.institution_id = $1"
        + "   AND ($2::text IS NULL OR"
        + "        c.name            ILIKE '%' || $2 || '%'"
        + "     OR c.external_id     ILIKE '%' || $2 || '%'"
        + "     OR c.email           ILIKE '%' || $2 || '%'"
        + "     OR c.phone           ILIKE '%' || $2 || '%'"
        + "     OR c.bvn             ILIKE '%' || $2 || '%'"
        + "     OR c.nin             ILIKE '%' || $2 || '%'"
        + "     OR c.account_number  ILIKE '%' || $2 || '%'"
        + "     OR c.address         ILIKE '%' || $2 || '%'"
        + "     OR c.watchlisted_reason ILIKE '%' || $2 || '%'"
        + "     OR c.subject_type    ILIKE '%' || $2 || '%')"
        + " ORDER BY c.risk_score DESC, c.name ASC"
        + " LIMIT $3";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, q, limit))
        .map(rs -> {
          List<Customer> list = new ArrayList<>();
          rs.forEach(r -> list.add(mapRow(r)));
          return list;
        });
  }

  public Future<Void> updateRiskScore(long institutionId, String externalId, int riskScore) {
    return pool.preparedQuery(
            "UPDATE customers SET risk_score = $1, updated_at = now()"
            + " WHERE institution_id = $2 AND external_id = $3")
        .execute(Tuple.of(riskScore, institutionId, externalId))
        .mapEmpty();
  }

  public Future<Customer> updateProfile(long institutionId, String externalId,
      String bvn, String nin, String photo, String accountNumber, String subjectType,
      java.time.LocalDate dob, String address, Long photoDocumentId) {
    String sql = "UPDATE customers SET"
        + " bvn              = COALESCE($3,  bvn),"
        + " nin              = COALESCE($4,  nin),"
        + " photo            = COALESCE($5,  photo),"
        + " account_number   = COALESCE($6,  account_number),"
        + " subject_type     = COALESCE($7,  subject_type),"
        + " dob              = COALESCE($8,  dob),"
        + " address          = COALESCE($9,  address),"
        + " photo_document_id = COALESCE($10, photo_document_id),"
        + " updated_at       = now()"
        + " WHERE institution_id = $1 AND external_id = $2"
        + " RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId, bvn, nin, photo,
            accountNumber, subjectType, dob, address, photoDocumentId))
        .map(rs -> mapRow(rs.iterator().next()));
  }

  private static Customer mapRow(Row r) {
    return new Customer(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("external_id"),
        r.getString("name"),
        r.getString("email"),
        r.getString("phone"),
        r.getInteger("risk_score"),
        r.getString("bvn"),
        r.getString("nin"),
        r.getString("photo"),
        r.getString("account_number"),
        r.getString("subject_type"),
        r.getLocalDate("dob"),
        r.getString("address"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"),
        Boolean.TRUE.equals(r.getBoolean("watchlisted")),
        r.getOffsetDateTime("watchlisted_at"),
        r.getString("watchlisted_reason"),
        r.getOffsetDateTime("last_evaluated_at"),
        r.getInteger("cdd_risk_score"),
        r.getValue("cdd_concerns") != null ? r.getValue("cdd_concerns").toString() : null,
        r.getValue("cdd_step_scores") != null ? r.getValue("cdd_step_scores").toString() : null,
        r.getString("selfie_photo"),
        r.getString("identity_photo_b64")
    );
  }

  public Future<Void> updateLastEvaluated(long institutionId, String externalId, Long workflowDefinitionId) {
    return pool.preparedQuery(
            "UPDATE customers"
            + " SET last_evaluated_at = now(), updated_at = now(),"
            + "     workflow_definition_id = COALESCE($3, workflow_definition_id)"
            + " WHERE institution_id = $1 AND external_id = $2")
        .execute(Tuple.of(institutionId, externalId, workflowDefinitionId))
        .mapEmpty();
  }

  /** Flag customers bound to a retired workflow as needing data enrichment before re-screening. */
  public Future<Void> flagEnrichmentNeeded(long institutionId, long workflowDefinitionId) {
    return pool.preparedQuery(
            "UPDATE customers"
            + " SET rescreening_status = 'needs_enrichment',"
            + "     workflow_definition_id = NULL, updated_at = now()"
            + " WHERE institution_id = $1 AND workflow_definition_id = $2")
        .execute(Tuple.of(institutionId, workflowDefinitionId))
        .mapEmpty();
  }

  /** Move customers from a retired workflow version to its replacement. */
  public Future<Void> rebindWorkflowCustomers(long institutionId, long fromWorkflowId, long toWorkflowId) {
    return pool.preparedQuery(
            "UPDATE customers"
            + " SET workflow_definition_id = $3, updated_at = now()"
            + " WHERE institution_id = $1 AND workflow_definition_id = $2")
        .execute(Tuple.of(institutionId, fromWorkflowId, toWorkflowId))
        .mapEmpty();
  }

  /** Count customers flagged as needing enrichment for this institution. */
  public Future<Long> countNeedsEnrichment(long institutionId) {
    return pool.preparedQuery(
            "SELECT COUNT(*) AS cnt FROM customers"
            + " WHERE institution_id = $1 AND rescreening_status = 'needs_enrichment'")
        .execute(Tuple.of(institutionId))
        .map(rs -> rs.iterator().next().getLong("cnt"));
  }

  public Future<Customer> watchlist(long institutionId, String externalId, String reason) {
    String sql = "UPDATE customers SET watchlisted = TRUE, watchlisted_at = now(), watchlisted_reason = $3,"
        + " updated_at = now() WHERE institution_id = $1 AND external_id = $2"
        + " RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId, reason))
        .map(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) throw new RuntimeException("Customer not found");
          return mapRow(it.next());
        });
  }

  public Future<Customer> unwatchlist(long institutionId, String externalId) {
    String sql = "UPDATE customers SET watchlisted = FALSE, watchlisted_at = NULL, watchlisted_reason = NULL,"
        + " updated_at = now() WHERE institution_id = $1 AND external_id = $2"
        + " RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId))
        .map(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) throw new RuntimeException("Customer not found");
          return mapRow(it.next());
        });
  }

  public Future<Void> updateOverallRiskScore(long institutionId, String externalId, int score) {
    return pool.preparedQuery(
            "UPDATE customers SET overall_risk_score = $3, updated_at = now()"
            + " WHERE institution_id = $1 AND external_id = $2")
        .execute(Tuple.of(institutionId, externalId, score))
        .mapEmpty();
  }

  public Future<Void> refreshScore(long institutionId, String externalId) {
    // Single risk score: overall_risk_score mirrors risk_score (set by CDD evaluation).
    // No external API calls, no blending.
    return pool.preparedQuery(
            "UPDATE customers SET overall_risk_score = risk_score, updated_at = now()"
            + " WHERE institution_id = $1 AND external_id = $2")
        .execute(Tuple.of(institutionId, externalId))
        .mapEmpty();
  }

  public Future<Void> refreshAllScores(long institutionId) {
    // Single risk score: sync overall_risk_score from risk_score for the whole institution.
    // No CDD workflow invocations, no external calls.
    return pool.preparedQuery(
            "UPDATE customers SET overall_risk_score = risk_score, updated_at = now()"
            + " WHERE institution_id = $1")
        .execute(Tuple.of(institutionId))
        .mapEmpty();
  }

  public Future<List<Customer>> listHighRisk(long institutionId, int limit, int offset) {
    String sql = "SELECT " + READ_COLS + " FROM customers c"
        + " WHERE c.institution_id = $1 AND c.overall_risk_score > 75"
        + " ORDER BY c.overall_risk_score DESC"
        + " LIMIT $2 OFFSET $3";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, limit, offset))
        .map(rs -> {
          List<Customer> list = new ArrayList<>();
          rs.forEach(r -> list.add(mapRow(r)));
          return list;
        });
  }

  public Future<Long> countHighRisk(long institutionId) {
    return pool.preparedQuery(
            "SELECT COUNT(*) FROM customers WHERE institution_id = $1 AND overall_risk_score > 75")
        .execute(Tuple.of(institutionId))
        .map(rs -> rs.iterator().next().getLong(0));
  }

  /** Recomputes overall_risk_score for a single customer from live transaction + case data. */
  public Future<Void> refreshCustomerScore(long institutionId, String externalId) {
    String sql = "UPDATE customers SET"
        + " overall_risk_score = LEAST(100, ROUND("
        + "   risk_score * 0.20"
        + "   + COALESCE(("
        + "       SELECT ROUND(AVG(cs.risk_score))::INT FROM cases cs"
        + "       WHERE cs.customer_id = customers.external_id"
        + "         AND cs.institution_id = customers.institution_id"
        + "         AND NOT (cs.status = 'closed' AND cs.resolution = 'cleared')"
        + "     ), 0) * 0.55"
        + "   + COALESCE(("
        + "       SELECT LEAST(100, ROUND("
        + "         (COUNT(*) FILTER (WHERE t2.flagged_status IS NOT NULL)::float"
        + "          / GREATEST(COUNT(*), 1)) * 100.0"
        + "         * (COALESCE(AVG(t2.risk_score) FILTER (WHERE t2.flagged_status IS NOT NULL), 50.0) / 50.0)"
        + "       ))::INT"
        + "       FROM transactions t2"
        + "       WHERE t2.customer_id = customers.external_id"
        + "         AND t2.institution_id = customers.institution_id"
        + "     ), 0) * 0.25"
        + " ))::INT,"
        + " updated_at = now()"
        + " WHERE institution_id = $1 AND external_id = $2";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId))
        .mapEmpty();
  }

  /** Returns the stored overall_risk_score for a customer (0 if not found). */
  public Future<Integer> getOverallRiskScore(long institutionId, String externalId) {
    return pool.preparedQuery(
            "SELECT overall_risk_score FROM customers WHERE institution_id = $1 AND external_id = $2")
        .execute(Tuple.of(institutionId, externalId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? it.next().getInteger("overall_risk_score") : 0;
        });
  }

  public Future<List<Long>> distinctInstitutionIds() {
    return pool.preparedQuery("SELECT DISTINCT institution_id FROM customers")
        .execute(Tuple.tuple())
        .map(rs -> {
          List<Long> ids = new ArrayList<>();
          rs.forEach(r -> ids.add(r.getLong(0)));
          return ids;
        });
  }

  /**
   * Persist CDD workflow evaluation results.
   * DP logic: selfie takes priority, then idPhoto from BVN/NIN, then keep existing.
   * selfie_photo is stored whenever a selfie is present (for manual resolution side-by-side).
   */
  public Future<Void> updateCddEvaluation(long institutionId, String externalId,
      int cddRiskScore, io.vertx.core.json.JsonArray concerns,
      io.vertx.core.json.JsonArray stepScores, String selfie, String idPhoto) {
    return pool.preparedQuery(
            "UPDATE customers"
            + " SET cdd_risk_score  = $3,"
            + "     risk_score      = $3,"
            + "     cdd_concerns    = $4::text::jsonb,"
            + "     cdd_step_scores = $5::text::jsonb,"
            + "     photo               = COALESCE($6, $7, photo),"
            + "     selfie_photo        = COALESCE($6, selfie_photo),"
            + "     identity_photo_b64  = COALESCE($7, identity_photo_b64),"
            + "     last_evaluated_at = now(),"
            + "     updated_at      = now()"
            + " WHERE institution_id = $1 AND external_id = $2")
        .execute(io.vertx.sqlclient.Tuple.of(institutionId, externalId, cddRiskScore,
            concerns.encode(), stepScores.encode(), selfie, idPhoto))
        .mapEmpty();
  }

  private static final java.util.Map<String, Integer> STEP_WEIGHTS = java.util.Map.of(
      "identity_verify",      35,
      "liveness_match",       25,
      "pep_sanctions_screen", 20,
      "case_history",         20,
      "document_verify",      15,
      "phone_basic",          12,
      "phone_fraud",           8,
      "flagged_transactions",  5
  );

  private static int computeResolvedRisk(io.vertx.core.json.JsonArray steps) {
    long weightedSum = 0, totalWeight = 0;
    for (int i = 0; i < steps.size(); i++) {
      io.vertx.core.json.JsonObject s = steps.getJsonObject(i);
      if (s == null || !s.containsKey("score")) continue;
      Integer sc = s.getInteger("score");
      if (sc == null || sc < 0) continue;
      String type = s.getString("type", "");
      int w = s.containsKey("weight") ? s.getInteger("weight", 10) : STEP_WEIGHTS.getOrDefault(type, 10);
      weightedSum += (long) sc * w;
      totalWeight += w;
    }
    if (totalWeight == 0) return 50;
    int authenticity = (int) (weightedSum / totalWeight);
    return Math.max(0, Math.min(100, 100 - authenticity));
  }

  /**
   * Manually override a single CDD step result, then recompute and persist the risk score.
   * Does not call any external API — pure local resolution by a compliance officer.
   */
  public Future<Customer> resolveStep(long institutionId, String externalId,
      String stepType, boolean markPass, int score, String note) {
    return pool.preparedQuery(
            "SELECT cdd_step_scores FROM customers WHERE institution_id=$1 AND external_id=$2")
        .execute(Tuple.of(institutionId, externalId))
        .compose(rs -> {
          if (!rs.iterator().hasNext())
            return Future.failedFuture("Customer not found: " + externalId);
          Object rawVal = rs.iterator().next().getValue("cdd_step_scores");
          if (rawVal == null)
            return Future.failedFuture("No CDD screening results on record for this customer");
          String raw = rawVal.toString();

          io.vertx.core.json.JsonArray steps = new io.vertx.core.json.JsonArray(raw);
          boolean found = false;
          for (int i = 0; i < steps.size(); i++) {
            io.vertx.core.json.JsonObject s = steps.getJsonObject(i);
            if (s == null || !stepType.equals(s.getString("type"))) continue;
            String origDetail = s.getString("detail", "");
            s.put("status",         markPass ? "pass" : "match");
            s.put("score",          score);
            s.put("detail",         note + "  [was: " + origDetail + "]");
            s.put("manualOverride", true);
            found = true;
            break;
          }
          if (!found)
            return Future.failedFuture("Step '" + stepType + "' not found in screening results");

          int newRisk = computeResolvedRisk(steps);
          return pool.preparedQuery(
                  "UPDATE customers"
                  + " SET cdd_step_scores = $3::text::jsonb,"
                  + "     cdd_risk_score  = $4,"
                  + "     risk_score      = $4,"
                  + "     updated_at      = now()"
                  + " WHERE institution_id = $1 AND external_id = $2"
                  + " RETURNING " + SELECT_COLS)
              .execute(Tuple.of(institutionId, externalId, steps.encode(), newRisk))
              .map(rs2 -> mapRow(rs2.iterator().next()));
        });
  }

  /**
   * Find customers sharing a specific attribute value — BVN, NIN, phone, or address.
   * Used for mule network detection and identity clustering.
   * Only 'bvn', 'nin', 'phone', 'address' are accepted field names (allowlist).
   */
  public Future<List<Customer>> findByAttribute(long institutionId, String field, String value, int limit) {
    String col = switch (field) {
      case "bvn"     -> "bvn";
      case "nin"     -> "nin";
      case "phone"   -> "phone";
      case "address" -> "address";
      default        -> null;
    };
    if (col == null) return Future.succeededFuture(List.of());
    String sql = "SELECT " + READ_COLS + " FROM customers c"
        + " WHERE c.institution_id = $1 AND c." + col + " IS NOT NULL AND c." + col + " = $2"
        + " ORDER BY c.risk_score DESC NULLS LAST LIMIT $3";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, value, limit))
        .map(rs -> {
          var list = new ArrayList<Customer>();
          rs.forEach(r -> list.add(mapRow(r)));
          return List.copyOf(list);
        });
  }

  /** Returns a customer as a DueCustomer (for manual/rescreen runs). */
  public Future<java.util.Optional<com.openiv.backend.workflows.WorkflowRepository.DueCustomer>> findAsDueCustomer(
      long institutionId, String externalId) {
    return pool.preparedQuery(
            "SELECT external_id, name, phone, bvn, nin, dob, risk_score"
            + " FROM customers WHERE institution_id = $1 AND external_id = $2")
        .execute(io.vertx.sqlclient.Tuple.of(institutionId, externalId))
        .map(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) return java.util.Optional.empty();
          var r = it.next();
          return java.util.Optional.of(new com.openiv.backend.workflows.WorkflowRepository.DueCustomer(
              r.getString("external_id"),
              r.getString("name"),
              r.getString("phone"),
              r.getString("bvn"),
              r.getString("nin"),
              r.getLocalDate("dob") != null ? r.getLocalDate("dob").toString() : null,
              r.getInteger("risk_score") != null ? r.getInteger("risk_score") : 0,
              null, null, null));
        });
  }
}
