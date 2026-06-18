package com.openiv.backend.monitoring;

import io.vertx.core.json.JsonObject;
import java.time.OffsetDateTime;

public record MonitoringRule(
    long           id,
    long           pipelineId,
    long           institutionId,
    String         name,
    String         field,
    String         op,
    String         value,
    String         policy,
    String         code,
    boolean        enabled,
    int            position,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    /** True when this rule has an AI-generated JS function for evaluation. */
    public boolean hasCode() { return code != null && !code.isBlank(); }

    public JsonObject toJson() {
        return new JsonObject()
            .put("id",         id)
            .put("pipelineId", pipelineId)
            .put("name",       name)
            .put("field",      field)
            .put("op",         op)
            .put("value",      value)
            .put("policy",     policy)
            .put("code",       code)
            .put("enabled",    enabled)
            .put("position",   position)
            .put("createdAt",  createdAt != null ? createdAt.toString() : null)
            .put("updatedAt",  updatedAt != null ? updatedAt.toString() : null);
    }
}
