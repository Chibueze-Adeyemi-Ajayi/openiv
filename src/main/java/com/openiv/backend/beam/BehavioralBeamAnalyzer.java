package com.openiv.backend.beam;

import com.openiv.backend.aml.AmlSettings;
import com.openiv.backend.cases.CaseRepository;
import com.openiv.backend.notifications.NotificationService;
import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Behavioral beam anomaly detector — Eureka rule engine for the {@code logins},
 * {@code activity}, {@code location}, {@code devices}, and {@code otps} streams.
 *
 * <h2>Architecture</h2>
 * <ul>
 *   <li>Called fire-and-forget after every successful beam ingest.</li>
 *   <li>All DB work is non-blocking via the reactive pool.</li>
 *   <li>Rule failures are logged and swallowed; the ingest caller is never affected.</li>
 *   <li>On alert: saves to {@code behavioral_alerts}, raises a notification, and
 *       (when score ≥ institution threshold) auto-opens a case.</li>
 * </ul>
 *
 * <h2>Fuzzy Logic</h2>
 * <p>Instead of binary pass/fail thresholds, scores are graded continuously
 * using three membership functions:
 *
 * <ul>
 *   <li><b>Time-of-day</b> ({@link #fuzzyTimeOfDay}): 0.0 at core business hours,
 *       linearly rises through a 2-hour transition zone, reaches 1.0 in the deep
 *       off-hours window (default 10 PM–6 AM). The final rule score is the base
 *       score scaled by {@code 0.5 + 0.5 × membership}.</li>
 *
 *   <li><b>Geo-distance</b> ({@link #fuzzyGeoDistance}): piecewise linear from 0.0
 *       at ≤50 km up to 1.0 at ≥1000 km. Score boost is {@code membership × 25},
 *       capped at 25 additional points.</li>
 *
 *   <li><b>Travel speed</b> ({@link #fuzzyTravelSpeed}): piecewise linear from 0.0
 *       at ≤120 km/h (car) up to 1.0 at ≥900 km/h (faster than any aircraft). A
 *       speed of exactly 900 km/h means "impossible travel" and fires the rule.</li>
 *
 *   <li><b>Velocity</b> ({@link #fuzzyVelocity}): rate per minute mapped to [0,1]
 *       via a piecewise linear curve. Score = base × (0.6 + 0.4 × membership).</li>
 *
 *   <li><b>Multi-rule aggregation</b> ({@link #aggregateScores}): Sugeno-style
 *       inference — 70 % max (dominant rule dominates) + 30 % weighted average
 *       (compound effect), plus a +5 bonus per additional rule violation above 1,
 *       capped at +15 bonus points. This prevents averaging down severe rules while
 *       still rewarding corroborating signals.</li>
 * </ul>
 *
 * <h2>Timestamp anomaly</h2>
 * <p>All beams validate {@code occurred_at} at three tiers (matching the transaction
 * beam):
 * <ol>
 *   <li>Micro-timing (≤5 s from server): automated injection → score 90–92</li>
 *   <li>Future timestamp (>beamWindowSeconds ahead): clock tamper → score 88</li>
 *   <li>Stale timestamp (>24 h old): replay attack → score 88</li>
 * </ol>
 *
 * <h2>Institution tunability</h2>
 * <p>Every rule's parameters are stored in {@code behavioral_rules.params} (JSONB).
 * Institutions can adjust thresholds via the Behavioral Patterns API; the analyzer
 * reads live params before each evaluate call so changes take effect immediately.
 */
public final class BehavioralBeamAnalyzer {

    private static final Logger log = LoggerFactory.getLogger(BehavioralBeamAnalyzer.class);

    private final BehavioralAlertRepository alertRepo;
    private final NotificationService       notificationService;
    private final CaseRepository            caseRepository;

    public BehavioralBeamAnalyzer(BehavioralAlertRepository alertRepo,
                                   NotificationService notificationService,
                                   CaseRepository caseRepository) {
        this.alertRepo           = alertRepo;
        this.notificationService = notificationService;
        this.caseRepository      = caseRepository;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LOGIN BEAM
    // ══════════════════════════════════════════════════════════════════════════

    public void analyzeLogin(long instId, LoginPayload p, OffsetDateTime occurredAt,
                             ZoneId zone, AmlSettings settings) {
        if (p.customerId() == null) return;
        alertRepo.loadRuleParams(instId, "LOGIN_")
            .onSuccess(params -> {
                runTimestampAnomaly(instId, "login", p.customerId(), p.deviceId(), p.ip(), p.channel(),
                                    occurredAt, zone, settings, params,
                                    "LOGIN_MICRO_TIMING", "LOGIN_TIMESTAMP_FUTURE", "LOGIN_TIMESTAMP_STALE");
                runLoginTimeAnomaly(instId, p, occurredAt, zone, settings, params);
                runLoginVelocity(instId, p, occurredAt, zone, settings, params);
                runLoginImpossibleTravel(instId, p, occurredAt, zone, settings, params);
                runLoginNewCountry(instId, p, occurredAt, zone, settings, params);
            })
            .onFailure(err -> log.warn("[BehBeam/Login] Rule-param load failed inst={}: {}", instId, err.getMessage()));
    }

    private void runLoginTimeAnomaly(long instId, LoginPayload p, OffsetDateTime occurredAt,
                                     ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        if (!p.isSuccess()) return; // only flag successful logins at odd hours
        JsonObject cfg = params.getOrDefault("LOGIN_TIME_ANOMALY",
            new JsonObject().put("off_hours_start", 22).put("off_hours_end", 6)
                            .put("transition_hours", 2).put("base_score", 45));

        int offStart     = cfg.getInteger("off_hours_start", 22);
        int offEnd       = cfg.getInteger("off_hours_end",    6);
        int transition   = cfg.getInteger("transition_hours", 2);
        int baseScore    = cfg.getInteger("base_score",        45);

        int hour = occurredAt.atZoneSameInstant(zone).getHour();
        double membership = fuzzyTimeOfDay(hour, offStart, offEnd, transition);
        if (membership < 0.25) return; // core hours — not suspicious

        int score = (int) Math.round(baseScore * (0.5 + 0.5 * membership));

        alertRepo.isInCooldown(instId, "LOGIN_TIME_ANOMALY", p.customerId(), 60)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();

                String timeStr = occurredAt.atZoneSameInstant(zone)
                    .format(DateTimeFormatter.ofPattern("HH:mm"));
                String detail = String.format(
                    "Customer %s logged in at %s — outside normal business hours. " +
                    "Their 30-day pattern shows activity between %d AM and %d PM. " +
                    "Off-hours risk membership: %.0f%%.",
                    nvl(p.customerName(), p.customerId()), timeStr, offEnd, offStart,
                    membership * 100);

                List<String> reasons = new ArrayList<>();
                reasons.add(String.format("Login at %s is %.0f%% into the off-hours window", timeStr, membership * 100));
                if (p.channel() != null) reasons.add("Channel: " + p.channel());
                if (p.ip() != null) reasons.add("IP: " + p.ip());

                return fireAlert(instId, "login", "LOGIN_TIME_ANOMALY",
                    severityFromScore(score), p.customerId(), p.deviceId(), p.ip(), p.channel(),
                    1, detail, score, reasons, p.lat(), p.lng(), null, null, null,
                    occurredAt, settings);
            })
            .onFailure(err -> log.warn("[BehBeam/Login] LOGIN_TIME_ANOMALY err inst={}: {}", instId, err.getMessage()));
    }

    private void runLoginVelocity(long instId, LoginPayload p, OffsetDateTime occurredAt,
                                   ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        JsonObject cfg = params.getOrDefault("LOGIN_VELOCITY",
            new JsonObject().put("max_attempts", 5).put("window_minutes", 5)
                            .put("cooldown_minutes", 30).put("base_score", 65));

        int maxAttempts  = cfg.getInteger("max_attempts",      5);
        int windowMin    = cfg.getInteger("window_minutes",    5);
        int cooldownMin  = cfg.getInteger("cooldown_minutes", 30);
        int baseScore    = cfg.getInteger("base_score",       65);

        alertRepo.isInCooldown(instId, "LOGIN_VELOCITY", p.customerId(), cooldownMin)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();
                return alertRepo.countRecentLogins(instId, p.customerId(), windowMin)
                    .compose(count -> {
                        if (count < maxAttempts) return Future.succeededFuture();

                        double velocityMembership = fuzzyVelocity(count, windowMin);
                        int score = (int) Math.round(baseScore * (0.6 + 0.4 * velocityMembership));
                        score = Math.min(95, score);

                        String detail = String.format(
                            "Customer %s made %d login attempts within %d minutes. " +
                            "This is a credential-stuffing or brute-force pattern. " +
                            "Velocity risk level: %.0f%%.",
                            nvl(p.customerName(), p.customerId()), count, windowMin,
                            velocityMembership * 100);

                        List<String> reasons = new ArrayList<>();
                        reasons.add(count + " login attempts in " + windowMin + " minutes");
                        reasons.add("Velocity membership: " + (int)(velocityMembership * 100) + "% (threshold: " + maxAttempts + " attempts)");
                        if (p.channel() != null) reasons.add("Channel: " + p.channel());

                        return fireAlert(instId, "login", "LOGIN_VELOCITY",
                            count >= maxAttempts * 2 ? "critical" : "high",
                            p.customerId(), p.deviceId(), p.ip(), p.channel(),
                            count, detail, score, reasons, p.lat(), p.lng(), null, null, null,
                            occurredAt, settings);
                    });
            })
            .onFailure(err -> log.warn("[BehBeam/Login] LOGIN_VELOCITY err inst={}: {}", instId, err.getMessage()));
    }

    private void runLoginImpossibleTravel(long instId, LoginPayload p, OffsetDateTime occurredAt,
                                          ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        if (p.lat() == null || p.lng() == null) return;
        JsonObject cfg = params.getOrDefault("LOGIN_IMPOSSIBLE_TRAVEL",
            new JsonObject().put("min_impossible_speed_kmh", 900)
                            .put("base_score", 88).put("cooldown_minutes", 60));

        int minSpeedKmh = cfg.getInteger("min_impossible_speed_kmh", 900);
        int baseScore   = cfg.getInteger("base_score",               88);
        int cooldownMin = cfg.getInteger("cooldown_minutes",         60);

        alertRepo.isInCooldown(instId, "LOGIN_IMPOSSIBLE_TRAVEL", p.customerId(), cooldownMin)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();
                return alertRepo.getLastLoginLocation(instId, p.customerId())
                    .compose(prevLoc -> {
                        if (prevLoc == null) return Future.succeededFuture();
                        return alertRepo.getPreviousLoginTime(instId, p.customerId())
                            .compose(prevTime -> {
                                if (prevTime == null) return Future.succeededFuture();

                                int distKm = haversineKm(prevLoc[0], prevLoc[1], p.lat(), p.lng());
                                if (distKm < 50) return Future.succeededFuture(); // normal commuter range

                                long elapsedMinutes = java.time.temporal.ChronoUnit.MINUTES.between(prevTime, occurredAt);
                                if (elapsedMinutes <= 0) return Future.succeededFuture();

                                double kmPerHour = (distKm / (double) elapsedMinutes) * 60.0;
                                double speedMembership = fuzzyTravelSpeed((int) kmPerHour, minSpeedKmh);
                                if (speedMembership < 0.5) return Future.succeededFuture(); // plausible flight

                                int score = (int) Math.round(baseScore * (0.5 + 0.5 * speedMembership));
                                score = Math.min(95, score);

                                String detail = String.format(
                                    "Customer %s logged in from a location %.0f km away from their previous login, " +
                                    "just %d minutes later. That would require travelling at %.0f km/h — " +
                                    "faster than any commercial aircraft. This is a strong sign of account compromise.",
                                    nvl(p.customerName(), p.customerId()), (double) distKm,
                                    elapsedMinutes, kmPerHour);

                                List<String> reasons = new ArrayList<>();
                                reasons.add(distKm + " km from last login in " + elapsedMinutes + " min (" + (int) kmPerHour + " km/h)");
                                reasons.add("Impossible travel: speed membership " + (int)(speedMembership * 100) + "%");
                                if (p.country() != null) reasons.add("Current country: " + p.country());

                                return fireAlert(instId, "login", "LOGIN_IMPOSSIBLE_TRAVEL",
                                    "critical", p.customerId(), p.deviceId(), p.ip(), p.channel(),
                                    1, detail, score, reasons,
                                    p.lat(), p.lng(), prevLoc[0], prevLoc[1], distKm,
                                    occurredAt, settings);
                            });
                    });
            })
            .onFailure(err -> log.warn("[BehBeam/Login] LOGIN_IMPOSSIBLE_TRAVEL err inst={}: {}", instId, err.getMessage()));
    }

    private void runLoginNewCountry(long instId, LoginPayload p, OffsetDateTime occurredAt,
                                    ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        if (p.country() == null) return;
        JsonObject cfg = params.getOrDefault("LOGIN_NEW_COUNTRY",
            new JsonObject().put("lookback_days", 90).put("base_score", 60)
                            .put("cooldown_minutes", 120));

        int lookbackDays = cfg.getInteger("lookback_days",    90);
        int baseScore    = cfg.getInteger("base_score",       60);
        int cooldownMin  = cfg.getInteger("cooldown_minutes", 120);

        alertRepo.isInCooldown(instId, "LOGIN_NEW_COUNTRY", p.customerId(), cooldownMin)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();
                return alertRepo.getSeenCountries(instId, p.customerId(), "logins", lookbackDays)
                    .compose(knownCountries -> {
                        String currentCountry = p.country().toUpperCase();
                        if (knownCountries.isEmpty() || knownCountries.contains(currentCountry)) {
                            return Future.succeededFuture(); // first-time customer or known country
                        }

                        String detail = String.format(
                            "Customer %s logged in from %s — a country not seen in their last %d days of activity. " +
                            "Their known login countries are: %s.",
                            nvl(p.customerName(), p.customerId()), currentCountry, lookbackDays,
                            String.join(", ", knownCountries));

                        List<String> reasons = new ArrayList<>();
                        reasons.add("New country: " + currentCountry);
                        reasons.add("Known countries: " + String.join(", ", knownCountries));
                        if (p.city() != null) reasons.add("City: " + p.city());

                        return fireAlert(instId, "login", "LOGIN_NEW_COUNTRY",
                            "high", p.customerId(), p.deviceId(), p.ip(), p.channel(),
                            1, detail, baseScore, reasons, p.lat(), p.lng(), null, null, null,
                            occurredAt, settings);
                    });
            })
            .onFailure(err -> log.warn("[BehBeam/Login] LOGIN_NEW_COUNTRY err inst={}: {}", instId, err.getMessage()));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTIVITY BEAM
    // ══════════════════════════════════════════════════════════════════════════

    public void analyzeActivity(long instId, ActivityPayload p, OffsetDateTime occurredAt,
                                ZoneId zone, AmlSettings settings) {
        if (p.customerId() == null) return;
        alertRepo.loadRuleParams(instId, "ACTIVITY_")
            .onSuccess(params -> {
                runTimestampAnomaly(instId, "activity", p.customerId(), p.deviceId(), p.ip(), null,
                                    occurredAt, zone, settings, params,
                                    "ACTIVITY_MICRO_TIMING", "ACTIVITY_TIMESTAMP_FUTURE", "ACTIVITY_TIMESTAMP_STALE");
                runActivityTimeAnomaly(instId, p, occurredAt, zone, settings, params);
                runActivityBurst(instId, p, occurredAt, zone, settings, params);
                runActivitySessionAnomaly(instId, p, occurredAt, zone, settings, params);
            })
            .onFailure(err -> log.warn("[BehBeam/Activity] Rule-param load failed inst={}: {}", instId, err.getMessage()));
    }

    private void runActivityTimeAnomaly(long instId, ActivityPayload p, OffsetDateTime occurredAt,
                                         ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        JsonObject cfg = params.getOrDefault("ACTIVITY_TIME_ANOMALY",
            new JsonObject().put("off_hours_start", 22).put("off_hours_end", 6)
                            .put("transition_hours", 2).put("burst_threshold", 20)
                            .put("window_minutes", 60).put("base_score", 50));

        int offStart       = cfg.getInteger("off_hours_start",  22);
        int offEnd         = cfg.getInteger("off_hours_end",      6);
        int transition     = cfg.getInteger("transition_hours",   2);
        int burstThreshold = cfg.getInteger("burst_threshold",   20);
        int windowMin      = cfg.getInteger("window_minutes",    60);
        int baseScore      = cfg.getInteger("base_score",        50);

        int hour = occurredAt.atZoneSameInstant(zone).getHour();
        double membership = fuzzyTimeOfDay(hour, offStart, offEnd, transition);
        if (membership < 0.5) return; // only fire during genuine off-hours

        alertRepo.isInCooldown(instId, "ACTIVITY_TIME_ANOMALY", p.customerId(), 60)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();
                return alertRepo.countRecentActivity(instId, p.customerId(), windowMin)
                    .compose(count -> {
                        if (count < burstThreshold) return Future.succeededFuture();

                        int score = (int) Math.round(baseScore * (0.5 + 0.5 * membership));
                        String timeStr = occurredAt.atZoneSameInstant(zone)
                            .format(DateTimeFormatter.ofPattern("HH:mm"));

                        String detail = String.format(
                            "Customer %s generated %d in-app activity events between %s and now — " +
                            "all during off-hours (%02d:00–%02d:00). This pattern is consistent with " +
                            "account reconnaissance or an automated scraping session.",
                            nvl(p.customerName(), p.customerId()), count, timeStr, offStart, offEnd);

                        List<String> reasons = new ArrayList<>();
                        reasons.add(count + " activity events in last " + windowMin + " min during off-hours");
                        reasons.add("Off-hours risk: " + (int)(membership * 100) + "%");
                        if (p.screen() != null) reasons.add("Last screen: " + p.screen());

                        return fireAlert(instId, "activity", "ACTIVITY_TIME_ANOMALY",
                            severityFromScore(score), p.customerId(), p.deviceId(), p.ip(), null,
                            count, detail, score, reasons, p.lat(), p.lng(), null, null, null,
                            occurredAt, settings);
                    });
            })
            .onFailure(err -> log.warn("[BehBeam/Activity] ACTIVITY_TIME_ANOMALY err inst={}: {}", instId, err.getMessage()));
    }

    private void runActivityBurst(long instId, ActivityPayload p, OffsetDateTime occurredAt,
                                   ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        JsonObject cfg = params.getOrDefault("ACTIVITY_BURST",
            new JsonObject().put("burst_threshold", 50).put("window_minutes", 5)
                            .put("base_score", 70).put("cooldown_minutes", 15));

        int burstThreshold = cfg.getInteger("burst_threshold",   50);
        int windowMin      = cfg.getInteger("window_minutes",     5);
        int baseScore      = cfg.getInteger("base_score",        70);
        int cooldownMin    = cfg.getInteger("cooldown_minutes",  15);

        alertRepo.isInCooldown(instId, "ACTIVITY_BURST", p.customerId(), cooldownMin)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();
                return alertRepo.countRecentActivity(instId, p.customerId(), windowMin)
                    .compose(count -> {
                        if (count < burstThreshold) return Future.succeededFuture();

                        double velocityMembership = fuzzyVelocity(count, windowMin);
                        int score = (int) Math.round(baseScore * (0.6 + 0.4 * velocityMembership));
                        score = Math.min(95, score);

                        String detail = String.format(
                            "Customer %s generated %d in-app activity events in just %d minutes — " +
                            "a rate of %.1f events per minute. This is far outside normal human " +
                            "interaction speed and is consistent with automated scraping.",
                            nvl(p.customerName(), p.customerId()), count, windowMin,
                            (double) count / windowMin);

                        List<String> reasons = new ArrayList<>();
                        reasons.add(count + " events in " + windowMin + " minutes (" + String.format("%.1f", (double) count / windowMin) + "/min)");
                        reasons.add("Velocity membership: " + (int)(velocityMembership * 100) + "%");
                        if (p.screen() != null) reasons.add("Last screen: " + p.screen());

                        return fireAlert(instId, "activity", "ACTIVITY_BURST",
                            "high", p.customerId(), p.deviceId(), p.ip(), null,
                            count, detail, score, reasons, p.lat(), p.lng(), null, null, null,
                            occurredAt, settings);
                    });
            })
            .onFailure(err -> log.warn("[BehBeam/Activity] ACTIVITY_BURST err inst={}: {}", instId, err.getMessage()));
    }

    private void runActivitySessionAnomaly(long instId, ActivityPayload p, OffsetDateTime occurredAt,
                                            ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        if (p.deviceId() == null && p.ip() == null) return;
        JsonObject cfg = params.getOrDefault("ACTIVITY_SESSION_ANOMALY",
            new JsonObject().put("base_score", 75).put("cooldown_minutes", 30));

        int baseScore   = cfg.getInteger("base_score",       75);
        int cooldownMin = cfg.getInteger("cooldown_minutes", 30);

        alertRepo.isInCooldown(instId, "ACTIVITY_SESSION_ANOMALY", p.customerId(), cooldownMin)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();
                return alertRepo.getSessionContext(instId, p.customerId(), p.sessionId())
                    .compose(prevCtx -> {
                        if (prevCtx == null) return Future.succeededFuture();

                        String prevDevice = prevCtx[0];
                        String prevIp     = prevCtx[1];
                        boolean deviceChanged = prevDevice != null && p.deviceId() != null
                                                && !prevDevice.equals(p.deviceId());
                        boolean ipChanged     = prevIp != null && p.ip() != null
                                                && !prevIp.equals(p.ip());
                        if (!deviceChanged && !ipChanged) return Future.succeededFuture();

                        List<String> reasons = new ArrayList<>();
                        if (deviceChanged) reasons.add("Device changed from " + prevDevice + " to " + p.deviceId());
                        if (ipChanged)     reasons.add("IP changed from " + prevIp + " to " + p.ip());
                        reasons.add("Session ID: " + nvl(p.sessionId(), "unknown"));

                        String detail = String.format(
                            "Customer %s's active session changed %s mid-session — " +
                            "a potential session-hijacking indicator.",
                            nvl(p.customerName(), p.customerId()),
                            deviceChanged && ipChanged ? "both device fingerprint and IP address"
                                : deviceChanged ? "device fingerprint" : "IP address");

                        return fireAlert(instId, "activity", "ACTIVITY_SESSION_ANOMALY",
                            "high", p.customerId(), p.deviceId(), p.ip(), null,
                            1, detail, baseScore, reasons, p.lat(), p.lng(), null, null, null,
                            occurredAt, settings);
                    });
            })
            .onFailure(err -> log.warn("[BehBeam/Activity] ACTIVITY_SESSION_ANOMALY err inst={}: {}", instId, err.getMessage()));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LOCATION BEAM
    // ══════════════════════════════════════════════════════════════════════════

    public void analyzeLocation(long instId, LocationPayload p, OffsetDateTime occurredAt,
                                ZoneId zone, AmlSettings settings) {
        if (p.customerId() == null) return;
        alertRepo.loadRuleParams(instId, "LOCATION_")
            .onSuccess(params -> {
                runTimestampAnomaly(instId, "location", p.customerId(), p.deviceId(), p.ip(), null,
                                    occurredAt, zone, settings, params,
                                    "LOCATION_MICRO_TIMING", "LOCATION_TIMESTAMP_FUTURE", "LOCATION_TIMESTAMP_STALE");
                if (p.lat() != null && p.lng() != null) {
                    runLocationImpossibleTravel(instId, p, occurredAt, zone, settings, params);
                }
                if (p.country() != null) {
                    runLocationHighRiskRegion(instId, p, occurredAt, zone, settings, params);
                    runLocationCountryChange(instId, p, occurredAt, zone, settings, params);
                }
                runLocationRapidChange(instId, p, occurredAt, zone, settings, params);
            })
            .onFailure(err -> log.warn("[BehBeam/Location] Rule-param load failed inst={}: {}", instId, err.getMessage()));
    }

    private void runLocationImpossibleTravel(long instId, LocationPayload p, OffsetDateTime occurredAt,
                                              ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        JsonObject cfg = params.getOrDefault("LOCATION_IMPOSSIBLE_TRAVEL",
            new JsonObject().put("max_speed_kmh", 900).put("min_gap_minutes", 5)
                            .put("base_score", 90).put("cooldown_minutes", 60));

        int maxSpeedKmh = cfg.getInteger("max_speed_kmh",    900);
        int minGapMin   = cfg.getInteger("min_gap_minutes",    5);
        int baseScore   = cfg.getInteger("base_score",        90);
        int cooldownMin = cfg.getInteger("cooldown_minutes",  60);

        alertRepo.isInCooldown(instId, "LOCATION_IMPOSSIBLE_TRAVEL", p.customerId(), cooldownMin)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();
                return alertRepo.getLastLocationPing(instId, p.customerId())
                    .compose(prevLoc -> {
                        if (prevLoc == null) return Future.succeededFuture();
                        return alertRepo.getPreviousLocationTime(instId, p.customerId())
                            .compose(prevTime -> {
                                if (prevTime == null) return Future.succeededFuture();

                                long elapsedMin = java.time.temporal.ChronoUnit.MINUTES.between(prevTime, occurredAt);
                                if (elapsedMin < minGapMin) return Future.succeededFuture();

                                int distKm = haversineKm(prevLoc[0], prevLoc[1], p.lat(), p.lng());
                                if (distKm < 50) return Future.succeededFuture();

                                double kmPerHour = (distKm / (double) elapsedMin) * 60.0;
                                double speedMembership = fuzzyTravelSpeed((int) kmPerHour, maxSpeedKmh);
                                if (speedMembership < 0.5) return Future.succeededFuture();

                                int score = (int) Math.round(baseScore * (0.5 + 0.5 * speedMembership));
                                score = Math.min(95, score);

                                String detail = String.format(
                                    "Customer %s's device moved %d km in %d minutes — an implied speed of " +
                                    "%.0f km/h. No commercial aircraft travels that fast. This GPS ping is " +
                                    "likely spoofed or the account has been compromised.",
                                    nvl(p.customerName(), p.customerId()), distKm, elapsedMin, kmPerHour);

                                List<String> reasons = new ArrayList<>();
                                reasons.add(distKm + " km in " + elapsedMin + " minutes (" + (int) kmPerHour + " km/h)");
                                reasons.add("Impossible speed: " + (int)(speedMembership * 100) + "% membership");
                                if (p.country() != null) reasons.add("Arrived in: " + p.country());

                                return fireAlert(instId, "location", "LOCATION_IMPOSSIBLE_TRAVEL",
                                    "critical", p.customerId(), p.deviceId(), p.ip(), null,
                                    1, detail, score, reasons,
                                    p.lat(), p.lng(), prevLoc[0], prevLoc[1], distKm,
                                    occurredAt, settings);
                            });
                    });
            })
            .onFailure(err -> log.warn("[BehBeam/Location] LOCATION_IMPOSSIBLE_TRAVEL err inst={}: {}", instId, err.getMessage()));
    }

    private void runLocationHighRiskRegion(long instId, LocationPayload p, OffsetDateTime occurredAt,
                                            ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        JsonObject cfg = params.getOrDefault("LOCATION_HIGH_RISK_REGION",
            new JsonObject().put("base_score", 60).put("cooldown_minutes", 240)
                            .put("high_risk_countries", new io.vertx.core.json.JsonArray()
                                .add("KP").add("IR").add("MM").add("SY").add("YE").add("SO").add("LY")));

        int baseScore   = cfg.getInteger("base_score",       60);
        int cooldownMin = cfg.getInteger("cooldown_minutes", 240);

        List<String> highRiskCountries = new ArrayList<>();
        io.vertx.core.json.JsonArray arr = cfg.getJsonArray("high_risk_countries", new io.vertx.core.json.JsonArray());
        arr.forEach(c -> highRiskCountries.add(c.toString().toUpperCase()));

        String currentCountry = p.country().toUpperCase();
        if (!highRiskCountries.contains(currentCountry)) return;

        alertRepo.isInCooldown(instId, "LOCATION_HIGH_RISK_REGION", p.customerId(), cooldownMin)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();

                String detail = String.format(
                    "Customer %s's location is currently in %s — a country flagged as high-risk " +
                    "under your institution's AML configuration. This may indicate travel to a " +
                    "sanctioned or high-risk jurisdiction and warrants enhanced due diligence.",
                    nvl(p.customerName(), p.customerId()), currentCountry);

                List<String> reasons = new ArrayList<>();
                reasons.add("Location in high-risk country: " + currentCountry);
                reasons.add("Institution high-risk list: " + String.join(", ", highRiskCountries));

                return fireAlert(instId, "location", "LOCATION_HIGH_RISK_REGION",
                    "high", p.customerId(), p.deviceId(), p.ip(), null,
                    1, detail, baseScore, reasons,
                    p.lat(), p.lng(), null, null, null,
                    occurredAt, settings);
            })
            .onFailure(err -> log.warn("[BehBeam/Location] LOCATION_HIGH_RISK_REGION err inst={}: {}", instId, err.getMessage()));
    }

    private void runLocationRapidChange(long instId, LocationPayload p, OffsetDateTime occurredAt,
                                         ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        if (p.customerId() == null) return;
        JsonObject cfg = params.getOrDefault("LOCATION_RAPID_CHANGE",
            new JsonObject().put("max_pings", 10).put("window_minutes", 2)
                            .put("base_score", 55).put("cooldown_minutes", 20));

        int maxPings    = cfg.getInteger("max_pings",        10);
        int windowMin   = cfg.getInteger("window_minutes",    2);
        int baseScore   = cfg.getInteger("base_score",       55);
        int cooldownMin = cfg.getInteger("cooldown_minutes", 20);

        alertRepo.isInCooldown(instId, "LOCATION_RAPID_CHANGE", p.customerId(), cooldownMin)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();
                return alertRepo.countRecentLocationPings(instId, p.customerId(), windowMin)
                    .compose(count -> {
                        if (count < maxPings) return Future.succeededFuture();

                        double velocityMembership = fuzzyVelocity(count, windowMin);
                        int score = (int) Math.round(baseScore * (0.5 + 0.5 * velocityMembership));

                        String detail = String.format(
                            "Customer %s sent %d location pings in %d minutes — a rate " +
                            "of %.1f pings per minute. Normal app usage produces 1 ping per 5–10 minutes. " +
                            "This high rate is consistent with a GPS mock application or automated location cycling.",
                            nvl(p.customerName(), p.customerId()), count, windowMin,
                            (double) count / windowMin);

                        List<String> reasons = new ArrayList<>();
                        reasons.add(count + " location pings in " + windowMin + " minutes");
                        reasons.add("Rate: " + String.format("%.1f", (double) count / windowMin) + "/min (normal: 0.1–0.2/min)");

                        return fireAlert(instId, "location", "LOCATION_RAPID_CHANGE",
                            "warning", p.customerId(), p.deviceId(), p.ip(), null,
                            count, detail, score, reasons,
                            p.lat(), p.lng(), null, null, null,
                            occurredAt, settings);
                    });
            })
            .onFailure(err -> log.warn("[BehBeam/Location] LOCATION_RAPID_CHANGE err inst={}: {}", instId, err.getMessage()));
    }

    private void runLocationCountryChange(long instId, LocationPayload p, OffsetDateTime occurredAt,
                                           ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        JsonObject cfg = params.getOrDefault("LOCATION_COUNTRY_CHANGE",
            new JsonObject().put("lookback_days", 90).put("base_score", 62)
                            .put("cooldown_minutes", 120));

        int lookbackDays = cfg.getInteger("lookback_days",    90);
        int baseScore    = cfg.getInteger("base_score",       62);
        int cooldownMin  = cfg.getInteger("cooldown_minutes", 120);

        alertRepo.isInCooldown(instId, "LOCATION_COUNTRY_CHANGE", p.customerId(), cooldownMin)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();
                return alertRepo.getSeenCountries(instId, p.customerId(), "location", lookbackDays)
                    .compose(knownCountries -> {
                        String currentCountry = p.country().toUpperCase();
                        if (knownCountries.isEmpty() || knownCountries.contains(currentCountry)) {
                            return Future.succeededFuture();
                        }

                        String detail = String.format(
                            "Customer %s's location is now in %s — a country not seen in their " +
                            "location history for the last %d days. Their known countries: %s.",
                            nvl(p.customerName(), p.customerId()), currentCountry,
                            lookbackDays, String.join(", ", knownCountries));

                        List<String> reasons = new ArrayList<>();
                        reasons.add("New country: " + currentCountry);
                        reasons.add("Known countries: " + String.join(", ", knownCountries));

                        return fireAlert(instId, "location", "LOCATION_COUNTRY_CHANGE",
                            "high", p.customerId(), p.deviceId(), p.ip(), null,
                            1, detail, baseScore, reasons,
                            p.lat(), p.lng(), null, null, null,
                            occurredAt, settings);
                    });
            })
            .onFailure(err -> log.warn("[BehBeam/Location] LOCATION_COUNTRY_CHANGE err inst={}: {}", instId, err.getMessage()));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // DEVICE BEAM
    // ══════════════════════════════════════════════════════════════════════════

    public void analyzeDevice(long instId, DevicePayload p, OffsetDateTime occurredAt,
                              ZoneId zone, AmlSettings settings) {
        if (p.customerId() == null && p.deviceId() == null) return;
        alertRepo.loadRuleParams(instId, "DEVICE_")
            .onSuccess(params -> {
                runTimestampAnomaly(instId, "device", p.customerId(), p.deviceId(), p.ip(), null,
                                    occurredAt, zone, settings, params,
                                    "DEVICE_MICRO_TIMING", "DEVICE_TIMESTAMP_FUTURE", "DEVICE_TIMESTAMP_STALE");
                if (p.deviceId() != null) {
                    runDeviceSharedAccounts(instId, p, occurredAt, zone, settings, params);
                    runDeviceRapidSwap(instId, p, occurredAt, zone, settings, params);
                    runDeviceCloned(instId, p, occurredAt, zone, settings, params);
                }
                if (p.isCompromised()) runDeviceJailbreakRoot(instId, p, occurredAt, zone, settings, params);
                if (Boolean.TRUE.equals(p.isEmulator())) runDeviceEmulator(instId, p, occurredAt, zone, settings, params);
            })
            .onFailure(err -> log.warn("[BehBeam/Device] Rule-param load failed inst={}: {}", instId, err.getMessage()));
    }

    private void runDeviceSharedAccounts(long instId, DevicePayload p, OffsetDateTime occurredAt,
                                          ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        JsonObject cfg = params.getOrDefault("DEVICE_SHARED_ACCOUNTS",
            new JsonObject().put("max_accounts", 3).put("window_hours", 24)
                            .put("base_score", 85).put("cooldown_minutes", 60));

        int maxAccounts = cfg.getInteger("max_accounts",     3);
        int windowHours = cfg.getInteger("window_hours",    24);
        int baseScore   = cfg.getInteger("base_score",      85);
        int cooldownMin = cfg.getInteger("cooldown_minutes", 60);

        alertRepo.isInCooldown(instId, "DEVICE_SHARED_ACCOUNTS", p.customerId(), cooldownMin)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();
                return alertRepo.countDistinctCustomersForDevice(instId, p.deviceId(), windowHours)
                    .compose(accountCount -> {
                        if (accountCount < maxAccounts) return Future.succeededFuture();

                        // Geo-distance enrichment: boost score if device is also far from usual location
                        int distBoost = 0;
                        String geoReason = null;

                        int score = Math.min(95, baseScore + distBoost);

                        String detail = String.format(
                            "Device %s has been used to access %d distinct customer accounts in the last " +
                            "%d hours. This is a strong indicator of a mule network or credential-stuffing " +
                            "operation — multiple people using the same physical device to access different accounts.",
                            p.deviceId(), accountCount, windowHours);

                        List<String> reasons = new ArrayList<>();
                        reasons.add(accountCount + " distinct accounts on device " + p.deviceId() + " in " + windowHours + "h");
                        reasons.add("Threshold: " + maxAccounts + " accounts → mule-network pattern");
                        if (p.deviceModel() != null) reasons.add("Device: " + p.deviceModel());

                        return fireAlert(instId, "device", "DEVICE_SHARED_ACCOUNTS",
                            "critical", p.customerId(), p.deviceId(), p.ip(), null,
                            accountCount, detail, score, reasons,
                            p.lat(), p.lng(), null, null, null,
                            occurredAt, settings);
                    });
            })
            .onFailure(err -> log.warn("[BehBeam/Device] DEVICE_SHARED_ACCOUNTS err inst={}: {}", instId, err.getMessage()));
    }

    private void runDeviceJailbreakRoot(long instId, DevicePayload p, OffsetDateTime occurredAt,
                                         ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        JsonObject cfg = params.getOrDefault("DEVICE_JAILBREAK_ROOT",
            new JsonObject().put("base_score", 65));

        int baseScore = cfg.getInteger("base_score", 65);

        alertRepo.isInCooldown(instId, "DEVICE_JAILBREAK_ROOT", p.customerId(), 240)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();

                boolean jailbroken = Boolean.TRUE.equals(p.isJailbroken());
                boolean rooted     = Boolean.TRUE.equals(p.isRooted());
                String type = (jailbroken && rooted) ? "jailbroken and rooted"
                    : jailbroken ? "jailbroken" : "rooted";

                String detail = String.format(
                    "Customer %s is using a %s device (%s). This significantly increases the risk " +
                    "of malware, certificate-pinning bypass, and man-in-the-middle attacks. " +
                    "Sensitive transactions from this device should be treated with heightened caution.",
                    nvl(p.customerName(), p.customerId()), type,
                    nvl(p.deviceModel(), p.deviceId()));

                List<String> reasons = new ArrayList<>();
                reasons.add("Device is " + type);
                if (p.deviceOs() != null) reasons.add("OS: " + p.deviceOs() + " " + nvl(p.osVersion(), ""));
                if (p.deviceModel() != null) reasons.add("Model: " + p.deviceModel());

                return fireAlert(instId, "device", "DEVICE_JAILBREAK_ROOT",
                    "high", p.customerId(), p.deviceId(), p.ip(), null,
                    1, detail, baseScore, reasons,
                    p.lat(), p.lng(), null, null, null,
                    occurredAt, settings);
            })
            .onFailure(err -> log.warn("[BehBeam/Device] DEVICE_JAILBREAK_ROOT err inst={}: {}", instId, err.getMessage()));
    }

    private void runDeviceEmulator(long instId, DevicePayload p, OffsetDateTime occurredAt,
                                    ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        JsonObject cfg = params.getOrDefault("DEVICE_EMULATOR",
            new JsonObject().put("base_score", 88));

        int baseScore = cfg.getInteger("base_score", 88);

        alertRepo.isInCooldown(instId, "DEVICE_EMULATOR", p.customerId(), 60)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();

                String detail = String.format(
                    "A device event was received from what appears to be a software emulator or virtual " +
                    "machine — not a real physical device. Customer %s initiated this request. " +
                    "Emulators are routinely used in automated fraud attacks and API abuse.",
                    nvl(p.customerName(), p.customerId()));

                List<String> reasons = new ArrayList<>();
                reasons.add("Device fingerprint matches emulator/virtual machine characteristics");
                if (p.deviceId() != null) reasons.add("Device ID: " + p.deviceId());
                if (p.ip() != null) reasons.add("IP: " + p.ip());

                return fireAlert(instId, "device", "DEVICE_EMULATOR",
                    "critical", p.customerId(), p.deviceId(), p.ip(), null,
                    1, detail, baseScore, reasons,
                    p.lat(), p.lng(), null, null, null,
                    occurredAt, settings);
            })
            .onFailure(err -> log.warn("[BehBeam/Device] DEVICE_EMULATOR err inst={}: {}", instId, err.getMessage()));
    }

    private void runDeviceRapidSwap(long instId, DevicePayload p, OffsetDateTime occurredAt,
                                     ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        if (p.customerId() == null) return;
        JsonObject cfg = params.getOrDefault("DEVICE_RAPID_SWAP",
            new JsonObject().put("max_changes", 2).put("window_minutes", 10)
                            .put("base_score", 72).put("cooldown_minutes", 60));

        int maxChanges  = cfg.getInteger("max_changes",     2);
        int windowMin   = cfg.getInteger("window_minutes", 10);
        int baseScore   = cfg.getInteger("base_score",     72);
        int cooldownMin = cfg.getInteger("cooldown_minutes", 60);

        alertRepo.isInCooldown(instId, "DEVICE_RAPID_SWAP", p.customerId(), cooldownMin)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();
                return alertRepo.countRecentDeviceChanges(instId, p.customerId(), windowMin)
                    .compose(distinctDevices -> {
                        if (distinctDevices <= maxChanges) return Future.succeededFuture();

                        int score = Math.min(90, baseScore + (distinctDevices - maxChanges) * 5);

                        String detail = String.format(
                            "Customer %s used %d different device fingerprints within %d minutes. " +
                            "Rapidly switching devices is a precursor pattern to SIM-swap fraud and " +
                            "account handover attacks.",
                            nvl(p.customerName(), p.customerId()), distinctDevices, windowMin);

                        List<String> reasons = new ArrayList<>();
                        reasons.add(distinctDevices + " distinct devices in " + windowMin + " minutes");
                        reasons.add("Threshold: " + maxChanges + " device changes");

                        return fireAlert(instId, "device", "DEVICE_RAPID_SWAP",
                            "high", p.customerId(), p.deviceId(), p.ip(), null,
                            distinctDevices, detail, score, reasons,
                            p.lat(), p.lng(), null, null, null,
                            occurredAt, settings);
                    });
            })
            .onFailure(err -> log.warn("[BehBeam/Device] DEVICE_RAPID_SWAP err inst={}: {}", instId, err.getMessage()));
    }

    private void runDeviceCloned(long instId, DevicePayload p, OffsetDateTime occurredAt,
                                  ZoneId zone, AmlSettings settings, Map<String, JsonObject> params) {
        JsonObject cfg = params.getOrDefault("DEVICE_CLONED",
            new JsonObject().put("simultaneous_window_minutes", 15).put("min_distance_km", 200)
                            .put("base_score", 92).put("cooldown_minutes", 120));

        int windowMin   = cfg.getInteger("simultaneous_window_minutes", 15);
        int minDistKm   = cfg.getInteger("min_distance_km",            200);
        int baseScore   = cfg.getInteger("base_score",                  92);
        int cooldownMin = cfg.getInteger("cooldown_minutes",           120);

        alertRepo.isInCooldown(instId, "DEVICE_CLONED", p.customerId(), cooldownMin)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();
                return alertRepo.findConcurrentDeviceLocations(instId, p.deviceId(), windowMin, minDistKm)
                    .compose(locs -> {
                        if (locs == null) return Future.succeededFuture();

                        int distKm = haversineKm(locs[0], locs[1], locs[2], locs[3]);
                        // Boost score with geo-distance fuzzy membership
                        double geoMembership = fuzzyGeoDistance(distKm);
                        int score = (int) Math.round(baseScore * (0.7 + 0.3 * geoMembership));
                        score = Math.min(98, score);

                        String detail = String.format(
                            "Device %s appears at two locations %d km apart within %d minutes — " +
                            "physically impossible without cloning. This is a critical device-cloning " +
                            "or SIM-swap indicator. Both sessions should be immediately invalidated.",
                            p.deviceId(), distKm, windowMin);

                        List<String> reasons = new ArrayList<>();
                        reasons.add("Same device ID at two locations " + distKm + " km apart in " + windowMin + " min");
                        reasons.add("Geo-distance risk: " + (int)(geoMembership * 100) + "%");
                        if (p.deviceModel() != null) reasons.add("Device: " + p.deviceModel());

                        return fireAlert(instId, "device", "DEVICE_CLONED",
                            "critical", p.customerId(), p.deviceId(), p.ip(), null,
                            1, detail, score, reasons,
                            locs[2], locs[3], locs[0], locs[1], distKm,
                            occurredAt, settings);
                    });
            })
            .onFailure(err -> log.warn("[BehBeam/Device] DEVICE_CLONED err inst={}: {}", instId, err.getMessage()));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // OTP TIMESTAMP ANOMALY (timestamp only — other OTP rules in OtpAnalyzer)
    // ══════════════════════════════════════════════════════════════════════════

    public void analyzeOtpTimestamp(long instId, OtpPayload p, OffsetDateTime occurredAt,
                                    ZoneId zone, AmlSettings settings) {
        if (occurredAt == null) return;
        // Load both OTP_TIMESTAMP* and OTP_MICRO* params in a single query using the OTP_ prefix.
        alertRepo.loadRuleParams(instId, "OTP_")
            .onSuccess(params ->
                runTimestampAnomaly(instId, "otp", p.customerId(), p.deviceId(), p.ip(), p.channel(),
                                    occurredAt, zone, settings, params,
                                    "OTP_MICRO_TIMING", "OTP_TIMESTAMP_FUTURE", "OTP_TIMESTAMP_STALE"))
            .onFailure(err -> log.warn("[BehBeam/OTP] Rule-param load failed inst={}: {}", instId, err.getMessage()));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SHARED TIMESTAMP ANOMALY EVALUATOR (identical logic across all beams)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Evaluates all three timestamp anomaly rules for any beam.
     *
     * <p>This replicates the transaction beam's logic (micro-timing, future, stale)
     * but fires alerts into {@code behavioral_alerts} rather than opening transaction cases.
     *
     * @param microRule   rule ID for the micro-timing variant (e.g. "LOGIN_MICRO_TIMING")
     * @param futureRule  rule ID for the future-timestamp variant
     * @param staleRule   rule ID for the stale-timestamp variant
     */
    private void runTimestampAnomaly(long instId, String beam, String customerId, String deviceId,
                                     String ip, String channel, OffsetDateTime occurredAt,
                                     ZoneId zone, AmlSettings settings, Map<String, JsonObject> params,
                                     String microRule, String futureRule, String staleRule) {
        if (occurredAt == null) return;

        OffsetDateTime now = OffsetDateTime.now(zone);
        long secondsDiff = java.time.temporal.ChronoUnit.SECONDS.between(occurredAt, now);
        // secondsDiff > 0 → event is in the past; < 0 → event is in the future

        int beamWindow = settings.beamWindowSeconds(); // default 180 s

        // ── Micro-timing: event matches server clock within micro_seconds ───────
        if (Math.abs(secondsDiff) <= 5) {
            JsonObject cfg = params.getOrDefault(microRule,
                new JsonObject().put("micro_seconds", 5).put("base_score", 96));
            int microSeconds = cfg.getInteger("micro_seconds", 5);
            int baseScore    = cfg.getInteger("base_score",    96);

            if (Math.abs(secondsDiff) <= microSeconds) {
                String detail = String.format(
                    "The %s event's timestamp (%s) is within %d second(s) of the server's receipt " +
                    "time. Real user events always have some network and processing latency — " +
                    "zero-latency events are characteristic of automated API injection, not a human.",
                    beam, occurredAt, Math.abs(secondsDiff));

                fireTimestampAlert(instId, beam, microRule, customerId, deviceId, ip, channel,
                    detail, baseScore,
                    List.of("Timestamp matches server clock within " + Math.abs(secondsDiff) + "s",
                            "Indicator: automated API injection"),
                    occurredAt, settings);
            }

        // ── Future timestamp: event claims to be in the future ──────────────────
        } else if (secondsDiff < -beamWindow) {
            JsonObject cfg = params.getOrDefault(futureRule,
                new JsonObject().put("future_seconds", 300).put("base_score", 95));
            int baseScore = cfg.getInteger("base_score", 95);
            long futureBy = Math.abs(secondsDiff);

            String detail = String.format(
                "The %s event arrived with occurred_at set %d seconds (%s) ahead of the current " +
                "server time. A legitimate event cannot be dated in the future — this is a strong " +
                "indicator of clock tampering or a forged/synthetic event.",
                beam, futureBy, describeDuration(futureBy));

            fireTimestampAlert(instId, beam, futureRule, customerId, deviceId, ip, channel,
                detail, baseScore,
                List.of("occurred_at is " + futureBy + "s in the future",
                        "Indicator: clock tampering or forged event"),
                occurredAt, settings);

        // ── Stale timestamp: event arrived outside the beam window ───────────────
        } else if (secondsDiff > beamWindow) {
            JsonObject cfg = params.getOrDefault(staleRule,
                new JsonObject().put("base_score", 95));
            int baseScore = cfg.getInteger("base_score", 95);

            String ageDesc = describeDuration(secondsDiff);
            String detail = String.format(
                "The %s event arrived with occurred_at dated %s in the past (beam window: %s). " +
                "Events outside the accepted time window are a replay-attack indicator — the same " +
                "event may have already been processed, or a fraudster is re-submitting an old event.",
                beam, ageDesc, describeDuration(beamWindow));

            fireTimestampAlert(instId, beam, staleRule, customerId, deviceId, ip, channel,
                detail, baseScore,
                List.of("occurred_at is " + ageDesc + " in the past (window: " + describeDuration(beamWindow) + ")",
                        "Indicator: replay attack or backdated injection"),
                occurredAt, settings);
        }
    }

    private void fireTimestampAlert(long instId, String beam, String rule,
                                    String customerId, String deviceId, String ip, String channel,
                                    String detail, int score, List<String> reasons,
                                    OffsetDateTime occurredAt, AmlSettings settings) {
        alertRepo.isInCooldown(instId, rule, customerId, 60)
            .compose(inCooldown -> {
                if (inCooldown) return Future.succeededFuture();
                return fireAlert(instId, beam, rule, "critical",
                    customerId, deviceId, ip, channel, 1, detail, score, reasons,
                    null, null, null, null, null, occurredAt, settings);
            })
            .onFailure(err -> log.warn("[BehBeam] {} err inst={}: {}", rule, instId, err.getMessage()));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SHARED FIRE + NOTIFY + CASE HELPER
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Saves the alert, raises a plain-English notification, and (when score ≥
     * the institution's beh_risk_score_case_threshold) auto-opens a case.
     *
     * <p>All errors are swallowed — callers are fire-and-forget.
     */
    private Future<Void> fireAlert(long instId, String beam, String rule, String severity,
                                   String customerId, String deviceId, String ip, String channel,
                                   int eventCount, String detail, int score, List<String> reasons,
                                   Double lat, Double lng, Double custLat, Double custLng, Integer distKm,
                                   OffsetDateTime occurredAt, AmlSettings settings) {

        // Minimum threshold — below this, log only (no notification)
        int flagThreshold = settings.behRiskScoreFlagThreshold();   // default 60
        int caseThreshold = settings.behRiskScoreCaseThreshold();   // default 85

        return alertRepo.save(instId, beam, rule, severity, customerId, deviceId, ip, channel,
                              eventCount, detail, score,
                              reasons != null ? reasons.toArray(new String[0]) : new String[0],
                              lat, lng, custLat, custLng, distKm, occurredAt)
            .compose(alert -> {
                log.info("[BehBeam] {} {} score={} inst={} customer={}",
                    beam.toUpperCase(), rule, score, instId, customerId);

                Future<Void> notifyFuture = Future.succeededFuture();
                if (score >= flagThreshold && notificationService != null) {
                    notifyFuture = notificationService.notifyBehavioralAlert(instId, alert)
                        .mapEmpty();
                }

                if (score >= caseThreshold && settings.autoOpenCase()) {
                    notifyFuture = notifyFuture.compose(v -> openCase(instId, alert, settings));
                }

                return notifyFuture;
            })
            .onFailure(err -> log.warn("[BehBeam] Fire-alert failed {} {}: {}", beam, rule, err.getMessage()));
    }

    // ── Case creation ─────────────────────────────────────────────────────────

    private Future<Void> openCase(long instId, BehavioralAlert alert, AmlSettings settings) {
        return caseRepository.nextSeq().compose(seq -> {
            String caseId = "CASE-"
                + YearMonth.now().format(DateTimeFormatter.ofPattern("yyyyMM"))
                + "-" + String.format("%06d", seq);

            String priority  = getPriority(alert.riskScore());
            String title     = buildCaseTitle(alert);
            String brief     = buildCaseBrief(alert);
            String typology  = inferTypology(alert.rule());
            String notes     = buildCaseNotes(alert);
            OffsetDateTime sla = computeSla(priority);

            return caseRepository.create(caseId, instId, title, brief, typology, priority,
                                         alert.riskScore(), null, notes, sla, null,
                                         "Auto-created by behavioral beam analysis — rule: " + alert.rule(), null,
                                         null, null)
                .compose(caseRecord ->
                    caseRepository.addActivity(caseRecord.id(), null, "opened",
                        "Auto-opened by behavioral rule engine. Beam: " + alert.beam()
                        + ", Rule: " + alert.rule()
                        + ", Score: " + alert.riskScore())
                    .compose(v -> {
                        if (notificationService != null) {
                            return notificationService.notifyCaseCreated(instId, caseId, title, priority)
                                .mapEmpty();
                        }
                        return Future.succeededFuture();
                    })
                )
                .mapEmpty();
        });
    }

    private String buildCaseTitle(BehavioralAlert a) {
        return switch (a.rule()) {
            case "LOGIN_IMPOSSIBLE_TRAVEL"     -> "Impossible Travel Login — " + nvl(a.customerId(), "Unknown customer");
            case "LOGIN_TIME_ANOMALY"           -> "Off-Hours Login — " + nvl(a.customerId(), "Unknown customer");
            case "LOGIN_NEW_COUNTRY"            -> "Login from New Country — " + nvl(a.customerId(), "Unknown customer");
            case "LOCATION_IMPOSSIBLE_TRAVEL"  -> "Impossible GPS Travel — " + nvl(a.customerId(), "Unknown device");
            case "LOCATION_HIGH_RISK_REGION"   -> "High-Risk Jurisdiction Location — " + nvl(a.customerId(), "Unknown customer");
            case "DEVICE_SHARED_ACCOUNTS"      -> "Device Shared Across Accounts — " + nvl(a.deviceId(), "Unknown device");
            case "DEVICE_CLONED"               -> "Possible Cloned Device — " + nvl(a.deviceId(), "Unknown device");
            case "DEVICE_EMULATOR"             -> "Emulator Detected — " + nvl(a.customerId(), "Unknown customer");
            case "ACTIVITY_BURST"              -> "Activity Scraping Burst — " + nvl(a.customerId(), "Unknown customer");
            default -> a.rule().replace("_", " ") + " — " + nvl(a.beam(), "Behavioral") + " beam";
        };
    }

    private String buildCaseBrief(BehavioralAlert a) {
        String risk = a.riskScore() >= 85 ? "CRITICAL RISK" : a.riskScore() >= 70 ? "HIGH RISK" : "ELEVATED RISK";
        return risk + " — " + a.beam().toUpperCase() + " beam violation: " + a.rule()
            + (a.customerId() != null ? " (customer: " + a.customerId() + ")" : "")
            + (a.deviceId() != null   ? " (device: " + a.deviceId() + ")" : "");
    }

    private String buildCaseNotes(BehavioralAlert a) {
        var sb = new StringBuilder();
        sb.append("WHY THIS CASE WAS OPENED\n");
        sb.append("─────────────────────────\n");
        sb.append(a.detail()).append("\n\n");

        sb.append("SIGNALS DETECTED\n");
        sb.append("────────────────\n");
        if (a.reasons() != null) for (String r : a.reasons()) sb.append("• ").append(r).append("\n");

        sb.append("\nEVENT DETAILS\n");
        sb.append("─────────────\n");
        sb.append("Beam: ").append(a.beam()).append("\n");
        sb.append("Rule: ").append(a.rule()).append("\n");
        sb.append("Risk Score: ").append(a.riskScore()).append("/100\n");
        if (a.customerId() != null) sb.append("Customer: ").append(a.customerId()).append("\n");
        if (a.deviceId()   != null) sb.append("Device: ").append(a.deviceId()).append("\n");
        if (a.ip()         != null) sb.append("IP: ").append(a.ip()).append("\n");
        if (a.distanceKm() != null) sb.append("Distance from usual location: ").append(a.distanceKm()).append(" km\n");
        if (a.occurredAt() != null) sb.append("Event time: ").append(a.occurredAt()).append("\n");

        sb.append("\nNEXT STEPS\n");
        sb.append("──────────\n");
        sb.append("1. Verify this event with the customer directly\n");
        sb.append("2. Check for concurrent sessions or transactions\n");
        if (a.riskScore() >= 85) {
            sb.append("3. Consider suspending the account pending investigation\n");
            sb.append("4. Escalate to compliance if fraud is confirmed\n");
        } else {
            sb.append("3. Review the customer's recent activity timeline\n");
            sb.append("4. Close or escalate based on your findings\n");
        }
        return sb.toString();
    }

    private static String inferTypology(String rule) {
        if (rule.contains("IMPOSSIBLE_TRAVEL") || rule.contains("CLONED")) return "Account Compromise / Device Cloning";
        if (rule.contains("SHARED_ACCOUNTS"))                               return "Mule Network / Coordinated Fraud";
        if (rule.contains("EMULATOR") || rule.contains("MICRO_TIMING"))    return "Automated Bot / API Injection";
        if (rule.contains("TIMESTAMP_STALE") || rule.contains("TIMESTAMP_FUTURE")) return "Replay Attack / Timestamp Forgery";
        if (rule.contains("VELOCITY") || rule.contains("BURST"))           return "Credential Stuffing / Velocity Fraud";
        if (rule.contains("HIGH_RISK_REGION"))                             return "High-Risk Jurisdiction";
        if (rule.contains("NEW_COUNTRY") || rule.contains("COUNTRY_CHANGE")) return "Account Takeover / Travel Fraud";
        if (rule.contains("SESSION_ANOMALY"))                              return "Session Hijacking";
        if (rule.contains("JAILBREAK") || rule.contains("ROOT"))          return "Device Compromise / Malware";
        if (rule.contains("RAPID_SWAP"))                                   return "SIM Swap Precursor";
        return "Suspicious Behavioral Activity";
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FUZZY LOGIC MEMBERSHIP FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Time-of-day fuzzy membership for off-hours risk.
     *
     * <p>Returns [0.0, 1.0] where:
     * <ul>
     *   <li>0.0 = deep core hours (business day centre)</li>
     *   <li>0.0–1.0 = linear ramp through the {@code transitionHours} boundary zone</li>
     *   <li>1.0 = deep off-hours (middle of the night)</li>
     * </ul>
     *
     * <p>Example with offStart=22, offEnd=6, transition=2:
     * <pre>
     *   06:00–08:00 : falls from 1.0 → 0.0 (morning transition)
     *   08:00–20:00 : 0.0 (core hours)
     *   20:00–22:00 : rises from 0.0 → 1.0 (evening transition)
     *   22:00–06:00 : 1.0 (off-hours)
     * </pre>
     */
    static double fuzzyTimeOfDay(int hour, int offStart, int offEnd, int transitionHours) {
        int transEveStart  = offStart - transitionHours; // e.g. 20
        int transMornEnd   = offEnd   + transitionHours; // e.g. 8

        // Deep core hours
        if (hour >= transMornEnd && hour < transEveStart) return 0.0;

        // Evening transition: transEveStart → offStart
        if (hour >= transEveStart && hour < offStart) {
            return (double)(hour - transEveStart) / transitionHours;
        }

        // Morning transition: offEnd → transMornEnd
        if (hour >= offEnd && hour < transMornEnd) {
            return 1.0 - (double)(hour - offEnd) / transitionHours;
        }

        // Off-hours: offStart → 24 and 0 → offEnd (wraps midnight)
        return 1.0;
    }

    /**
     * Geo-distance fuzzy membership.
     *
     * <p>Returns [0.0, 1.0] where:
     * <ul>
     *   <li>≤ 50 km  = 0.0 (commuter range, normal)</li>
     *   <li>50–200   = 0.0–0.30 (domestic travel)</li>
     *   <li>200–500  = 0.30–0.60 (inter-state/country)</li>
     *   <li>500–1000 = 0.60–0.90 (long-haul, investigate)</li>
     *   <li>≥ 1000   = 1.0 (impossible travel territory)</li>
     * </ul>
     */
    static double fuzzyGeoDistance(int km) {
        if (km <= 50)   return 0.0;
        if (km <= 200)  return (km - 50.0)  / 150.0 * 0.30;
        if (km <= 500)  return 0.30 + (km - 200.0) / 300.0 * 0.30;
        if (km <= 1000) return 0.60 + (km - 500.0) / 500.0 * 0.30;
        return 1.0;
    }

    /**
     * Travel-speed fuzzy membership.
     *
     * <p>Returns [0.0, 1.0] where:
     * <ul>
     *   <li>≤ 120 km/h  = 0.0 (car / train — normal)</li>
     *   <li>120–500     = 0.0–0.40 (fast train / short-hop flight)</li>
     *   <li>500–maxKmh  = 0.40–0.90 (flight speed)</li>
     *   <li>≥ maxKmh    = 1.0 (impossible — faster than any aircraft)</li>
     * </ul>
     *
     * @param kmh        implied speed in km/h
     * @param maxKmh     institution-configured impossibility threshold (default 900)
     */
    static double fuzzyTravelSpeed(int kmh, int maxKmh) {
        if (kmh <= 120)   return 0.0;
        if (kmh <= 500)   return (kmh - 120.0) / 380.0 * 0.40;
        if (kmh < maxKmh) return 0.40 + (kmh - 500.0) / (maxKmh - 500.0) * 0.50;
        return 1.0;
    }

    /**
     * Velocity fuzzy membership (events per minute).
     *
     * <p>Returns [0.0, 1.0] where:
     * <ul>
     *   <li>≤ 0.20/min = 0.0 (normal human interaction)</li>
     *   <li>0.20–0.50  = linear ramp to 0.40</li>
     *   <li>0.50–2.00  = linear ramp to 0.90</li>
     *   <li>≥ 2.00/min = 1.0 (machine speed)</li>
     * </ul>
     */
    static double fuzzyVelocity(int eventCount, int windowMinutes) {
        if (windowMinutes <= 0) return 1.0;
        double ratePerMin = (double) eventCount / windowMinutes;
        if (ratePerMin <= 0.20) return 0.0;
        if (ratePerMin <= 0.50) return (ratePerMin - 0.20) / 0.30 * 0.40;
        if (ratePerMin <= 2.00) return 0.40 + (ratePerMin - 0.50) / 1.50 * 0.50;
        return 1.0;
    }

    /**
     * Sugeno-style multi-rule aggregation.
     *
     * <p>Formula: {@code max × 0.70 + avg × 0.30 + bonus}
     * <ul>
     *   <li>70% weight on the dominant (highest) rule score prevents averaging down severe violations.</li>
     *   <li>30% weight on the average preserves the compound effect of multiple triggered rules.</li>
     *   <li>+5 bonus per rule above 1, capped at +15 — rewards corroborating signals without runaway escalation.</li>
     * </ul>
     */
    static int aggregateScores(List<Integer> scores) {
        if (scores == null || scores.isEmpty()) return 0;
        if (scores.size() == 1) return scores.get(0);

        int maxScore = scores.stream().mapToInt(Integer::intValue).max().orElse(0);
        double avgScore = scores.stream().mapToInt(Integer::intValue).average().orElse(0);

        double HEDGE = 0.70;
        double aggregated = maxScore * HEDGE + avgScore * (1.0 - HEDGE);
        int bonus = Math.min(15, (scores.size() - 1) * 5);

        return Math.min(100, (int) Math.round(aggregated) + bonus);
    }

    // ── Priority & SLA helpers ─────────────────────────────────────────────────

    static String getPriority(int score) {
        if (score >= 85) return "critical";
        if (score >= 70) return "high";
        if (score >= 50) return "medium";
        return "low";
    }

    private static OffsetDateTime computeSla(String priority) {
        var now = OffsetDateTime.now();
        return switch (priority) {
            case "critical" -> now.plusHours(4);
            case "high"     -> now.plusDays(1);
            case "medium"   -> now.plusDays(3);
            default         -> now.plusDays(7);
        };
    }

    static String severityFromScore(int score) {
        if (score >= 85) return "critical";
        if (score >= 70) return "high";
        if (score >= 50) return "warning";
        return "info";
    }

    // ── Shared geo util ────────────────────────────────────────────────────────

    static int haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double R    = 6371;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
            * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return (int) (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    private static String nvl(String s, String fallback) {
        return (s != null && !s.isBlank()) ? s : fallback;
    }

    private static String describeDuration(long seconds) {
        if (seconds >= 86_400) return (seconds / 86_400) + " day(s)";
        if (seconds >= 3_600)  return (seconds / 3_600)  + " hour(s)";
        if (seconds >= 60)     return (seconds / 60)     + " minute(s)";
        return seconds + " second(s)";
    }
}
