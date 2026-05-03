package com.openiv.backend.behavioral;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.time.OffsetDateTime;

public record BehavioralRuleRecord(
    long id,
    long institutionId,
    String ruleId,
    String name,
    String category,
    String severity,
    String description,
    String example,
    String matchedTypology,
    boolean isActive,
    int affected,
    String emergence,
    JsonObject params,
    JsonArray recommendedActions,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
