package com.openiv.backend.kyc;

import java.time.OffsetDateTime;

public record KycConfig(
    long id,
    long institutionId,
    String lookupUrl,
    String lookupApiKey,
    int lookupTimeout,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {}
