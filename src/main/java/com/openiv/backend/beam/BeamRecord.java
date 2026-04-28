package com.openiv.backend.beam;

import java.time.OffsetDateTime;

public record BeamRecord(
    long           id,
    long           institutionId,
    String         stream,
    String         idempotencyKey,
    String         payload,
    String         status,
    OffsetDateTime receivedAt,
    // Network monitoring fields (null for rows pre-dating V30 migration)
    String         ip,
    String         userAgent,
    String         requestHeaders,
    int            responseCode,
    String         responseBody,
    Integer        durationMs,
    Integer        bytes
) {}
