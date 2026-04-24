package com.openiv.backend.thresholds;

import java.time.OffsetDateTime;

public record ThresholdChange(
    long           id,
    long           thresholdId,
    long           institutionId,
    long           changedBy,
    String         changedByName,
    String         field,
    String         oldValue,
    String         newValue,
    OffsetDateTime createdAt
) {}
