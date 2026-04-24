package com.openiv.backend.webhooks;

import java.time.OffsetDateTime;

public record WebhookDelivery(
    long           id,
    long           endpointId,
    long           institutionId,
    String         eventType,
    String         status,
    Integer        responseCode,
    int            attemptCount,
    OffsetDateTime deliveredAt,
    OffsetDateTime createdAt
) {}
