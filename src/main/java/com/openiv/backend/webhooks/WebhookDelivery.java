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
    OffsetDateTime createdAt,
    // Extended beam-log fields (null for old rows)
    String         deliveryId,
    String         requestHeaders,
    String         requestBody,
    String         responseHeaders,
    String         responseBody,
    Integer        durationMs,
    String         errorMessage
) {}
