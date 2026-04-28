package com.openiv.backend.beam;

import java.time.OffsetDateTime;

public record OtpAlert(
    long           id,
    long           institutionId,
    String         rule,
    String         severity,
    String         customerId,
    String         deviceId,
    String         channel,
    String         otpType,
    int            eventCount,
    String         detail,
    OffsetDateTime firedAt,
    // enrichment fields
    String         customerName,
    String         msisdn,
    String         ip,
    Double         txnLat,
    Double         txnLng,
    Long           amount,
    String         beneficiaryAccount,
    String         deviceModel,
    String         transactionId,
    int            riskScore,
    String[]       reasons,
    String         status,
    OffsetDateTime expiresAt,
    Double         customerLat,
    Double         customerLng,
    Integer        distanceKm
) {}
