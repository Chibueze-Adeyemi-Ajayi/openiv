package com.openiv.backend.workflows;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.time.OffsetDateTime;

/**
 * An institution-defined KYC re-screening workflow.
 *
 * blocks: ordered JSON array — [{"type":"pep_sanctions_screen","config":{},"onFail":"open_case"}, ...]
 * schedule: per-tier cadence in days — {"highDays":30,"mediumDays":90,"lowDays":365}
 *
 * Lifecycle: draft → pending_approval → active → retired.
 * Maker-checker: approvedBy must differ from createdBy (enforced in WorkflowService).
 */
public record WorkflowDefinition(
    long id,
    long institutionId,
    String name,
    int version,
    String status,
    JsonArray blocks,
    JsonObject schedule,
    boolean scheduleEnabled,
    Integer rescheduleDays,
    long createdBy,
    Long approvedBy,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    int caseRiskThreshold   // risk score ≥ this opens an investigation case (default 75)
) {
  public static final String STATUS_DRAFT    = "draft";
  public static final String STATUS_PENDING  = "pending_approval";
  public static final String STATUS_ACTIVE   = "active";
  public static final String STATUS_RETIRED  = "retired";

  public JsonObject toJson() {
    return new JsonObject()
        .put("id",              id)
        .put("name",            name)
        .put("version",         version)
        .put("status",          status)
        .put("blocks",          blocks)
        .put("schedule",        schedule)
        .put("scheduleEnabled",    scheduleEnabled)
        .put("rescheduleDays",     rescheduleDays)
        .put("caseRiskThreshold",  caseRiskThreshold)
        .put("createdBy",          createdBy)
        .put("approvedBy",      approvedBy)
        .put("createdAt",       createdAt != null ? createdAt.toString() : null)
        .put("updatedAt",       updatedAt != null ? updatedAt.toString() : null);
  }
}
