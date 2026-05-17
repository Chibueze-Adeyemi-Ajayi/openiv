package com.openiv.backend.customers;

import io.vertx.core.json.JsonObject;
import java.time.OffsetDateTime;

public record CustomerTransactionRule(
    long id,
    long institutionId,
    long customerId,
    String ruleType,
    JsonObject params,
    String action,
    boolean isActive,
    String description,
    Long createdBy,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    String direction   // 'inward' | 'outward' | 'both'
) {}
