package com.openiv.backend.transactions;

import java.time.Duration;
import java.util.Optional;

/**
 * Evaluates geo-velocity between two transactions for the same customer.
 *
 * Physics baseline
 * ────────────────
 *  Walking          5 km/h
 *  Car (highway)  120 km/h
 *  Fast car       200 km/h
 *  Helicopter     300 km/h
 *  Propeller      500 km/h
 *  Commercial jet 900 km/h  (Boeing 787 cruise ~903 km/h)
 *  With tailwind 1050 km/h  (absolute ceiling for any commercial service)
 *  Supersonic    2000+ km/h (Concorde retired 2003; no civil equivalents today)
 *
 * Rule tiers (speed = great-circle distance / elapsed hours)
 * ─────────────────────────────────────────────────────────
 *  ≤ 200 km/h   – plausible ground travel, no flag
 *  200–500      – very fast ground / helicopter; informational only (+15)
 *  500–900      – requires air travel; medium flag (+35)
 *  900–1050     – at the limit of commercial aviation; high flag (+60)
 *  > 1050       – physically impossible by any civil aircraft; critical auto-case (hard 93)
 *
 * Edge-case guards
 * ────────────────
 *  · Missing coordinates on either record → no check
 *  · Distance < 1 km (GPS noise)          → no flag
 *  · Gap < 30 seconds with dist > 50 km   → impossible; hard 93
 *  · Gap > 24 hours                       → stale; skip
 */
public final class GeoVelocityChecker {

  // Absolute ceiling for commercial aviation (km/h)
  private static final double MAX_COMMERCIAL_SPEED = 1_050.0;

  // Fastest plausible ground/sea transport  (km/h)
  private static final double MAX_GROUND_SPEED = 200.0;

  // Threshold above which a transaction corridor requires air travel
  private static final double MIN_AIRCRAFT_SPEED = 500.0;

  // GPS noise floor — distances below this are ignored
  private static final double MIN_DISTANCE_KM = 1.0;

  // Maximum lookback: gaps wider than this make velocity checks meaningless
  private static final double MAX_LOOKBACK_HOURS = 24.0;

  // If elapsed < this AND distance is significant → simultaneous / impossible
  private static final double MIN_ELAPSED_SECONDS = 30.0;

  private GeoVelocityChecker() {}

  public record GeoVelocityResult(
      boolean triggered,
      String ruleId,
      int scoreContribution,
      String reason,
      double distanceKm,
      double impliedSpeedKmh,
      double elapsedMinutes
  ) {
    static GeoVelocityResult noFlag() {
      return new GeoVelocityResult(false, null, 0, null, 0, 0, 0);
    }
  }

  /**
   * Check geo-velocity between {@code current} and the most recent prior transaction
   * that carried coordinates.
   *
   * @param current  the transaction just received
   * @param previous the customer's last transaction that had lat/lng (may be empty)
   */
  public static GeoVelocityResult check(Transaction current, Optional<Transaction> previous) {
    if (previous.isEmpty()) return GeoVelocityResult.noFlag();
    return checkPair(current, previous.get());
  }

  private static GeoVelocityResult checkPair(Transaction current, Transaction previous) {
    // Both records must carry coordinates
    if (current.lat() == null || current.lng() == null
        || previous.lat() == null || previous.lng() == null) {
      return GeoVelocityResult.noFlag();
    }

    if (current.occurredAt() == null || previous.occurredAt() == null) {
      return GeoVelocityResult.noFlag();
    }

    double distKm = haversineKm(
        current.lat(),  current.lng(),
        previous.lat(), previous.lng());

    if (distKm < MIN_DISTANCE_KM) return GeoVelocityResult.noFlag();

    double elapsedSeconds = Math.abs(
        Duration.between(previous.occurredAt(), current.occurredAt()).toSeconds());
    double elapsedHours   = elapsedSeconds / 3_600.0;

    if (elapsedHours > MAX_LOOKBACK_HOURS) return GeoVelocityResult.noFlag();

    // Near-simultaneous transactions in different locations
    if (elapsedSeconds < MIN_ELAPSED_SECONDS && distKm > 50.0) {
      double mins = elapsedSeconds / 60.0;
      String reason = String.format(
          "Two transactions for the same customer appeared %.0f km apart "
          + "within %.1f seconds of each other. No transport — not even the fastest military jet "
          + "— can cover that distance that quickly. This is a strong indicator of card cloning, "
          + "account sharing, or simultaneous session hijacking.",
          distKm, elapsedSeconds);
      return new GeoVelocityResult(true, "TXN_IMPOSSIBLE_TRAVEL", 93, reason,
          distKm, Double.MAX_VALUE, mins);
    }

    if (elapsedSeconds < 1.0) return GeoVelocityResult.noFlag();

    double speedKmh      = distKm / elapsedHours;
    double elapsedMins   = elapsedSeconds / 60.0;

    if (speedKmh > MAX_COMMERCIAL_SPEED) {
      // Faster than any civil aircraft — physically impossible
      String reason = buildReason(distKm, speedKmh, elapsedMins,
          "faster than any commercial aircraft on earth",
          "This is physically impossible for a legitimate traveller. Likely card cloning, "
          + "session hijacking, or credential theft across multiple locations.");
      return new GeoVelocityResult(true, "TXN_IMPOSSIBLE_TRAVEL", 93, reason,
          distKm, speedKmh, elapsedMins);

    } else if (speedKmh > 900.0) {
      // At the outer edge of commercial aviation (tailwind conditions)
      String reason = buildReason(distKm, speedKmh, elapsedMins,
          "at the outer limit of commercial air speed",
          "The implied speed exceeds the cruise speed of most jetliners (≈ 905 km/h). "
          + "Even under the most favourable tailwind conditions this corridor is borderline. "
          + "Requires investigation to confirm the customer was genuinely in transit.");
      return new GeoVelocityResult(true, "TXN_SUSPICIOUS_TRAVEL", 60, reason,
          distKm, speedKmh, elapsedMins);

    } else if (speedKmh > MIN_AIRCRAFT_SPEED) {
      // Requires air travel — physically plausible but notable
      String reason = buildReason(distKm, speedKmh, elapsedMins,
          "requiring air travel",
          "The customer would need to have been on a flight between these two locations. "
          + "While possible, a transaction mid-travel is unusual and should be verified "
          + "against travel records or the customer's stated location.");
      return new GeoVelocityResult(true, "TXN_AIR_TRAVEL_REQUIRED", 35, reason,
          distKm, speedKmh, elapsedMins);

    } else if (speedKmh > MAX_GROUND_SPEED) {
      // Very fast ground / helicopter — low concern, informational
      String reason = buildReason(distKm, speedKmh, elapsedMins,
          "implying very fast ground transport or helicopter",
          "The speed is above a typical highway car but below aircraft range. "
          + "Low risk on its own; worth noting if combined with other flags.");
      return new GeoVelocityResult(true, "TXN_HIGH_VELOCITY", 15, reason,
          distKm, speedKmh, elapsedMins);
    }

    return GeoVelocityResult.noFlag();
  }

  private static String buildReason(
      double distKm, double speedKmh, double elapsedMins,
      String speedLabel, String interpretation) {
    return String.format(
        "Geo-velocity check: the customer's previous transaction location and this one are "
        + "%.0f km apart, yet only %.1f minutes elapsed. "
        + "The implied travel speed is %.0f km/h — %s. %s",
        distKm, elapsedMins, speedKmh, speedLabel, interpretation);
  }

  /**
   * Haversine great-circle distance between two WGS-84 coordinates, in kilometres.
   */
  public static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
    final double R = 6_371.0; // Earth mean radius, km
    double dLat = Math.toRadians(lat2 - lat1);
    double dLon = Math.toRadians(lon2 - lon1);
    double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
        * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
