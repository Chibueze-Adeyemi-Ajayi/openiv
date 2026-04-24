package com.openiv.backend.beam;

import java.time.OffsetDateTime;

public record BeamRecord(
    long id, long institutionId, String stream,
    String idempotencyKey, String payload, String status,
    OffsetDateTime receivedAt
) {}
