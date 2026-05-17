package com.openiv.backend.waitlist;

import java.time.OffsetDateTime;

public record WaitlistEntry(
    long           id,
    String         name,
    String         email,
    String         description,
    String         source,
    OffsetDateTime createdAt
) {}
