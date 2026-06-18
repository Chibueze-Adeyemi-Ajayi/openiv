package com.openiv.backend.workflows;

import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Tuple;

public final class WorkflowAuditRepository {

  private final Pool pool;

  public WorkflowAuditRepository(Pool pool) {
    this.pool = pool;
  }

  /** Fire-and-forget. Failures are swallowed — audit must never block the primary op. actorId may be null for API-key calls. */
  public void log(long institutionId, Long workflowId, String workflowName,
                  String action, Long actorId, JsonObject detail) {
    pool.preparedQuery(
            "INSERT INTO workflow_audit_log"
            + " (institution_id, workflow_id, workflow_name, action, actor_id, detail)"
            + " VALUES ($1, $2, $3, $4, $5, $6)")
        .execute(Tuple.of(institutionId, workflowId, workflowName, action, actorId,
            detail != null ? detail : new JsonObject()))
        .onFailure(err -> System.err.println("[workflow-audit] write failed: " + err.getMessage()));
  }
}
