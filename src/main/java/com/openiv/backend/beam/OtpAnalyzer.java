package com.openiv.backend.beam;

import io.vertx.core.Future;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
 *
 * <p>Each rule has a per-rule + per-customer (or institution) cooldown window to prevent
 * alert storms from a single incident.
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

  /**
   * Entry point — call after a successful OTP beam record save.
   * Never throws; all Futures are self-contained and failures are logged.
   */
  public void analyze(long institutionId, OtpPayload payload) {
    if (payload.customerId() == null) return;

    runFailedCascade(institutionId, payload);
    runOtpBombing(institutionId, payload);
    runVelocitySpike(institutionId, payload);
    if (payload.deviceId() != null) {
      runNewDevice(institutionId, payload);
    }
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
                String detail = String.format(
                    "Customer %s had %d OTP failures in %d minutes (%s channel)",
                    payload.customerId(), count, FAILED_CASCADE_WINDOW_MIN, nvl(payload.channel()));
                return repo.save(institutionId, "FAILED_CASCADE", "critical",
                    payload.customerId(), null, payload.channel(),
                    payload.otpType(), count, detail);
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
                String detail = String.format(
                    "Customer %s triggered %d OTP requests in %d minutes — possible bombing attack",
                    payload.customerId(), count, OTP_BOMBING_WINDOW_MIN);
                return repo.save(institutionId, "OTP_BOMBING", "critical",
                    payload.customerId(), null, payload.channel(),
                    payload.otpType(), count, detail);
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
                String detail = String.format(
                    "%.0f%% OTP failure rate institution-wide over last %d minutes (%d/%d failures)",
                    rate * 100, VELOCITY_SPIKE_WINDOW_MIN, failed, total);
                return repo.save(institutionId, "VELOCITY_SPIKE", "warning",
                    null, null, null, null, failed, detail);
              });
        })
        .onFailure(err -> log.warn("VELOCITY_SPIKE rule error inst={}: {}", institutionId, err.getMessage()));
  }

  // ── NEW_DEVICE_SUSPICIOUS ─────────────────────────────────────────────────

  private void runNewDevice(long institutionId, OtpPayload payload) {
    repo.hasOtpHistory(institutionId, payload.customerId())
        .compose(hasHistory -> {
          if (!hasHistory) return Future.succeededFuture(); // new customer — expected new device
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
                      return repo.save(institutionId, "NEW_DEVICE_SUSPICIOUS", "warning",
                          payload.customerId(), payload.deviceId(), payload.channel(),
                          payload.otpType(), 1, detail);
                    });
              });
        })
        .onFailure(err -> log.warn("NEW_DEVICE_SUSPICIOUS rule error inst={}: {}", institutionId, err.getMessage()));
  }

  private static String nvl(String s) {
    return s != null ? s : "unknown";
  }
}
