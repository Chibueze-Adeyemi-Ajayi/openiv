package com.openiv.backend.nomos;

import io.vertx.core.json.JsonObject;
import java.time.OffsetDateTime;

public record InstitutionRule(
    long            id,
    long            institutionId,
    String          name,
    String          policyStatement,
    JsonObject      comprehension,
    String          functionSource,
    byte[]          functionWasm,
    JsonObject      actions,
    String          status,
    String          createdBy,
    String          approvedBy,
    // Developer-review stage
    String          devEditedSource,
    String          devReviewedBy,
    String          reviewNote,
    // IT-vetting stage
    String          itVettedBy,
    JsonObject      testResults,
    OffsetDateTime  createdAt,
    OffsetDateTime  updatedAt
) {
    public JsonObject toJson() {
        return new JsonObject()
            .put("id",               id)
            .put("name",             name)
            .put("policyStatement",  policyStatement)
            .put("comprehension",    comprehension)
            .put("functionSource",   functionSource)
            .put("devEditedSource",  devEditedSource)
            .put("devReviewedBy",    devReviewedBy)
            .put("reviewNote",       reviewNote)
            .put("itVettedBy",       itVettedBy)
            .put("testResults",      testResults)
            .put("actions",          actions)
            .put("status",           status)
            .put("createdBy",        createdBy)
            .put("approvedBy",       approvedBy)
            .put("createdAt",        createdAt != null ? createdAt.toString() : null)
            .put("updatedAt",        updatedAt != null ? updatedAt.toString() : null);
    }
}
