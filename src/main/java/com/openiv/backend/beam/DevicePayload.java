package com.openiv.backend.beam;

import io.vertx.core.json.JsonObject;

/**
 * Parsed payload from a beam {@code devices} stream record.
 *
 * <p>Expected schema:
 * <pre>
 * {
 *   "customerId":   "C123",
 *   "customerName": "Jane Doe",
 *   "deviceId":     "d-abc123",
 *   "deviceModel":  "Samsung Galaxy S23",
 *   "deviceOs":     "Android",
 *   "osVersion":    "14",
 *   "appVersion":   "3.2.1",
 *   "isJailbroken": false,
 *   "isEmulator":   false,
 *   "isRooted":     false,
 *   "ip":           "1.2.3.4",
 *   "lat":          6.45,
 *   "lng":          3.39,
 *   "country":      "NG",
 *   "occurred_at":  "2026-05-11T10:00:00+01:00"
 * }
 * </pre>
 */
public record DevicePayload(
    String  customerId,
    String  customerName,
    String  deviceId,
    String  deviceModel,
    String  deviceOs,
    String  osVersion,
    String  appVersion,
    Boolean isJailbroken,
    Boolean isEmulator,
    Boolean isRooted,
    String  ip,
    Double  lat,
    Double  lng,
    String  country
) {
    public static DevicePayload parse(String json) {
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
            boolean isRooted = Boolean.TRUE.equals(o.getBoolean("isRooted",
                o.getBoolean("is_rooted",
                o.getBoolean("rooted_or_jailbroken", false))));
            boolean isJailbroken = Boolean.TRUE.equals(o.getBoolean("isJailbroken",
                o.getBoolean("is_jailbroken",
                o.getBoolean("rooted_or_jailbroken", false))));
            return new DevicePayload(
                customerId,
                customerName,
                o.getString("deviceId", o.getString("device_id")),
                o.getString("deviceModel", o.getString("device_model", o.getString("model"))),
                o.getString("deviceOs", o.getString("device_os", o.getString("os"))),
                o.getString("osVersion", o.getString("os_version")),
                o.getString("appVersion", o.getString("app_version")),
                isJailbroken,
                o.getBoolean("isEmulator",   o.getBoolean("is_emulator",   false)),
                isRooted,
                ip,
                o.getDouble("lat"),
                o.getDouble("lng"),
                o.getString("country")
            );
        } catch (Exception e) {
            return empty();
        }
    }

    public boolean isCompromised() {
        return Boolean.TRUE.equals(isJailbroken) || Boolean.TRUE.equals(isRooted);
    }

    private static DevicePayload empty() {
        return new DevicePayload(null, null, null, null, null, null, null,
                                 false, false, false, null, null, null, null);
    }
}
