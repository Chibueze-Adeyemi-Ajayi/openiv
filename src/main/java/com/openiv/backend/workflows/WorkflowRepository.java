package com.openiv.backend.workflows;

import io.vertx.core.Future;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class WorkflowRepository {

  private final Pool pool;

  public WorkflowRepository(Pool pool) {
    this.pool = pool;
  }

  // ── Definitions ───────────────────────────────────────────────────────────

  private static final String DEF_COLS =
      "id, institution_id, name, version, status, blocks, schedule, schedule_enabled, reschedule_days,"
      + " created_by, approved_by, created_at, updated_at, case_risk_threshold";

  public Future<List<WorkflowDefinition>> list(long institutionId) {
    return pool.preparedQuery(
            "SELECT " + DEF_COLS + " FROM workflow_definitions"
            + " WHERE institution_id = $1 ORDER BY name, version DESC")
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          var out = new ArrayList<WorkflowDefinition>();
          rs.forEach(r -> out.add(mapDef(r)));
          return out;
        });
  }

  public Future<Optional<WorkflowDefinition>> findById(long id, long institutionId) {
    return pool.preparedQuery(
            "SELECT " + DEF_COLS + " FROM workflow_definitions"
            + " WHERE id = $1 AND institution_id = $2")
        .execute(Tuple.of(id, institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapDef(it.next())) : Optional.<WorkflowDefinition>empty();
        });
  }

  /** Active workflows with scheduling on — scanned by the executor tick. */
  public Future<List<WorkflowDefinition>> listActiveScheduled() {
    return pool.preparedQuery(
            "SELECT " + DEF_COLS + " FROM workflow_definitions"
            + " WHERE status = 'active' AND schedule_enabled = TRUE")
        .execute()
        .map(rs -> {
          var out = new ArrayList<WorkflowDefinition>();
          rs.forEach(r -> out.add(mapDef(r)));
          return out;
        });
  }

  public Future<WorkflowDefinition> create(
      long institutionId, String name, JsonArray blocks, JsonObject schedule,
      long createdBy, Integer rescheduleDays, int caseRiskThreshold) {
    return pool.preparedQuery(
            "INSERT INTO workflow_definitions"
            + " (institution_id, name, blocks, schedule, created_by, reschedule_days, case_risk_threshold)"
            + " VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING " + DEF_COLS)
        .execute(Tuple.of(institutionId, name, blocks, schedule, createdBy, rescheduleDays, caseRiskThreshold))
        .map(rs -> mapDef(rs.iterator().next()));
  }

  /**
   * Seed the institution's default workflow if it has none — created active so
   * every institution always has a working re-screening sequence out of the box.
   */
  public Future<Void> seedIfEmpty(long institutionId, long userId) {
    return pool.preparedQuery(
            "INSERT INTO workflow_definitions (institution_id, name, status, blocks, created_by)"
            + " SELECT $1, 'Default CDD Workflow', 'active', $2, $3"
            + " WHERE NOT EXISTS (SELECT 1 FROM workflow_definitions WHERE institution_id = $1)")
        .execute(Tuple.of(institutionId, WorkflowBlocks.defaultSequence(), userId))
        .mapEmpty();
  }

  /** Hard-delete a draft or pending-approval workflow. Retired rows stay (audit trail). */
  public Future<Boolean> delete(long id, long institutionId) {
    return pool.preparedQuery(
            "DELETE FROM workflow_definitions"
            + " WHERE id = $1 AND institution_id = $2 AND status IN ('draft', 'pending_approval')")
        .execute(Tuple.of(id, institutionId))
        .map(rs -> rs.rowCount() > 0);
  }

  /** Update a draft in place. Empty/null name keeps the existing value. */
  public Future<Optional<WorkflowDefinition>> updateDraft(
      long id, long institutionId, String name, JsonArray blocks, JsonObject schedule,
      boolean scheduleEnabled, Integer rescheduleDays, int caseRiskThreshold) {
    return pool.preparedQuery(
            "UPDATE workflow_definitions"
            + " SET name = COALESCE(NULLIF($6, ''), name),"
            + "     blocks = $3, schedule = $4, schedule_enabled = $5,"
            + "     reschedule_days = $7, case_risk_threshold = $8, updated_at = NOW()"
            + " WHERE id = $1 AND institution_id = $2 AND status = 'draft'"
            + " RETURNING " + DEF_COLS)
        .execute(Tuple.of(id, institutionId, blocks, schedule, scheduleEnabled,
            name != null ? name : "", rescheduleDays, caseRiskThreshold))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapDef(it.next())) : Optional.<WorkflowDefinition>empty();
        });
  }

  public Future<Boolean> updateStatus(long id, long institutionId, String fromStatus, String toStatus, Long approvedBy) {
    return pool.preparedQuery(
            "UPDATE workflow_definitions SET status = $4, approved_by = COALESCE($5, approved_by),"
            + " updated_at = NOW()"
            + " WHERE id = $1 AND institution_id = $2 AND status = $3")
        .execute(Tuple.of(id, institutionId, fromStatus, toStatus, approvedBy))
        .map(rs -> rs.rowCount() > 0);
  }

  /** Find the currently-active version of a workflow by name, excluding the given id. */
  public Future<Optional<WorkflowDefinition>> findActiveByName(long institutionId, String name, long exceptId) {
    return pool.preparedQuery(
            "SELECT " + DEF_COLS + " FROM workflow_definitions"
            + " WHERE institution_id = $1 AND name = $2 AND status = 'active' AND id <> $3 LIMIT 1")
        .execute(Tuple.of(institutionId, name, exceptId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapDef(it.next())) : Optional.<WorkflowDefinition>empty();
        });
  }

  /** Retire any currently-active version of the same workflow name (one active per name). */
  public Future<Void> retireActiveByName(long institutionId, String name, long exceptId) {
    return pool.preparedQuery(
            "UPDATE workflow_definitions SET status = 'retired', updated_at = NOW()"
            + " WHERE institution_id = $1 AND name = $2 AND status = 'active' AND id <> $3")
        .execute(Tuple.of(institutionId, name, exceptId))
        .mapEmpty();
  }

  /** New draft version cloned from an existing definition — carries case_risk_threshold forward. */
  public Future<WorkflowDefinition> createNextVersion(WorkflowDefinition base, long createdBy) {
    return pool.preparedQuery(
            "INSERT INTO workflow_definitions"
            + " (institution_id, name, version, blocks, schedule, reschedule_days, case_risk_threshold, created_by)"
            + " SELECT institution_id, name,"
            + "   (SELECT MAX(version) + 1 FROM workflow_definitions WHERE institution_id = $2 AND name = $3),"
            + "   blocks, schedule, reschedule_days, case_risk_threshold, $4"
            + " FROM workflow_definitions WHERE id = $1 RETURNING " + DEF_COLS)
        .execute(Tuple.of(base.id(), base.institutionId(), base.name(), createdBy))
        .map(rs -> mapDef(rs.iterator().next()));
  }

  // ── Runs ──────────────────────────────────────────────────────────────────

  public Future<Long> createRun(long workflowId, int version, long institutionId, String trigger) {
    return pool.preparedQuery(
            "INSERT INTO workflow_runs (workflow_definition_id, workflow_version, institution_id, trigger)"
            + " VALUES ($1, $2, $3, $4) RETURNING id")
        .execute(Tuple.of(workflowId, version, institutionId, trigger))
        .map(rs -> rs.iterator().next().getLong("id"));
  }

  /** True when a run for this workflow is still in progress — prevents overlapping ticks. */
  public Future<Boolean> hasRunningRun(long workflowId) {
    return pool.preparedQuery(
            "SELECT EXISTS(SELECT 1 FROM workflow_runs"
            + " WHERE workflow_definition_id = $1 AND status = 'running') AS running")
        .execute(Tuple.of(workflowId))
        .map(rs -> Boolean.TRUE.equals(rs.iterator().next().getBoolean("running")));
  }

  public Future<Void> finishRun(long runId, String status, int total, int clear, int match, int errors) {
    return pool.preparedQuery(
            "UPDATE workflow_runs SET status = $2, total_customers = $3, clear_count = $4,"
            + " match_count = $5, error_count = $6, finished_at = NOW() WHERE id = $1")
        .execute(Tuple.of(runId, status, total, clear, match, errors))
        .mapEmpty();
  }

  public Future<Void> addRunItem(long runId, String customerId, JsonArray stepResults, String outcome, String error) {
    return pool.preparedQuery(
            "INSERT INTO workflow_run_items (run_id, customer_id, step_results, outcome, error)"
            + " VALUES ($1, $2, $3, $4, $5)")
        .execute(Tuple.of(runId, customerId, stepResults, outcome, error))
        .mapEmpty();
  }

  public Future<JsonArray> listRuns(long institutionId, long workflowId, int limit) {
    return pool.preparedQuery(
            "SELECT id, workflow_definition_id, workflow_version, trigger, status,"
            + " total_customers, clear_count, match_count, error_count, started_at, finished_at"
            + " FROM workflow_runs WHERE institution_id = $1 AND workflow_definition_id = $2"
            + " ORDER BY started_at DESC LIMIT $3")
        .execute(Tuple.of(institutionId, workflowId, limit))
        .map(rs -> {
          var arr = new JsonArray();
          rs.forEach(r -> arr.add(new JsonObject()
              .put("id",             r.getLong("id"))
              .put("version",        r.getInteger("workflow_version"))
              .put("trigger",        r.getString("trigger"))
              .put("status",         r.getString("status"))
              .put("totalCustomers", r.getInteger("total_customers"))
              .put("clearCount",     r.getInteger("clear_count"))
              .put("matchCount",     r.getInteger("match_count"))
              .put("errorCount",     r.getInteger("error_count"))
              .put("startedAt",      r.getOffsetDateTime("started_at").toString())
              .put("finishedAt",     r.getOffsetDateTime("finished_at") != null
                  ? r.getOffsetDateTime("finished_at").toString() : null)));
          return arr;
        });
  }

  public Future<JsonArray> listRunItems(long institutionId, long runId, int limit, int offset) {
    return pool.preparedQuery(
            "SELECT i.id, i.customer_id, i.step_results, i.outcome, i.error, i.created_at"
            + " FROM workflow_run_items i"
            + " JOIN workflow_runs r ON r.id = i.run_id"
            + " WHERE r.institution_id = $1 AND i.run_id = $2"
            + " ORDER BY i.id LIMIT $3 OFFSET $4")
        .execute(Tuple.of(institutionId, runId, limit, offset))
        .map(rs -> {
          var arr = new JsonArray();
          rs.forEach(r -> arr.add(new JsonObject()
              .put("id",          r.getLong("id"))
              .put("customerId",  r.getString("customer_id"))
              .put("stepResults", r.getJsonArray("step_results"))
              .put("outcome",     r.getString("outcome"))
              .put("error",       r.getString("error"))
              .put("createdAt",   r.getOffsetDateTime("created_at").toString())));
          return arr;
        });
  }

  // ── Customers due for re-screening ────────────────────────────────────────

  /**
   * Slim customer projection used by workflow blocks.
   * DB-sourced customers (scheduled runs) have selfie/docFront/docBack = null;
   * import runs supply these from the request payload.
   */
  public record DueCustomer(
      String externalId, String name, String phone, String bvn, String nin,
      String dob, int riskScore,
      String selfie, String docFront, String docBack) {}

  /**
   * Customers whose last evaluation is older than their tier's interval.
   * Tiers follow the platform convention: high ≥ 70, medium 40–69, low < 40.
   */
  public Future<List<DueCustomer>> listDueCustomers(
      long institutionId, int highDays, int mediumDays, int lowDays, int limit) {
    return pool.preparedQuery(
            "SELECT external_id, name, phone, bvn, nin, dob, risk_score FROM customers"
            + " WHERE institution_id = $1"
            + " AND rescreening_status = 'ok'"
            + " AND ("
            + "   (risk_score >= 70 AND (last_evaluated_at IS NULL OR last_evaluated_at < NOW() - make_interval(days => $2)))"
            + "   OR (risk_score >= 40 AND risk_score < 70 AND (last_evaluated_at IS NULL OR last_evaluated_at < NOW() - make_interval(days => $3)))"
            + "   OR (risk_score < 40 AND (last_evaluated_at IS NULL OR last_evaluated_at < NOW() - make_interval(days => $4)))"
            + " ) ORDER BY last_evaluated_at NULLS FIRST LIMIT $5")
        .execute(Tuple.of(institutionId, highDays, mediumDays, lowDays, limit))
        .map(rs -> {
          var out = new ArrayList<DueCustomer>();
          rs.forEach(r -> out.add(mapDueCustomer(r)));
          return out;
        });
  }

  private static DueCustomer mapDueCustomer(Row r) {
    return new DueCustomer(
        r.getString("external_id"),
        r.getString("name"),
        r.getString("phone"),
        r.getString("bvn"),
        r.getString("nin"),
        r.getLocalDate("dob") != null ? r.getLocalDate("dob").toString() : null,
        r.getInteger("risk_score") != null ? r.getInteger("risk_score") : 0,
        null, null, null); // selfie/docFront/docBack only available on import runs
  }

  /** All customers for an institution — used for manual "re-evaluate all" runs. */
  public Future<List<DueCustomer>> listAllForRescreen(long institutionId, int limit) {
    return pool.preparedQuery(
            "SELECT external_id, name, phone, bvn, nin, dob, risk_score FROM customers"
            + " WHERE institution_id = $1"
            + " AND rescreening_status = 'ok'"
            + " ORDER BY last_evaluated_at NULLS FIRST LIMIT $2")
        .execute(Tuple.of(institutionId, limit))
        .map(rs -> {
          var out = new ArrayList<DueCustomer>();
          rs.forEach(r -> out.add(mapDueCustomer(r)));
          return out;
        });
  }

  /** Customer counts per tier — drives the cost estimate in the builder. */
  public Future<JsonObject> tierCounts(long institutionId) {
    return pool.preparedQuery(
            "SELECT COUNT(*) FILTER (WHERE risk_score >= 70) AS high,"
            + " COUNT(*) FILTER (WHERE risk_score >= 40 AND risk_score < 70) AS medium,"
            + " COUNT(*) FILTER (WHERE risk_score < 40) AS low"
            + " FROM customers WHERE institution_id = $1")
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          Row r = rs.iterator().next();
          return new JsonObject()
              .put("high",   r.getLong("high"))
              .put("medium", r.getLong("medium"))
              .put("low",    r.getLong("low"));
        });
  }

  // ── Mapping ───────────────────────────────────────────────────────────────

  private static WorkflowDefinition mapDef(Row r) {
    return new WorkflowDefinition(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("name"),
        r.getInteger("version"),
        r.getString("status"),
        r.getJsonArray("blocks"),
        r.getJsonObject("schedule"),
        Boolean.TRUE.equals(r.getBoolean("schedule_enabled")),
        r.getInteger("reschedule_days"),
        r.getLong("created_by"),
        r.getLong("approved_by"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"),
        r.getInteger("case_risk_threshold") != null ? r.getInteger("case_risk_threshold") : 75);
  }
}
