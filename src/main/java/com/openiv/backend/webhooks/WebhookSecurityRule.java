package com.openiv.backend.webhooks;

import java.time.OffsetDateTime;

public record WebhookSecurityRule(
    long           id,
    long           endpointId,
    long           institutionId,
    String         apiKey,
    String         ipAllowlist,
    int            timeoutSeconds,
    int            maxRetries,
    boolean        requireAck,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
