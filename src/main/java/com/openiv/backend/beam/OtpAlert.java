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
    OffsetDateTime firedAt
) {}
