package com.openiv.backend.network;

import java.time.OffsetDateTime;

public record NetworkEntry(
    String         id,
    String         source,
    String         method,
    String         endpoint,
    String         stream,
    int            statusCode,
    Integer        durationMs,
    Integer        bytes,
    String         ip,
    String         reqHeaders,
    String         reqBody,
    String         resHeaders,
    String         resBody,
    String         errorMessage,
    OffsetDateTime ts
) {}
