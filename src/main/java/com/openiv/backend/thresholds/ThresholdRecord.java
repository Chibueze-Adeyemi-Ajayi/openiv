package com.openiv.backend.thresholds;

import java.time.OffsetDateTime;

public record ThresholdRecord(
    long           id,
    long           institutionId,
    String         ruleId,
    String         name,
    String         description,
    String         tag,
    long           thresholdValue,
    String         unit,
    long           minValue,
    long           maxValue,
    long           stepValue,
    boolean        isActive,
    int            firedCount,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    Long           thresholdOutward,
    Long           thresholdInward,
    Integer        riskScore        // null = use platform default; set per-institution via Thresholds UI
) {}
