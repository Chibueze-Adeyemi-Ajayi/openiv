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
      String otpType = o.getString("otpType",
          o.getString("otp_type",
          o.getString("event_type",
          o.getString("eventType"))));
      String msisdn = o.getString("msisdn",
          o.getString("phone_msisdn",
          o.getString("phoneMsisdn")));
      String transactionId = o.getString("transactionId",
          o.getString("transaction_id"));
      return new OtpPayload(
          customerId,
          customerName,
          o.getString("channel"),
          otpType,
          o.getString("outcome"),
          ip,
          o.getString("deviceId", o.getString("device_id")),
          o.getString("deviceModel", o.getString("device_model")),
          o.getDouble("lat"),
          o.getDouble("lng"),
          msisdn,
          o.getLong("amount"),
          o.getString("beneficiaryAccount", o.getString("beneficiary_account")),
          transactionId
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
