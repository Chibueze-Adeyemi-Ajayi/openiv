package com.openiv.backend.kyc;

import java.time.OffsetDateTime;

public record KycLookupLog(
    long id,
    long institutionId,
    String customerRef,
    String triggerSource,
    String status,
    Integer responseCode,
    Integer durationMs,
    Integer kycTier,
    String kycStatus,
    String errorMessage,
    OffsetDateTime performedAt) {}
