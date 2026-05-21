package com.openiv.backend.kyc;

import java.time.OffsetDateTime;

/**
 * Configures how often a customer should be re-evaluated through the full KYC
 * pipeline after a transaction beam updates their record.
 */
public record KycEvaluationConfig(
    long           id,
    long           institutionId,
    int            intervalDays,
    boolean        enabled,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
