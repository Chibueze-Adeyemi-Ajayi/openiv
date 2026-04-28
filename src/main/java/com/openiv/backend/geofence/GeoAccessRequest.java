package com.openiv.backend.geofence;

import java.time.OffsetDateTime;

public record GeoAccessRequest(
    long id,
    long institutionId,
    long userId,
    long sessionId,
    Double rawLat,
    Double rawLng,
    String ip,
    String userAgent,
    String deviceId,
    String watchToken,
    String status,
    Long reviewedBy,
    OffsetDateTime reviewedAt,
    OffsetDateTime expiresAt,
    OffsetDateTime createdAt,
    // enriched fields joined from users table
    String userEmail,
    String userFullName
) {}
