package com.openiv.backend.webhooks;

import java.time.OffsetDateTime;
import java.util.List;

public record WebhookEndpoint(
    long           id,
    long           institutionId,
    String         url,
    String         description,
    List<String>   events,
    String         status,
    long           createdBy,
    long           successCount,
    long           failureCount,
    OffsetDateTime lastDeliveredAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
