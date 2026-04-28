package com.openiv.backend.geofence;

import java.time.OffsetDateTime;

public record GeoFencedUser(
    long institutionId,
    long userId,
    Long addedBy,
    OffsetDateTime addedAt
) {}
