package com.openiv.backend.beam;

import io.vertx.core.json.JsonObject;

/**
 * Parsed payload from a beam {@code otps} stream record.
 * All fields nullable — the inbound JSON is untrusted; callers must null-check.
 *
 * Expected schema:
 * <pre>
 * {
 *   "customerId":    "C123",
 *   "customerName":  "Jane Doe",
 *   "channel":       "mobile | web | ussd",
 *   "otpType":       "login | transaction | withdrawal",
 *   "outcome":       "success | failed | expired | cancelled",
 *   "ip":            "1.2.3.4",
 *   "deviceId":      "d-abc123",
 *   "lat":           6.45,
 *   "lng":           3.39
 * }
 * </pre>
 */
public record OtpPayload(
    String customerId,
    String customerName,
    String channel,
    String otpType,
    String outcome,
    String ip,
    String deviceId,
    Double lat,
    Double lng
) {

  public static OtpPayload parse(String json) {
    if (json == null) return empty();
    try {
      JsonObject o = new JsonObject(json);
      return new OtpPayload(
          o.getString("customerId"),
          o.getString("customerName"),
          o.getString("channel"),
          o.getString("otpType"),
          o.getString("outcome"),
          o.getString("ip"),
          o.getString("deviceId"),
          o.getDouble("lat"),
          o.getDouble("lng")
      );
    } catch (Exception e) {
      return empty();
    }
  }

  public boolean isFailed() {
    return "failed".equals(outcome) || "expired".equals(outcome);
  }

  private static OtpPayload empty() {
    return new OtpPayload(null, null, null, null, null, null, null, null, null);
  }
}
