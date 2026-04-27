package com.openiv.backend.dashboard;

import java.time.OffsetDateTime;

public record ActivityEvent(
    long           id,
    String         source,
    String         severity,
    String         title,
    String         detail,
    String         entityId,
    String         entityType,
    String         actor,
    OffsetDateTime occurredAt
) {}
