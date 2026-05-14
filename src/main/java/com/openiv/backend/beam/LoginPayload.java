package com.openiv.backend.beam;

import io.vertx.core.json.JsonObject;

/**
 * Parsed payload from a beam {@code logins} stream record.
 *
 * <p>Accepted field names (snake_case variants are all supported):
 * <pre>
 * {
 *   "user_id":      "USR-001",          // also: customerId, customer_id, userId
 *   "user_name":    "Jane Doe",          // also: customerName, customer_name, userName
 *   "outcome":      "success | failed | locked | mfa_required",
 *   "channel":      "mobile | web | ussd | api",
 *   "ip_address":   "1.2.3.4",          // also: ip
 *   "device_id":    "d-abc123",          // also: deviceId
 *   "device_model": "iPhone 14 Pro",     // also: deviceModel
 *   "lat":          6.45,
 *   "lng":          3.39,
 *   "location":     "Lagos, NG",         // parsed into city/country if country/city absent
 *   "country":      "NG",
 *   "city":         "Lagos",
 *   "session_id":   "ses-xyz",           // also: sessionId
 *   "user_agent":   "Mozilla/5.0 ...",   // also: userAgent
 *   "occurred_at":  "2026-05-11T02:30:00+01:00"
 * }
 * </pre>
 */
public record LoginPayload(
    String customerId,
    String customerName,
    String channel,
    String outcome,
    String ip,
    String deviceId,
    String deviceModel,
    Double lat,
    Double lng,
    String country,
    String city,
    String sessionId,
    String userAgent
) {
    public static LoginPayload parse(String json) {
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
            String location = o.getString("location");
            String city    = o.getString("city",    location);
            String country = o.getString("country");
            return new LoginPayload(
                customerId,
                customerName,
                o.getString("channel"),
                o.getString("outcome"),
                ip,
                o.getString("deviceId", o.getString("device_id")),
                o.getString("deviceModel", o.getString("device_model", o.getString("model"))),
                o.getDouble("lat"),
                o.getDouble("lng"),
                country,
                city,
                o.getString("sessionId", o.getString("session_id")),
                o.getString("userAgent", o.getString("user_agent"))
            );
        } catch (Exception e) {
            return empty();
        }
    }

    public boolean isFailed() {
        return "failed".equals(outcome) || "locked".equals(outcome);
    }

    public boolean isSuccess() {
        return "success".equals(outcome);
    }

    private static LoginPayload empty() {
        return new LoginPayload(null, null, null, null, null, null, null,
                                null, null, null, null, null, null);
    }
}
