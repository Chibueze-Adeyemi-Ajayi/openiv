package com.openiv.backend.monitoring;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import java.time.OffsetDateTime;
import java.util.List;

public record MonitoringPipeline(
    long                 id,
    long                 institutionId,
    String               name,
    String               description,
    String               logic,
    String               status,
    String               createdBy,
    List<MonitoringRule> rules,
    OffsetDateTime       createdAt,
    OffsetDateTime       updatedAt
) {
    public JsonObject toJson() {
        var arr = new JsonArray();
        if (rules != null) rules.forEach(r -> arr.add(r.toJson()));
        return new JsonObject()
            .put("id",          id)
            .put("name",        name)
            .put("description", description)
            .put("logic",       logic)
            .put("status",      status)
            .put("createdBy",   createdBy)
            .put("rules",       arr)
            .put("createdAt",   createdAt != null ? createdAt.toString() : null)
            .put("updatedAt",   updatedAt != null ? updatedAt.toString() : null);
    }
}
