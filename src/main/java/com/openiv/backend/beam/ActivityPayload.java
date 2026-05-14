package com.openiv.backend.beam;

import io.vertx.core.json.JsonObject;

/**
 * Parsed payload from a beam {@code activity} stream record.
 *
 * <p>Accepted field names (snake_case variants are all supported):
 * <pre>
 * {
 *   "user_id":       "USR-001",      // also: customerId, customer_id, userId
 *   "user_name":     "Jane Doe",     // also: customerName, customer_name, userName
 *   "event_name":    "beneficiary_added",   // also: activityType, activity_type
 *   "screen":        "transfer/confirm",
 *   "session_id":    "SES-3491f",    // also: sessionId
 *   "ip_address":    "1.2.3.4",      // also: ip
 *   "device_id":     "d-abc123",     // also: deviceId
 *   "lat":           6.45,
 *   "lng":           3.39,
 *   "occurred_at":   "2026-05-11T02:30:00+01:00"
 * }
 * </pre>
 */
public record ActivityPayload(
    String customerId,
    String customerName,
    String activityType,
    String screen,
    String sessionId,
    String ip,
    String deviceId,
    Double lat,
    Double lng
) {
    public static ActivityPayload parse(String json) {
        if (json == null) return empty();
        try {
            JsonObject o = new JsonObject(json);
            String customerId = o.getString("customerId",
                o.getString("customer_id",
                o.getString("userId",
                o.getString("user_id"))));
            String customerName = o.getString("customerName",
                o.getString("customer_name",
                o.getString("userName",
                o.getString("user_name"))));
            String ip = o.getString("ip",
                o.getString("ip_address",
                o.getString("ipAddress")));
            String activityType = o.getString("activityType",
                o.getString("activity_type",
                o.getString("event_name",
                o.getString("eventName",
                o.getString("activity_name")))));
            return new ActivityPayload(
                customerId,
                customerName,
                activityType,
                o.getString("screen"),
                o.getString("sessionId", o.getString("session_id")),
                ip,
                o.getString("deviceId", o.getString("device_id")),
                o.getDouble("lat"),
                o.getDouble("lng")
            );
        } catch (Exception e) {
            return empty();
        }
    }

    private static ActivityPayload empty() {
        return new ActivityPayload(null, null, null, null, null, null, null, null, null);
    }
}
