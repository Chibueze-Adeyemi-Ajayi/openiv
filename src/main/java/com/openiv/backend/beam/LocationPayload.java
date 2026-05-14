package com.openiv.backend.beam;

import io.vertx.core.json.JsonObject;

/**
 * Parsed payload from a beam {@code location} stream record.
 *
 * <p>Expected schema:
 * <pre>
 * {
 *   "customerId":  "C123",
 *   "customerName":"Jane Doe",
 *   "lat":          6.45,
 *   "lng":          3.39,
 *   "country":     "NG",
 *   "city":        "Lagos",
 *   "ip":          "1.2.3.4",
 *   "deviceId":    "d-abc123",
 *   "accuracy":    12.5,           // GPS accuracy in metres
 *   "provider":    "gps | network | wifi",
 *   "occurred_at": "2026-05-11T14:00:00+01:00"
 * }
 * </pre>
 */
public record LocationPayload(
    String customerId,
    String customerName,
    Double lat,
    Double lng,
    String country,
    String city,
    String ip,
    String deviceId,
    Double accuracy,
    String provider
) {
    public static LocationPayload parse(String json) {
        if (json == null) return empty();
        try {
            JsonObject o = new JsonObject(json);
            return new LocationPayload(
                o.getString("customerId", o.getString("customer_id",
                    o.getString("userId", o.getString("user_id")))),
                o.getString("customerName", o.getString("customer_name",
                    o.getString("userName", o.getString("user_name")))),
                o.getDouble("lat"),
                o.getDouble("lng"),
                o.getString("country"),
                o.getString("city"),
                o.getString("ip", o.getString("ip_address", o.getString("ipAddress"))),
                o.getString("deviceId", o.getString("device_id")),
                o.getDouble("accuracy", o.getDouble("accuracy_m")),
                o.getString("provider", o.getString("source"))
            );
        } catch (Exception e) {
            return empty();
        }
    }

    private static LocationPayload empty() {
        return new LocationPayload(null, null, null, null, null, null, null, null, null, null);
    }
}
