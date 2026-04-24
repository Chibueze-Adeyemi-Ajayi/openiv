package com.openiv.backend.beam;

import java.time.OffsetDateTime;

public record BeamApiKey(
    long id, long institutionId, String prefix,
    OffsetDateTime createdAt, OffsetDateTime lastUsedAt
) {}
