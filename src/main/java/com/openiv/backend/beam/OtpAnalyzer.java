package com.openiv.backend.beam;

import io.vertx.core.Future;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

/**
 * Inline async OTP anomaly detector — Eureka rule engine for the {@code otps} beam stream.
 *
 * <p>Called fire-and-forget after every successful OTP ingest. All DB work is non-blocking
 * via the reactive pool. Any rule failure is logged and swallowed; the ingest caller is
 * never affected.
 *
 * <p><b>Rules:</b>
 * <ul>
 *   <li>FAILED_CASCADE — 3+ failures in 5 min for same customer → critical</li>
 *   <li>OTP_BOMBING — 7+ requests in 10 min for same customer → critical</li>
 *   <li>VELOCITY_SPIKE — &gt;30% institution-wide failure rate in 5 min (min 10 events) → warning</li>
 *   <li>NEW_DEVICE_SUSPICIOUS — known customer, never-before-seen device → warning</li>
 * </ul>
 */
public final class OtpAnalyzer {

  private static final Logger log = LoggerFactory.getLogger(OtpAnalyzer.class);

  private static final int    FAILED_CASCADE_THRESHOLD  = 3;
  private static final int    FAILED_CASCADE_WINDOW_MIN = 5;
  private static final int    FAILED_CASCADE_COOLDOWN   = 30;

  private static final int    OTP_BOMBING_THRESHOLD     = 7;
  private static final int    OTP_BOMBING_WINDOW_MIN    = 10;
  private static final int    OTP_BOMBING_COOLDOWN      = 30;

  private static final double VELOCITY_SPIKE_RATE       = 0.30;
  private static final int    VELOCITY_SPIKE_MIN_EVENTS = 10;
  private static final int    VELOCITY_SPIKE_WINDOW_MIN = 5;
  private static final int    VELOCITY_SPIKE_COOLDOWN   = 15;

  private static final int    NEW_DEVICE_COOLDOWN       = 60;

  private final OtpAlertRepository repo;

  public OtpAnalyzer(OtpAlertRepository repo) {
    this.repo = repo;
  }

  public void analyze(long institutionId, OtpPayload payload) {
    if (payload.customerId() == null) return;

    runFailedCascade(institutionId, payload);
    runOtpBombing(institutionId, payload);
    runVelocitySpike(institutionId, payload);
    if (payload.deviceId() != null) {
      runNewDevice(institutionId, payload);
    }
  }

  public Future<Boolean> hasRecentAlert(long institutionId, String customerId, int windowMinutes) {
    return repo.hasRecentAlert(institutionId, customerId, windowMinutes);
  }

  // ── FAILED_CASCADE ────────────────────────────────────────────────────────

  private void runFailedCascade(long institutionId, OtpPayload payload) {
    if (!payload.isFailed()) return;
    repo.isInCooldown(institutionId, "FAILED_CASCADE", payload.customerId(), FAILED_CASCADE_COOLDOWN)
        .compose(inCooldown -> {
          if (inCooldown) return Future.succeededFuture();
          return repo.countRecent(institutionId, payload.customerId(), "failed", FAILED_CASCADE_WINDOW_MIN)
              .compose(count -> {
                if (count < FAILED_CASCADE_THRESHOLD) return Future.succeededFuture();
                int score = Math.min(95, 70 + (count - FAILED_CASCADE_THRESHOLD) * 5);
                String detail = String.format(
                    "Customer %s had %d OTP failures in %d minutes (%s channel)",
                    payload.customerId(), count, FAILED_CASCADE_WINDOW_MIN, nvl(payload.channel()));
                List<String> reasons = new ArrayList<>();
                reasons.add(count + " OTP failures in " + FAILED_CASCADE_WINDOW_MIN + " minutes");
                if (payload.channel() != null) reasons.add("Channel: " + payload.channel());
                if (payload.otpType() != null) reasons.add("OTP type: " + payload.otpType());
                return fireWithLocation(institutionId, "FAILED_CASCADE", "critical",
                    payload, count, detail, score, reasons);
              });
        })
        .onFailure(err -> log.warn("FAILED_CASCADE rule error inst={}: {}", institutionId, err.getMessage()));
  }

  // ── OTP_BOMBING ───────────────────────────────────────────────────────────

  private void runOtpBombing(long institutionId, OtpPayload payload) {
    repo.isInCooldown(institutionId, "OTP_BOMBING", payload.customerId(), OTP_BOMBING_COOLDOWN)
        .compose(inCooldown -> {
          if (inCooldown) return Future.succeededFuture();
          return repo.countRecent(institutionId, payload.customerId(), null, OTP_BOMBING_WINDOW_MIN)
              .compose(count -> {
                if (count < OTP_BOMBING_THRESHOLD) return Future.succeededFuture();
                int score = Math.min(95, 80 + (count - OTP_BOMBING_THRESHOLD) * 2);
                String detail = String.format(
                    "Customer %s triggered %d OTP requests in %d minutes — possible bombing attack",
                    payload.customerId(), count, OTP_BOMBING_WINDOW_MIN);
                List<String> reasons = new ArrayList<>();
                reasons.add(count + " OTP requests in " + OTP_BOMBING_WINDOW_MIN + " minutes");
                reasons.add("Possible OTP bombing / SIM-swap precursor");
                if (payload.channel() != null) reasons.add("Channel: " + payload.channel());
                return fireWithLocation(institutionId, "OTP_BOMBING", "critical",
                    payload, count, detail, score, reasons);
              });
        })
        .onFailure(err -> log.warn("OTP_BOMBING rule error inst={}: {}", institutionId, err.getMessage()));
  }

  // ── VELOCITY_SPIKE ────────────────────────────────────────────────────────

  private void runVelocitySpike(long institutionId, OtpPayload payload) {
    repo.isInCooldown(institutionId, "VELOCITY_SPIKE", null, VELOCITY_SPIKE_COOLDOWN)
        .compose(inCooldown -> {
          if (inCooldown) return Future.succeededFuture();
          return repo.institutionFailureRate(institutionId, VELOCITY_SPIKE_WINDOW_MIN)
              .compose(counts -> {
                int failed = counts[0];
                int total  = counts[1];
                if (total < VELOCITY_SPIKE_MIN_EVENTS) return Future.succeededFuture();
                double rate = (double) failed / total;
                if (rate < VELOCITY_SPIKE_RATE) return Future.succeededFuture();
                int score = 65;
                String detail = String.format(
                    "%.0f%% OTP failure rate institution-wide over last %d minutes (%d/%d failures)",
                    rate * 100, VELOCITY_SPIKE_WINDOW_MIN, failed, total);
                List<String> reasons = new ArrayList<>();
                reasons.add(String.format("%.0f%% institution-wide failure rate in %d min",
                    rate * 100, VELOCITY_SPIKE_WINDOW_MIN));
                reasons.add(failed + " of " + total + " OTP requests failed");
                return repo.save(institutionId, "VELOCITY_SPIKE", "warning",
                    null, null, null, null, failed, detail,
                    null, score, reasons.toArray(new String[0]),
                    null, null, null);
              });
        })
        .onFailure(err -> log.warn("VELOCITY_SPIKE rule error inst={}: {}", institutionId, err.getMessage()));
  }

  // ── NEW_DEVICE_SUSPICIOUS ─────────────────────────────────────────────────

  private void runNewDevice(long institutionId, OtpPayload payload) {
    repo.hasOtpHistory(institutionId, payload.customerId())
        .compose(hasHistory -> {
          if (!hasHistory) return Future.succeededFuture();
          return repo.isInCooldown(institutionId, "NEW_DEVICE_SUSPICIOUS",
                  payload.customerId(), NEW_DEVICE_COOLDOWN)
              .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();
                return repo.isNewDevice(institutionId, payload.customerId(), payload.deviceId())
                    .compose(isNew -> {
                      if (!isNew) return Future.succeededFuture();
                      String detail = String.format(
                          "Customer %s used a new device (%s) for a %s OTP request via %s",
                          payload.customerId(), payload.deviceId(),
                          nvl(payload.otpType()), nvl(payload.channel()));
                      List<String> reasons = new ArrayList<>();
                      reasons.add("New device fingerprint: " + payload.deviceId());
                      if (payload.deviceModel() != null) reasons.add("Device: " + payload.deviceModel());
                      if (payload.otpType()    != null) reasons.add("OTP type: " + payload.otpType());
                      if (payload.channel()    != null) reasons.add("Channel: " + payload.channel());
                      return fireWithLocation(institutionId, "NEW_DEVICE_SUSPICIOUS", "warning",
                          payload, 1, detail, 68, reasons);
                    });
              });
        })
        .onFailure(err -> log.warn("NEW_DEVICE_SUSPICIOUS rule error inst={}: {}", institutionId, err.getMessage()));
  }

  // ── Shared enrichment helper ──────────────────────────────────────────────

  /** Looks up the customer's usual location, appends a distance reason if available, then saves. */
  private Future<OtpAlert> fireWithLocation(long institutionId, String rule, String severity,
                                            OtpPayload payload, int eventCount, String detail,
                                            int baseScore, List<String> reasons) {
    if (payload.customerId() == null || payload.lat() == null || payload.lng() == null) {
      return repo.save(institutionId, rule, severity,
          payload.customerId(), payload.deviceId(), payload.channel(), payload.otpType(),
          eventCount, detail, payload, baseScore, reasons.toArray(new String[0]),
          null, null, null);
    }

    return repo.lookupCustomerLocation(institutionId, payload.customerId())
        .compose(custLoc -> {
          Double customerLat = null, customerLng = null;
          Integer distanceKm = null;
          int score = baseScore;

          if (custLoc != null) {
            customerLat = custLoc[0];
            customerLng = custLoc[1];
            distanceKm  = haversineKm(customerLat, customerLng, payload.lat(), payload.lng());
            // Boost score based on geo-distance
            if      (distanceKm > 500) { score = Math.min(95, score + 15); reasons.add(0, distanceKm + " km from usual location"); }
            else if (distanceKm > 200) { score = Math.min(95, score + 10); reasons.add(0, distanceKm + " km from usual location"); }
            else if (distanceKm > 50)  { score = Math.min(95, score + 5);  reasons.add(0, distanceKm + " km from usual location"); }
          }

          return repo.save(institutionId, rule, severity,
              payload.customerId(), payload.deviceId(), payload.channel(), payload.otpType(),
              eventCount, detail, payload, score, reasons.toArray(new String[0]),
              customerLat, customerLng, distanceKm);
        });
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private static String nvl(String s) { return s != null ? s : "unknown"; }

  private static int haversineKm(double lat1, double lng1, double lat2, double lng2) {
    double R    = 6371;
    double dLat = Math.toRadians(lat2 - lat1);
    double dLng = Math.toRadians(lng2 - lng1);
    double a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
        * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return (int) (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
}
