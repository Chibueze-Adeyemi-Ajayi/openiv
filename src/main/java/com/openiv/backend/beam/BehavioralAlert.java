package com.openiv.backend.beam;

import java.time.OffsetDateTime;

/**
 * Immutable alert record produced by {@link BehavioralBeamAnalyzer} for every rule
 * violation detected across the login, activity, location, device, and otp beams.
 */
public record BehavioralAlert(
    long           id,
    long           institutionId,
    String         beam,           // login | activity | location | device | otp
    String         rule,           // e.g. LOGIN_TIME_ANOMALY, DEVICE_CLONED
    String         severity,       // critical | high | warning | info
    String         customerId,
    String         deviceId,
    String         ip,
    String         channel,
    int            eventCount,
    String         detail,         // plain-English explanation
    int            riskScore,      // 0–100
    String[]       reasons,        // short bullet list for notifications
    String         status,         // pending | reviewed | dismissed
    Double         lat,            // event location (from payload)
    Double         lng,
    Double         customerLat,    // customer's usual location (for geo enrichment)
    Double         customerLng,
    Integer        distanceKm,     // haversine distance from usual location
    OffsetDateTime occurredAt,     // from beam payload
    OffsetDateTime firedAt,
    OffsetDateTime expiresAt
) {}
