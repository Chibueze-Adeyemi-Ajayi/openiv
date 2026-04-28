package com.openiv.backend.billing;

import java.time.OffsetDateTime;

public record PaymentMethod(
    long           id,
    long           institutionId,
    String         provider,
    String         providerRef,
    String         type,
    String         displayName,
    String         last4,
    boolean        isDefault,
    OffsetDateTime createdAt
) {}
