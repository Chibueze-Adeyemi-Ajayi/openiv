package com.openiv.backend.beam;

import io.vertx.core.json.JsonObject;

/**
 * Parsed payload from a beam {@code otps} stream record.
 * All fields nullable — the inbound JSON is untrusted; callers must null-check.
 *
 * Expected schema:
 * <pre>
 * {
 *   "customerId":          "C123",
 *   "customerName":        "Jane Doe",          // optional — display name for agents
 *   "channel":             "mobile | web | ussd",
 *   "otpType":             "login | transaction | withdrawal",
 *   "outcome":             "success | failed | expired | cancelled",
 *   "ip":                  "1.2.3.4",           // optional — OTP request IP
 *   "deviceId":            "d-abc123",
 *   "deviceModel":         "iPhone 14 Pro",      // optional — human-readable device label
 *   "lat":                 6.45,                 // optional — OTP trigger location
 *   "lng":                 3.39,
 *   "msisdn":              "+2348031234567",      // optional — customer phone number
 *   "amount":              14250000,              // optional — transaction amount being protected
 *   "beneficiaryAccount":  "ACC-8821 · GT Bank", // optional — beneficiary account description
 *   "transactionId":       "TXN-48721"           // optional — linked transaction ID
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
    String deviceModel,
    Double lat,
    Double lng,
    String msisdn,
    Long   amount,
    String beneficiaryAccount,
    String transactionId
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
          o.getString("deviceModel"),
          o.getDouble("lat"),
          o.getDouble("lng"),
          o.getString("msisdn"),
          o.getLong("amount"),
          o.getString("beneficiaryAccount"),
          o.getString("transactionId")
      );
    } catch (Exception e) {
      return empty();
    }
  }

  public boolean isFailed() {
    return "failed".equals(outcome) || "expired".equals(outcome);
  }

  private static OtpPayload empty() {
    return new OtpPayload(null, null, null, null, null, null, null, null, null, null, null, null, null, null);
  }
}
