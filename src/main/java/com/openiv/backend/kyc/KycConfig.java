package com.openiv.backend.kyc;

import java.time.OffsetDateTime;

public record KycConfig(
    long id,
    long institutionId,
    String lookupUrl,
    String lookupApiKey,
    int lookupTimeout,
    String listenerUrl,
    String listenerApiKey,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {}
