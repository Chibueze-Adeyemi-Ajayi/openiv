package com.openiv.backend.alerts;

import io.vertx.core.json.JsonObject;
import java.time.OffsetDateTime;

public record InstitutionAlert(
    long           id,
    long           institutionId,
    String         alertType,
    String         title,
    String         message,
    String         severity,
    String         status,
    JsonObject     metadata,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
