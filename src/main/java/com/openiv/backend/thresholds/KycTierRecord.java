package com.openiv.backend.thresholds;

import java.time.OffsetDateTime;

public record KycTierRecord(
    long id,
    long institutionId,
    int kycTier,
    long dailyLimitWire,
    long dailyLimitMobile,
    long dailyLimitUssd,
    long dailyLimitBdc,
    long dailyLimitOther,
    long singleTxnLimitWire,
    long singleTxnLimitMobile,
    long singleTxnLimitUssd,
    long singleTxnLimitBdc,
    long singleTxnLimitOther,
    int maxTxnsPerHour,
    int maxTxnsPerDay,
    int riskScoreBoost,
    boolean requiresAdditionalVerification,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
