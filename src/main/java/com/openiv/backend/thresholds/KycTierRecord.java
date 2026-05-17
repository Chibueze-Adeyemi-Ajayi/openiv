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
    Long dailyLimitWireInward,
    Long dailyLimitWireOutward,
    Long dailyLimitMobileInward,
    Long dailyLimitMobileOutward,
    Long dailyLimitUssdInward,
    Long dailyLimitUssdOutward,
    Long dailyLimitBdcInward,
    Long dailyLimitBdcOutward,
    Long dailyLimitOtherInward,
    Long dailyLimitOtherOutward,
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
