package com.openiv.backend.network;

import java.time.OffsetDateTime;

public record NetworkFilter(
    String         source,
    String         statusClass,
    OffsetDateTime since,
    String         q,
    int            limit,
    int            offset
) {}
