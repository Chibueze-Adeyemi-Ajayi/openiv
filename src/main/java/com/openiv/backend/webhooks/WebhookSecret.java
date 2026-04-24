package com.openiv.backend.webhooks;

import java.time.OffsetDateTime;

public record WebhookSecret(
    long           id,
    long           institutionId,
    String         secret,
    boolean        autoRotate,
    OffsetDateTime nextRotation,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
