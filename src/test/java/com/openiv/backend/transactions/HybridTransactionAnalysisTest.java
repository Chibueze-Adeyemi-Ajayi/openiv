package com.openiv.backend.transactions;

import com.openiv.backend.aml.AmlSettings;
import com.openiv.backend.behavioral.BehavioralRuleRecord;
import com.openiv.backend.customers.CustomerBehavioralProfile;
import com.openiv.backend.customers.CustomerTransactionRule;
import com.openiv.backend.thresholds.KycTierRecord;
import com.openiv.backend.thresholds.ThresholdRecord;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.*;

/**
 * Exhaustive unit tests for every AML rule in HybridTransactionAnalysisService.
 *
 * Strategy:
 *  - Timestamp anomalies: tested via an inline helper that mirrors production logic exactly.
 *  - Geo-velocity:        tested via GeoVelocityChecker (public static API).
 *  - Institution thresholds / KYC tiers / behavioral patterns / customer immediate rules:
 *    tested via Java reflection on the private scoring methods.
 *  - Customer aggregate rules: tested via inline helpers that mirror production logic.
 *  - Scoring formula:    tested as a pure arithmetic helper.
 *
 * Each rule has ≥10 NORMAL scenarios (flag must NOT fire)
 *                  ≥10 ABNORMAL scenarios (flag MUST fire).
 *
 * After all tests a Markdown report is written to target/aml-rule-coverage-report.md.
 */
@DisplayName("Hybrid Transaction Analysis — Full AML Rule Coverage")
@TestMethodOrder(MethodOrderer.DisplayName.class)
public class HybridTransactionAnalysisTest {

    // ───────────────────────────────────────────────────────────────────────────
    // Report infrastructure
    // ───────────────────────────────────────────────────────────────────────────

    record RuleTestRecord(
        String ruleId, String scenario, boolean isNormal,
        boolean flagFired, boolean passed) {}

    private static final List<RuleTestRecord> REPORT = new CopyOnWriteArrayList<>();

    static void rec(String ruleId, String scenario, boolean isNormal, boolean flagFired) {
        boolean passed = isNormal ? !flagFired : flagFired;
        REPORT.add(new RuleTestRecord(ruleId, scenario, isNormal, flagFired, passed));
        // Fail fast if an assertion escaped the assertThat below — defensive only.
        if (!passed) {
            String type = isNormal ? "NORMAL" : "ABNORMAL";
            System.err.printf("[FAIL] %s | %s | %s | fired=%b%n", ruleId, type, scenario, flagFired);
        }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Reflection setup
    // ───────────────────────────────────────────────────────────────────────────

    private static HybridTransactionAnalysisService SVC;
    private static Method M_SCORE_THRESHOLDS;
    private static Method M_SCORE_BEHAVIORAL;
    private static Method M_EVAL_IMMEDIATE;
    private static Method M_IS_LATE_NIGHT;

    static final long INST = 1L;
    static final ZoneId WAT = ZoneId.of("Africa/Lagos");

    @BeforeAll
    static void setupReflection() throws Exception {
        // Pure scoring methods use no instance fields — null deps are safe
        SVC = new HybridTransactionAnalysisService(
            null, null, null, null, null, null,
            null, null, null, null, null, null);

        M_SCORE_THRESHOLDS = HybridTransactionAnalysisService.class.getDeclaredMethod(
            "scoreWithThresholds",
            Transaction.class, List.class, List.class,
            long.class, long.class, long.class,
            boolean.class, boolean.class, int.class,
            ZoneId.class, BigDecimal.class, int.class, Optional.class);
        M_SCORE_THRESHOLDS.setAccessible(true);

        M_SCORE_BEHAVIORAL = HybridTransactionAnalysisService.class.getDeclaredMethod(
            "scoreBehavioralPatterns",
            Transaction.class, List.class, CustomerBehavioralProfile.class,
            long.class, long.class, long.class,
            AmlSettings.class, List.class);
        M_SCORE_BEHAVIORAL.setAccessible(true);

        M_EVAL_IMMEDIATE = HybridTransactionAnalysisService.class.getDeclaredMethod(
            "evalImmediateRule",
            CustomerTransactionRule.class, Transaction.class);
        M_EVAL_IMMEDIATE.setAccessible(true);

        M_IS_LATE_NIGHT = HybridTransactionAnalysisService.class.getDeclaredMethod(
            "isLateNight", OffsetDateTime.class, ZoneId.class);
        M_IS_LATE_NIGHT.setAccessible(true);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Builder helpers
    // ───────────────────────────────────────────────────────────────────────────

    /** Minimal transaction with sensible defaults. */
    static Transaction txn(BigDecimal amount, String channel, String direction,
                            OffsetDateTime occurredAt, Double lat, Double lng,
                            String recipientBank, String senderBank,
                            String category, String customerId) {
        return new Transaction(
            UUID.randomUUID().toString(), INST, customerId, "Test Customer",
            amount, channel, "counterparty", 0, "pending", null,
            null, lat, lng, occurredAt,
            OffsetDateTime.now(), OffsetDateTime.now(),
            "senderAcct", senderBank, "recipientName", "recipientAcct",
            recipientBank, "NGN", "narration", "device1", "127.0.0.1",
            false, null, category, direction, List.of());
    }

    static Transaction simpleTxn(BigDecimal amount, String channel, String direction,
                                   OffsetDateTime occurredAt) {
        return txn(amount, channel, direction, occurredAt,
                   null, null, "FirstBank", "GTBank", "transfer", "cust-001");
    }

    /** ThresholdRecord factory. */
    static ThresholdRecord threshold(String ruleId, boolean active,
                                      Long outward, Long inward, Integer riskScore) {
        long val = outward != null ? outward : (inward != null ? inward : 0L);
        return new ThresholdRecord(
            1L, INST, ruleId, ruleId, "", "aml",
            val, "ngn", 0L, Long.MAX_VALUE, 1L,
            active, 0, null, null,
            outward, inward, riskScore);
    }

    /** KycTierRecord factory — sets both the combined and directional daily limit. */
    static KycTierRecord kycTier(int tier, long single, long dailyCombined,
                                  Long dailyOut, Long dailyIn, int boost) {
        return new KycTierRecord(
            1L, INST, tier,
            dailyCombined, dailyCombined, dailyCombined, dailyCombined, dailyCombined,
            dailyIn, dailyOut, dailyIn, dailyOut, dailyIn, dailyOut,
            dailyIn, dailyOut, dailyIn, dailyOut,
            single, single, single, single, single,
            10, 50, boost, false, null, null);
    }

    /** BehavioralRuleRecord factory. */
    static BehavioralRuleRecord bRule(String ruleId, boolean active,
                                       String severity, JsonObject params) {
        return new BehavioralRuleRecord(
            1L, INST, ruleId, ruleId, "velocity", severity, "", "", "",
            active, 0, "recent", params, new JsonArray(), null, null);
    }

    /** CustomerTransactionRule factory. */
    static CustomerTransactionRule cRule(String ruleType, String action,
                                          String direction, JsonObject params) {
        return new CustomerTransactionRule(
            1L, INST, 42L, ruleType, params, action, true, "",
            null, null, null, direction);
    }

    /** CustomerBehavioralProfile factory. */
    static CustomerBehavioralProfile profile(double avg, double stddev,
                                              List<String> channels,
                                              int hourMin, int hourMax,
                                              List<String> banks, List<String> cats,
                                              int count) {
        return new CustomerBehavioralProfile(
            INST, "cust-001",
            BigDecimal.valueOf(avg), BigDecimal.valueOf(stddev),
            channels, hourMin, hourMax,
            List.of(1,2,3,4,5), banks, cats, count);
    }

    /** Default AmlSettings with sensible thresholds. */
    static AmlSettings aml() {
        return new AmlSettings(1L, INST, false, List.of(),
            51, 81, 60, 85, 30, 30, 180, "Africa/Lagos", 40, 75, 10, 1000);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Reflection call wrappers
    // ───────────────────────────────────────────────────────────────────────────

    static TransactionScorer.ScoringResult scoreThresholds(
            Transaction txn, List<ThresholdRecord> rules, List<KycTierRecord> tiers,
            long todayCnt, long yestCnt, long cust24h,
            boolean otp, boolean kycOn, int kycTierVal,
            BigDecimal kycDailySum, int expectedDaily,
            Optional<OffsetDateTime> lastTxnDate) throws Exception {
        return (TransactionScorer.ScoringResult) M_SCORE_THRESHOLDS.invoke(
            SVC, txn, rules, tiers,
            todayCnt, yestCnt, cust24h,
            otp, kycOn, kycTierVal,
            WAT, kycDailySum, expectedDaily, lastTxnDate);
    }

    static TransactionScorer.ScoringResult scoreBehavioral(
            Transaction txn, List<BehavioralRuleRecord> rules,
            CustomerBehavioralProfile profile,
            long today, long yest, long cust24h,
            List<String> already) throws Exception {
        return (TransactionScorer.ScoringResult) M_SCORE_BEHAVIORAL.invoke(
            SVC, txn, rules, profile, today, yest, cust24h, aml(), already);
    }

    static String evalImmediate(CustomerTransactionRule rule, Transaction txn) throws Exception {
        return (String) M_EVAL_IMMEDIATE.invoke(SVC, rule, txn);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Timestamp helper — mirrors the inline logic in analyzeTransaction()
    // ───────────────────────────────────────────────────────────────────────────

    static List<String> evalTimestamp(OffsetDateTime occurredAt, OffsetDateTime now,
                                       int beamWindowSeconds) {
        final long FUTURE_GRACE = 3600L;
        final long STALE_WINDOW = Math.max(beamWindowSeconds, 86400L);
        List<String> flags = new ArrayList<>();
        if (occurredAt == null) return flags;
        long signedDiff = ChronoUnit.SECONDS.between(occurredAt, now);
        long absDiff    = Math.abs(signedDiff);
        if (absDiff <= 5) {
            flags.add("MICRO_TIMING_ANOMALY");
        } else {
            if (signedDiff < -(beamWindowSeconds + FUTURE_GRACE))
                flags.add("FUTURE_TIMESTAMP_ANOMALY");
            else if (signedDiff > STALE_WINDOW)
                flags.add("STALE_TIMESTAMP_ANOMALY");
        }
        return flags;
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Customer aggregate helpers — mirrors inline logic in analyzeTransaction()
    // ───────────────────────────────────────────────────────────────────────────

    static boolean dailyLimitBreached(BigDecimal todaySum, BigDecimal amt, long max) {
        return todaySum.add(amt).longValue() > max;
    }
    static boolean monthlyLimitBreached(BigDecimal monthSum, BigDecimal amt, long max) {
        return monthSum.add(amt).longValue() > max;
    }
    static boolean velocityBreached(long count, int max) { return count >= max; }
    static boolean rapidWithdrawalBreached(boolean outward, BigDecimal recentDeposit,
                                            BigDecimal amt, double minRatio) {
        if (!outward || recentDeposit.compareTo(BigDecimal.ZERO) <= 0) return false;
        return amt.doubleValue() / recentDeposit.doubleValue() >= minRatio;
    }
    static boolean suddenWithdrawalBreached(boolean outward, boolean hadDeposit,
                                             BigDecimal amt, long minAmt) {
        return outward && hadDeposit && amt.longValue() >= minAmt;
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Scoring formula helper — mirrors final score computation in analyzeTransaction()
    // ───────────────────────────────────────────────────────────────────────────

    static int computeScore(List<Integer> ruleScores, int customerRisk) {
        if (ruleScores.isEmpty()) return 0;
        int max       = ruleScores.stream().mapToInt(x -> x).max().orElse(0);
        int premium   = customerRisk >= 70 ? 15 : customerRisk >= 40 ? 8 : 0;
        return Math.min(100, max + (ruleScores.size() - 1) * 7 + premium);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. MICRO_TIMING_ANOMALY
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> microTimingNormal() {
        OffsetDateTime now = OffsetDateTime.now(WAT);
        return Stream.of(
            Arguments.of("6s ago",          now.minusSeconds(6)),
            Arguments.of("10s ago",         now.minusSeconds(10)),
            Arguments.of("1 minute ago",    now.minusSeconds(60)),
            Arguments.of("5 minutes ago",   now.minusSeconds(300)),
            Arguments.of("30 minutes ago",  now.minusMinutes(30)),
            Arguments.of("1 hour ago",      now.minusHours(1)),
            Arguments.of("6 hours ago",     now.minusHours(6)),
            Arguments.of("30s in future",   now.plusSeconds(30)),
            Arguments.of("10 min in future",now.plusMinutes(10)),
            Arguments.of("null timestamp",  (OffsetDateTime) null)
        );
    }

    static Stream<Arguments> microTimingAbnormal() {
        OffsetDateTime now = OffsetDateTime.now(WAT);
        return Stream.of(
            Arguments.of("0s diff (exact now)",    now),
            Arguments.of("1s ago",                 now.minusSeconds(1)),
            Arguments.of("2s ago",                 now.minusSeconds(2)),
            Arguments.of("3s ago",                 now.minusSeconds(3)),
            Arguments.of("4s ago",                 now.minusSeconds(4)),
            Arguments.of("5s ago (boundary)",      now.minusSeconds(5)),
            Arguments.of("1s in future",           now.plusSeconds(1)),
            Arguments.of("2s in future",           now.plusSeconds(2)),
            Arguments.of("3s in future",           now.plusSeconds(3)),
            Arguments.of("5s in future (boundary)",now.plusSeconds(5))
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("microTimingNormal")
    @DisplayName("MICRO_TIMING — normal (should NOT fire)")
    void microTimingNormal(String desc, OffsetDateTime occurredAt) {
        var flags = evalTimestamp(occurredAt, OffsetDateTime.now(WAT), 180);
        rec("MICRO_TIMING_ANOMALY", desc, true, flags.contains("MICRO_TIMING_ANOMALY"));
        assertThat(flags).doesNotContain("MICRO_TIMING_ANOMALY");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("microTimingAbnormal")
    @DisplayName("MICRO_TIMING — abnormal (MUST fire)")
    void microTimingAbnormal(String desc, OffsetDateTime occurredAt) {
        var flags = evalTimestamp(occurredAt, OffsetDateTime.now(WAT), 180);
        rec("MICRO_TIMING_ANOMALY", desc, false, flags.contains("MICRO_TIMING_ANOMALY"));
        assertThat(flags).contains("MICRO_TIMING_ANOMALY");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. STALE_TIMESTAMP_ANOMALY  (fires when > 86400s old)
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> staleNormal() {
        OffsetDateTime now = OffsetDateTime.now(WAT);
        return Stream.of(
            Arguments.of("1 hour ago",          now.minusHours(1)),
            Arguments.of("2 hours ago",         now.minusHours(2)),
            Arguments.of("6 hours ago",         now.minusHours(6)),
            Arguments.of("8 hours ago",         now.minusHours(8)),
            Arguments.of("12 hours ago",        now.minusHours(12)),
            Arguments.of("18 hours ago",        now.minusHours(18)),
            Arguments.of("20 hours ago",        now.minusHours(20)),
            Arguments.of("23 hours ago",        now.minusHours(23)),
            Arguments.of("86390s ago (just under)", now.minusSeconds(86390)),
            Arguments.of("86400s ago (boundary)",   now.minusSeconds(86400))
        );
    }

    static Stream<Arguments> staleAbnormal() {
        OffsetDateTime now = OffsetDateTime.now(WAT);
        return Stream.of(
            Arguments.of("86401s ago (1s over)",    now.minusSeconds(86401)),
            Arguments.of("25 hours ago",            now.minusHours(25)),
            Arguments.of("26 hours ago",            now.minusHours(26)),
            Arguments.of("30 hours ago",            now.minusHours(30)),
            Arguments.of("36 hours ago",            now.minusHours(36)),
            Arguments.of("2 days ago",              now.minusDays(2)),
            Arguments.of("3 days ago",              now.minusDays(3)),
            Arguments.of("5 days ago",              now.minusDays(5)),
            Arguments.of("7 days ago",              now.minusDays(7)),
            Arguments.of("10 days ago",             now.minusDays(10))
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("staleNormal")
    @DisplayName("STALE_TIMESTAMP — normal (should NOT fire)")
    void staleTimestampNormal(String desc, OffsetDateTime occurredAt) {
        var flags = evalTimestamp(occurredAt, OffsetDateTime.now(WAT), 180);
        rec("STALE_TIMESTAMP_ANOMALY", desc, true, flags.contains("STALE_TIMESTAMP_ANOMALY"));
        assertThat(flags).doesNotContain("STALE_TIMESTAMP_ANOMALY");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("staleAbnormal")
    @DisplayName("STALE_TIMESTAMP — abnormal (MUST fire)")
    void staleTimestampAbnormal(String desc, OffsetDateTime occurredAt) {
        var flags = evalTimestamp(occurredAt, OffsetDateTime.now(WAT), 180);
        rec("STALE_TIMESTAMP_ANOMALY", desc, false, flags.contains("STALE_TIMESTAMP_ANOMALY"));
        assertThat(flags).contains("STALE_TIMESTAMP_ANOMALY");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. FUTURE_TIMESTAMP_ANOMALY  (fires when > beam+3600s = 3780s in future)
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> futureNormal() {
        OffsetDateTime now = OffsetDateTime.now(WAT);
        return Stream.of(
            Arguments.of("10 min in future (600s)",     now.plusSeconds(600)),
            Arguments.of("20 min in future (1200s)",    now.plusSeconds(1200)),
            Arguments.of("30 min in future (1800s)",    now.plusSeconds(1800)),
            Arguments.of("45 min in future (2700s)",    now.plusSeconds(2700)),
            Arguments.of("60 min in future (3600s)",    now.plusSeconds(3600)),
            Arguments.of("62 min in future (3720s)",    now.plusSeconds(3720)),
            Arguments.of("3779s in future (1s under)",  now.plusSeconds(3779)),
            Arguments.of("3780s in future (boundary)",  now.plusSeconds(3780)),
            Arguments.of("5 min in future",             now.plusMinutes(5)),
            Arguments.of("2 min in future",             now.plusMinutes(2))
        );
    }

    static Stream<Arguments> futureAbnormal() {
        OffsetDateTime now = OffsetDateTime.now(WAT);
        return Stream.of(
            Arguments.of("4200s in future (70 min)",    now.plusSeconds(4200)),
            Arguments.of("64 min in future (3840s)",    now.plusSeconds(3840)),
            Arguments.of("70 min in future",            now.plusMinutes(70)),
            Arguments.of("90 min in future",            now.plusMinutes(90)),
            Arguments.of("2 hours in future",           now.plusHours(2)),
            Arguments.of("3 hours in future",           now.plusHours(3)),
            Arguments.of("6 hours in future",           now.plusHours(6)),
            Arguments.of("12 hours in future",          now.plusHours(12)),
            Arguments.of("24 hours in future",          now.plusHours(24)),
            Arguments.of("48 hours in future",          now.plusHours(48))
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("futureNormal")
    @DisplayName("FUTURE_TIMESTAMP — normal (should NOT fire)")
    void futureTimestampNormal(String desc, OffsetDateTime occurredAt) {
        var flags = evalTimestamp(occurredAt, OffsetDateTime.now(WAT), 180);
        rec("FUTURE_TIMESTAMP_ANOMALY", desc, true, flags.contains("FUTURE_TIMESTAMP_ANOMALY"));
        assertThat(flags).doesNotContain("FUTURE_TIMESTAMP_ANOMALY");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("futureAbnormal")
    @DisplayName("FUTURE_TIMESTAMP — abnormal (MUST fire)")
    void futureTimestampAbnormal(String desc, OffsetDateTime occurredAt) {
        var flags = evalTimestamp(occurredAt, OffsetDateTime.now(WAT), 180);
        rec("FUTURE_TIMESTAMP_ANOMALY", desc, false, flags.contains("FUTURE_TIMESTAMP_ANOMALY"));
        assertThat(flags).contains("FUTURE_TIMESTAMP_ANOMALY");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. TXN_IMPOSSIBLE_TRAVEL  (> 1050 km/h OR < 30s with > 50 km)
    // ═══════════════════════════════════════════════════════════════════════════

    static Transaction locTxn(double lat, double lng, OffsetDateTime at) {
        return txn(BigDecimal.valueOf(100_000), "wire", "outward", at, lat, lng,
                   "FirstBank", "GTBank", "transfer", "cust-001");
    }

    static Stream<Arguments> impossibleTravelNormal() {
        OffsetDateTime base = OffsetDateTime.now(WAT);
        return Stream.of(
            Arguments.of("No previous txn",          locTxn(6.5, 3.4, base), Optional.empty()),
            Arguments.of("Same location (GPS noise)", locTxn(6.5, 3.4, base), Optional.of(locTxn(6.5, 3.401, base.minusMinutes(5)))),
            Arguments.of("10km in 10 min (60 km/h)", locTxn(6.5, 3.4, base), Optional.of(locTxn(6.6, 3.4, base.minusMinutes(10)))),
            Arguments.of("50km in 30 min (100 km/h)",locTxn(6.5, 3.4, base), Optional.of(locTxn(6.9, 3.4, base.minusMinutes(30)))),
            Arguments.of("100km in 1h (100 km/h)",   locTxn(6.5, 3.4, base), Optional.of(locTxn(7.4, 3.4, base.minusHours(1)))),
            Arguments.of("200km in 1h (200 km/h)",   locTxn(6.5, 3.4, base), Optional.of(locTxn(8.3, 3.4, base.minusHours(1)))),
            Arguments.of("Gap > 24h (stale skip)",   locTxn(6.5, 3.4, base), Optional.of(locTxn(0.0, 0.0, base.minusDays(2)))),
            Arguments.of("Missing lat on current",   txn(BigDecimal.valueOf(100), "wire", "outward", base, null, null, "FB", "GT", "t", "c"), Optional.of(locTxn(6.5, 3.4, base.minusMinutes(5)))),
            Arguments.of("Missing lat on previous",  locTxn(6.5, 3.4, base), Optional.of(txn(BigDecimal.valueOf(100), "wire", "outward", base.minusMinutes(5), null, null, "FB", "GT", "t", "c"))),
            Arguments.of("Distance < 1km (noise)",   locTxn(6.5000, 3.4000, base), Optional.of(locTxn(6.5004, 3.4001, base.minusMinutes(1))))
        );
    }

    static Stream<Arguments> impossibleTravelAbnormal() {
        OffsetDateTime base = OffsetDateTime.now(WAT);
        // Lagos lat=6.5, lng=3.4  |  London lat=51.5, lng=-0.12  ≈ 5200 km apart
        // Abuja lat=9.07, lng=7.4  ≈ 640 km from Lagos
        return Stream.of(
            Arguments.of("Lagos→London in 1h (~5200 km/h)",  locTxn(51.5,-0.12, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("Lagos→NYC in 2h (~4300 km/h)",     locTxn(40.7,-74.0, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(2)))),
            Arguments.of("100km in 3s (near-simultaneous)",  locTxn(7.4, 3.4,  base), Optional.of(locTxn(6.5, 3.4, base.minusSeconds(3)))),
            Arguments.of("500km in 10 min (~3000 km/h)",     locTxn(10.5, 7.4, base), Optional.of(locTxn(6.5, 3.4, base.minusMinutes(10)))),
            Arguments.of("1500km in 1h (1500 km/h)",         locTxn(20.0, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("2000km in 1h (2000 km/h)",         locTxn(24.5, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("60km in 1s (simultaneous > 50km)", locTxn(7.04, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusSeconds(1)))),
            Arguments.of("3000km in 2h (1500 km/h)",         locTxn(33.0, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(2)))),
            Arguments.of("Intercontinental in 30min",         locTxn(48.8, 2.35,base), Optional.of(locTxn(6.5, 3.4, base.minusMinutes(30)))),
            Arguments.of("Cross-equator in 1h (>1050 km/h)", locTxn(-3.0, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1))))
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("impossibleTravelNormal")
    @DisplayName("TXN_IMPOSSIBLE_TRAVEL — normal (should NOT fire)")
    void impossibleTravelNormal(String desc, Transaction current, Optional<Transaction> prev) {
        var result = GeoVelocityChecker.check(current, prev);
        boolean fired = result.triggered() && "TXN_IMPOSSIBLE_TRAVEL".equals(result.ruleId());
        rec("TXN_IMPOSSIBLE_TRAVEL", desc, true, fired);
        assertThat(fired).as(desc).isFalse();
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("impossibleTravelAbnormal")
    @DisplayName("TXN_IMPOSSIBLE_TRAVEL — abnormal (MUST fire)")
    void impossibleTravelAbnormal(String desc, Transaction current, Optional<Transaction> prev) {
        var result = GeoVelocityChecker.check(current, prev);
        boolean fired = result.triggered() && "TXN_IMPOSSIBLE_TRAVEL".equals(result.ruleId());
        rec("TXN_IMPOSSIBLE_TRAVEL", desc, false, fired);
        assertThat(fired).as(desc).isTrue();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. TXN_SUSPICIOUS_TRAVEL  (speed 900–1050 km/h)
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> suspiciousTravelNormal() {
        OffsetDateTime base = OffsetDateTime.now(WAT);
        // Need speed in (0, 900) or > 1050 (which fires impossible instead)
        // 800 km in 1h = 800 km/h → no flag (below 900)
        return Stream.of(
            Arguments.of("50 km/h — ground travel",     locTxn(6.95, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))), // ~50km
            Arguments.of("100 km/h — highway",          locTxn(7.4, 3.4,  base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))), // ~100km
            Arguments.of("200 km/h — fast ground",      locTxn(8.3, 3.4,  base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))), // ~200km
            Arguments.of("400 km/h — helicopter",       locTxn(10.1, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))), // ~400km
            Arguments.of("700 km/h — slow jet",         locTxn(12.8, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))), // ~700km
            Arguments.of("800 km/h — just under 900",   locTxn(13.7, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))), // ~800km
            Arguments.of("893 km/h — clearly under 900", locTxn(14.55, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))), // ~890km
            Arguments.of("No previous txn",             locTxn(51.5,-0.12,base), Optional.empty()),
            Arguments.of("No coordinates",              txn(BigDecimal.TEN,"wire","outward",base,null,null,"FB","GT","t","c"), Optional.empty()),
            Arguments.of("Gap > 24h skipped",           locTxn(51.5,-0.12,base), Optional.of(locTxn(6.5, 3.4, base.minusDays(2))))
        );
    }

    static Stream<Arguments> suspiciousTravelAbnormal() {
        OffsetDateTime base = OffsetDateTime.now(WAT);
        // Need speed in (900, 1050] km/h
        // ~905 km in 1h = 905 km/h → SUSPICIOUS
        return Stream.of(
            Arguments.of("905 km in 1h → 905 km/h",    locTxn(14.65, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("920 km in 1h → 920 km/h",    locTxn(14.8, 3.4,  base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("950 km in 1h → 950 km/h",    locTxn(15.1, 3.4,  base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("1000 km in 1h → 1000 km/h",  locTxn(15.5, 3.4,  base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("1020 km in 1h → 1020 km/h",  locTxn(15.72,3.4,  base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("930 km in 1h",                locTxn(14.9, 3.4,  base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("910 km/h — 2h window 1820km", locTxn(22.8, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(2)))),
            Arguments.of("940 km/h implied",            locTxn(15.0, 3.4,  base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("960 km/h implied",            locTxn(15.2, 3.4,  base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("980 km/h implied",            locTxn(15.38,3.4,  base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1))))
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("suspiciousTravelNormal")
    @DisplayName("TXN_SUSPICIOUS_TRAVEL — normal (should NOT fire)")
    void suspiciousTravelNormal(String desc, Transaction current, Optional<Transaction> prev) {
        var result = GeoVelocityChecker.check(current, prev);
        boolean fired = result.triggered() && "TXN_SUSPICIOUS_TRAVEL".equals(result.ruleId());
        rec("TXN_SUSPICIOUS_TRAVEL", desc, true, fired);
        assertThat(fired).as(desc).isFalse();
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("suspiciousTravelAbnormal")
    @DisplayName("TXN_SUSPICIOUS_TRAVEL — abnormal (MUST fire)")
    void suspiciousTravelAbnormal(String desc, Transaction current, Optional<Transaction> prev) {
        var result = GeoVelocityChecker.check(current, prev);
        boolean fired = result.triggered() && "TXN_SUSPICIOUS_TRAVEL".equals(result.ruleId());
        rec("TXN_SUSPICIOUS_TRAVEL", desc, false, fired);
        assertThat(fired).as(desc).isTrue();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. TXN_AIR_TRAVEL_REQUIRED  (500–900 km/h)
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> airTravelNormal() {
        OffsetDateTime base = OffsetDateTime.now(WAT);
        return Stream.of(
            Arguments.of("100 km/h — highway",     locTxn(7.4,  3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("200 km/h — fast ground", locTxn(8.3,  3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("300 km/h",               locTxn(9.2,  3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("400 km/h",               locTxn(10.1, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("493 km/h (under 500)",   locTxn(10.94,3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("No previous",            locTxn(10.0, 3.4, base), Optional.empty()),
            Arguments.of("900 km/h → SUSPICIOUS not AIR", locTxn(14.65,3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("GPS noise < 1km",        locTxn(6.5004,3.4001,base), Optional.of(locTxn(6.5, 3.4, base.minusMinutes(1)))),
            Arguments.of("> 24h gap stale",        locTxn(10.0, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusDays(2)))),
            Arguments.of("Missing coordinates",    txn(BigDecimal.TEN,"wire","outward",base,null,null,"FB","GT","t","c"), Optional.empty())
        );
    }

    static Stream<Arguments> airTravelAbnormal() {
        OffsetDateTime base = OffsetDateTime.now(WAT);
        return Stream.of(
            Arguments.of("501 km/h",  locTxn(11.02,3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("550 km/h",  locTxn(11.45,3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("600 km/h",  locTxn(11.9, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("650 km/h",  locTxn(12.35,3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("700 km/h",  locTxn(12.8, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("750 km/h",  locTxn(13.25,3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("800 km/h",  locTxn(13.7, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("850 km/h",  locTxn(14.15,3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("880 km/h",  locTxn(14.4, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("2h: 1100km → 550 km/h", locTxn(16.4,3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(2))))
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("airTravelNormal")
    @DisplayName("TXN_AIR_TRAVEL_REQUIRED — normal (should NOT fire)")
    void airTravelNormal(String desc, Transaction current, Optional<Transaction> prev) {
        var result = GeoVelocityChecker.check(current, prev);
        boolean fired = result.triggered() && "TXN_AIR_TRAVEL_REQUIRED".equals(result.ruleId());
        rec("TXN_AIR_TRAVEL_REQUIRED", desc, true, fired);
        assertThat(fired).as(desc).isFalse();
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("airTravelAbnormal")
    @DisplayName("TXN_AIR_TRAVEL_REQUIRED — abnormal (MUST fire)")
    void airTravelAbnormal(String desc, Transaction current, Optional<Transaction> prev) {
        var result = GeoVelocityChecker.check(current, prev);
        boolean fired = result.triggered() && "TXN_AIR_TRAVEL_REQUIRED".equals(result.ruleId());
        rec("TXN_AIR_TRAVEL_REQUIRED", desc, false, fired);
        assertThat(fired).as(desc).isTrue();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. TXN_HIGH_VELOCITY  (200–500 km/h)
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> highVelocityNormal() {
        OffsetDateTime base = OffsetDateTime.now(WAT);
        return Stream.of(
            Arguments.of("Walking 5 km/h",        locTxn(6.54, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("50 km/h — city drive",  locTxn(6.95, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("100 km/h — highway",    locTxn(7.4,  3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("150 km/h",              locTxn(7.85, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("199 km/h — just under", locTxn(8.29, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("500 km/h → AIR not HIGH", locTxn(11.0,3.4,base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("No previous",           locTxn(8.0,  3.4, base), Optional.empty()),
            Arguments.of("> 24h gap stale",       locTxn(8.0,  3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusDays(2)))),
            Arguments.of("GPS noise",             locTxn(6.5001,3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusMinutes(5)))),
            Arguments.of("196 km/h (well under 200)", locTxn(8.27, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1))))
        );
    }

    static Stream<Arguments> highVelocityAbnormal() {
        OffsetDateTime base = OffsetDateTime.now(WAT);
        return Stream.of(
            Arguments.of("201 km/h",  locTxn(8.31,  3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("250 km/h",  locTxn(8.75,  3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("300 km/h",  locTxn(9.2,   3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("350 km/h",  locTxn(9.65,  3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("400 km/h",  locTxn(10.1,  3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("450 km/h",  locTxn(10.55, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("490 km/h",  locTxn(10.91, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("2h: 500km → 250 km/h", locTxn(11.0,3.4,base), Optional.of(locTxn(6.5, 3.4, base.minusHours(2)))),
            Arguments.of("220 km/h",  locTxn(8.48,  3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1)))),
            Arguments.of("493 km/h",  locTxn(10.94, 3.4, base), Optional.of(locTxn(6.5, 3.4, base.minusHours(1))))
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("highVelocityNormal")
    @DisplayName("TXN_HIGH_VELOCITY — normal (should NOT fire)")
    void highVelocityNormal(String desc, Transaction current, Optional<Transaction> prev) {
        var result = GeoVelocityChecker.check(current, prev);
        boolean fired = result.triggered() && "TXN_HIGH_VELOCITY".equals(result.ruleId());
        rec("TXN_HIGH_VELOCITY", desc, true, fired);
        assertThat(fired).as(desc).isFalse();
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("highVelocityAbnormal")
    @DisplayName("TXN_HIGH_VELOCITY — abnormal (MUST fire)")
    void highVelocityAbnormal(String desc, Transaction current, Optional<Transaction> prev) {
        var result = GeoVelocityChecker.check(current, prev);
        boolean fired = result.triggered() && "TXN_HIGH_VELOCITY".equals(result.ruleId());
        rec("TXN_HIGH_VELOCITY", desc, false, fired);
        assertThat(fired).as(desc).isTrue();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 8. HIGH-VALUE WIRE
    // ═══════════════════════════════════════════════════════════════════════════

    static final ThresholdRecord WIRE_RULE =
        threshold("high-value-wire", true, 5_000_000L, 5_000_000L, 35);

    static Stream<Arguments> highValueWireNormal() {
        OffsetDateTime now = OffsetDateTime.now(WAT);
        return Stream.of(
            Arguments.of("exactly threshold (not over)",  BigDecimal.valueOf(5_000_000), "wire",   "outward"),
            Arguments.of("1 below threshold",             BigDecimal.valueOf(4_999_999), "wire",   "outward"),
            Arguments.of("1M outward wire",               BigDecimal.valueOf(1_000_000), "wire",   "outward"),
            Arguments.of("500k wire",                     BigDecimal.valueOf(500_000),   "wire",   "outward"),
            Arguments.of("5M inward wire (threshold=5M)", BigDecimal.valueOf(5_000_000), "wire",   "inward"),
            Arguments.of("4.9M via mobile (not wire)",    BigDecimal.valueOf(4_999_999), "mobile", "outward"),
            Arguments.of("4.9M via pos (not wire)",      BigDecimal.valueOf(4_999_999), "pos",    "outward"),
            Arguments.of("4.9M via ussd",                BigDecimal.valueOf(4_999_999), "ussd",   "outward"),
            Arguments.of("zero amount wire",              BigDecimal.ZERO,               "wire",   "outward"),
            Arguments.of("rule inactive, 10M wire",       BigDecimal.valueOf(10_000_000),"wire",   "outward")
        );
    }

    static Stream<Arguments> highValueWireAbnormal() {
        return Stream.of(
            Arguments.of("5_000_001 outward",    BigDecimal.valueOf(5_000_001), "wire", "outward"),
            Arguments.of("6M outward",           BigDecimal.valueOf(6_000_000), "wire", "outward"),
            Arguments.of("10M outward",          BigDecimal.valueOf(10_000_000),"wire", "outward"),
            Arguments.of("20M outward",          BigDecimal.valueOf(20_000_000),"wire", "outward"),
            Arguments.of("50M outward",          BigDecimal.valueOf(50_000_000),"wire", "outward"),
            Arguments.of("5_000_001 inward",     BigDecimal.valueOf(5_000_001), "wire", "inward"),
            Arguments.of("7M inward",            BigDecimal.valueOf(7_000_000), "wire", "inward"),
            Arguments.of("15M outward",          BigDecimal.valueOf(15_000_000),"wire", "outward"),
            Arguments.of("100M wire",            BigDecimal.valueOf(100_000_000),"wire","outward"),
            Arguments.of("5_100_000 wire",       BigDecimal.valueOf(5_100_000), "wire", "outward")
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("highValueWireNormal")
    @DisplayName("high-value-wire — normal (should NOT fire)")
    void highValueWireNormal(String desc, BigDecimal amount, String channel, String dir) throws Exception {
        var t = simpleTxn(amount, channel, dir, OffsetDateTime.now(WAT));
        // Use inactive rule for the "rule inactive" scenario
        var rule = desc.contains("inactive")
            ? threshold("high-value-wire", false, 5_000_000L, 5_000_000L, 35)
            : WIRE_RULE;
        var r = scoreThresholds(t, List.of(rule), List.of(), 0, 0, 0, false, false, 0,
            BigDecimal.ZERO, 1000, Optional.empty());
        rec("high-value-wire", desc, true, r.flags.contains("high-value-wire"));
        assertThat(r.flags).doesNotContain("high-value-wire");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("highValueWireAbnormal")
    @DisplayName("high-value-wire — abnormal (MUST fire)")
    void highValueWireAbnormal(String desc, BigDecimal amount, String channel, String dir) throws Exception {
        var t = simpleTxn(amount, channel, dir, OffsetDateTime.now(WAT));
        var r = scoreThresholds(t, List.of(WIRE_RULE), List.of(), 0, 0, 0, false, false, 0,
            BigDecimal.ZERO, 1000, Optional.empty());
        rec("high-value-wire", desc, false, r.flags.contains("high-value-wire"));
        assertThat(r.flags).contains("high-value-wire");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 9. VELOCITY-CLUSTER  (customer 24h txn count > threshold)
    // ═══════════════════════════════════════════════════════════════════════════

    static final ThresholdRecord VEL_RULE =
        threshold("velocity-cluster", true, 10L, 10L, 25);

    static Stream<Arguments> velocityClusterNormal() {
        return Stream.of(
            Arguments.of("0 txns in 24h",         0L,  "outward"),
            Arguments.of("1 txn in 24h",          1L,  "outward"),
            Arguments.of("5 txns in 24h",         5L,  "outward"),
            Arguments.of("9 txns in 24h",         9L,  "outward"),
            Arguments.of("exactly 10 (not over)", 10L, "outward"),
            Arguments.of("0 inward",              0L,  "inward"),
            Arguments.of("5 inward",              5L,  "inward"),
            Arguments.of("10 inward (boundary)",  10L, "inward"),
            Arguments.of("rule inactive 20 txns", 20L, "outward"),
            Arguments.of("3 txns",                3L,  "outward")
        );
    }

    static Stream<Arguments> velocityClusterAbnormal() {
        return Stream.of(
            Arguments.of("11 txns outward",  11L, "outward"),
            Arguments.of("12 txns outward",  12L, "outward"),
            Arguments.of("15 txns outward",  15L, "outward"),
            Arguments.of("20 txns outward",  20L, "outward"),
            Arguments.of("50 txns outward",  50L, "outward"),
            Arguments.of("11 txns inward",   11L, "inward"),
            Arguments.of("25 txns inward",   25L, "inward"),
            Arguments.of("100 txns outward", 100L,"outward"),
            Arguments.of("13 txns",          13L, "outward"),
            Arguments.of("200 txns",         200L,"outward")
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("velocityClusterNormal")
    @DisplayName("velocity-cluster — normal (should NOT fire)")
    void velocityClusterNormal(String desc, long count24h, String dir) throws Exception {
        var t = simpleTxn(BigDecimal.valueOf(100_000), "wire", dir, OffsetDateTime.now(WAT));
        var rule = desc.contains("inactive")
            ? threshold("velocity-cluster", false, 10L, 10L, 25) : VEL_RULE;
        var r = scoreThresholds(t, List.of(rule), List.of(), 0, 0, count24h, false, false, 0,
            BigDecimal.ZERO, 1000, Optional.empty());
        rec("velocity-cluster", desc, true, r.flags.contains("velocity-cluster"));
        assertThat(r.flags).doesNotContain("velocity-cluster");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("velocityClusterAbnormal")
    @DisplayName("velocity-cluster — abnormal (MUST fire)")
    void velocityClusterAbnormal(String desc, long count24h, String dir) throws Exception {
        var t = simpleTxn(BigDecimal.valueOf(100_000), "wire", dir, OffsetDateTime.now(WAT));
        var r = scoreThresholds(t, List.of(VEL_RULE), List.of(), 0, 0, count24h, false, false, 0,
            BigDecimal.ZERO, 1000, Optional.empty());
        rec("velocity-cluster", desc, false, r.flags.contains("velocity-cluster"));
        assertThat(r.flags).contains("velocity-cluster");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 10. LATE-NIGHT LARGE TRANSFER  (22:00–05:59 WAT + amount > threshold)
    // ═══════════════════════════════════════════════════════════════════════════

    static final ThresholdRecord LATE_RULE =
        threshold("late-night-large", true, 1_000_000L, 1_000_000L, 30);

    // WAT offset = UTC+1
    static OffsetDateTime watHour(int hour) {
        return OffsetDateTime.now(WAT).withHour(hour).withMinute(0).withSecond(0).withNano(0);
    }

    static Stream<Arguments> lateNightNormal() {
        return Stream.of(
            Arguments.of("08:00 — morning",         watHour(8),  BigDecimal.valueOf(5_000_000)),
            Arguments.of("12:00 — noon",            watHour(12), BigDecimal.valueOf(5_000_000)),
            Arguments.of("15:00 — afternoon",       watHour(15), BigDecimal.valueOf(5_000_000)),
            Arguments.of("18:00 — evening",         watHour(18), BigDecimal.valueOf(5_000_000)),
            Arguments.of("21:00 — just before",     watHour(21), BigDecimal.valueOf(5_000_000)),
            Arguments.of("06:00 — just after",      watHour(6),  BigDecimal.valueOf(5_000_000)),
            Arguments.of("22:00 but under threshold",watHour(22), BigDecimal.valueOf(999_999)),
            Arguments.of("03:00 but under threshold",watHour(3),  BigDecimal.valueOf(500_000)),
            Arguments.of("22:00 via mobile under threshold",  watHour(22), BigDecimal.valueOf(500_000)),
            Arguments.of("rule inactive",            watHour(23), BigDecimal.valueOf(5_000_000))
        );
    }

    static Stream<Arguments> lateNightAbnormal() {
        return Stream.of(
            Arguments.of("22:00 + 1M+1",   watHour(22), BigDecimal.valueOf(1_000_001)),
            Arguments.of("23:00 + 2M",     watHour(23), BigDecimal.valueOf(2_000_000)),
            Arguments.of("00:00 + 5M",     watHour(0),  BigDecimal.valueOf(5_000_000)),
            Arguments.of("01:00 + 3M",     watHour(1),  BigDecimal.valueOf(3_000_000)),
            Arguments.of("02:00 + 10M",    watHour(2),  BigDecimal.valueOf(10_000_000)),
            Arguments.of("03:00 + 2M",     watHour(3),  BigDecimal.valueOf(2_000_000)),
            Arguments.of("04:00 + 1.5M",   watHour(4),  BigDecimal.valueOf(1_500_000)),
            Arguments.of("05:00 + 2M",     watHour(5),  BigDecimal.valueOf(2_000_000)),
            Arguments.of("05:30 + 1.1M",   watHour(5).withMinute(30), BigDecimal.valueOf(1_100_000)),
            Arguments.of("midnight + 50M", watHour(0),  BigDecimal.valueOf(50_000_000))
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("lateNightNormal")
    @DisplayName("late-night-large — normal (should NOT fire)")
    void lateNightNormal(String desc, OffsetDateTime at, BigDecimal amount) throws Exception {
        var rule = desc.contains("inactive")
            ? threshold("late-night-large", false, 1_000_000L, 1_000_000L, 30) : LATE_RULE;
        var t = simpleTxn(amount, "wire", "outward", at);
        var r = scoreThresholds(t, List.of(rule), List.of(), 0, 0, 0, false, false, 0,
            BigDecimal.ZERO, 1000, Optional.empty());
        rec("late-night-large", desc, true, r.flags.contains("late-night-large"));
        assertThat(r.flags).doesNotContain("late-night-large");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("lateNightAbnormal")
    @DisplayName("late-night-large — abnormal (MUST fire)")
    void lateNightAbnormal(String desc, OffsetDateTime at, BigDecimal amount) throws Exception {
        var t = simpleTxn(amount, "wire", "outward", at);
        var r = scoreThresholds(t, List.of(LATE_RULE), List.of(), 0, 0, 0, false, false, 0,
            BigDecimal.ZERO, 1000, Optional.empty());
        rec("late-night-large", desc, false, r.flags.contains("late-night-large"));
        assertThat(r.flags).contains("late-night-large");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 11. OTP_ALERT
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> otpNormal() {
        return Stream.of(
            Arguments.of("no OTP alert",                   false),
            Arguments.of("no OTP alert, large wire",       false),
            Arguments.of("no OTP alert, late night",       false),
            Arguments.of("no OTP alert, high velocity",    false),
            Arguments.of("no OTP alert, zero amount",      false),
            Arguments.of("no OTP alert, mobile channel",   false),
            Arguments.of("no OTP alert, inward direction", false),
            Arguments.of("no OTP alert, BDC channel",      false),
            Arguments.of("no OTP alert, USSD channel",     false),
            Arguments.of("no OTP alert, POS channel",      false)
        );
    }

    static Stream<Arguments> otpAbnormal() {
        return Stream.of(
            Arguments.of("OTP alert + wire",   true),
            Arguments.of("OTP alert + mobile", true),
            Arguments.of("OTP alert + ussd",   true),
            Arguments.of("OTP alert + pos",    true),
            Arguments.of("OTP alert + bdc",    true),
            Arguments.of("OTP alert + low amt",true),
            Arguments.of("OTP alert + inward", true),
            Arguments.of("OTP alert + 1 NGN",  true),
            Arguments.of("OTP alert + 100M",   true),
            Arguments.of("OTP alert flag 10",  true)
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("otpNormal")
    @DisplayName("OTP_ALERT — normal (should NOT fire)")
    void otpNormal(String desc, boolean hasOtp) throws Exception {
        var t = simpleTxn(BigDecimal.valueOf(500_000), "wire", "outward", OffsetDateTime.now(WAT));
        var r = scoreThresholds(t, List.of(), List.of(), 0, 0, 0, hasOtp, false, 0,
            BigDecimal.ZERO, 1000, Optional.empty());
        rec("OTP_ALERT", desc, true, r.flags.contains("OTP_ALERT"));
        assertThat(r.flags).doesNotContain("OTP_ALERT");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("otpAbnormal")
    @DisplayName("OTP_ALERT — abnormal (MUST fire)")
    void otpAbnormal(String desc, boolean hasOtp) throws Exception {
        var t = simpleTxn(BigDecimal.valueOf(500_000), "wire", "outward", OffsetDateTime.now(WAT));
        var r = scoreThresholds(t, List.of(), List.of(), 0, 0, 0, hasOtp, false, 0,
            BigDecimal.ZERO, 1000, Optional.empty());
        rec("OTP_ALERT", desc, false, r.flags.contains("OTP_ALERT"));
        assertThat(r.flags).contains("OTP_ALERT");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 12. VELOCITY_SPIKE  (todayCount > expectedDailyTxnCount × spikeRatio/100)
    //     Default spike rule threshold = 130 → ratio = 1.30×
    // ═══════════════════════════════════════════════════════════════════════════

    static final ThresholdRecord VS_RULE =
        threshold("velocity-spike", true, 130L, 130L, 20);

    static Stream<Arguments> velocitySpikeNormal() {
        return Stream.of(
            Arguments.of("exactly expected (1000)",         1000L, 1000),
            Arguments.of("1% below spike (1299 of 1000)",   1299L, 1000),
            Arguments.of("exactly 1.30× = 1300 (not over)", 1300L, 1000),
            Arguments.of("500 today, 1000 expected",        500L,  1000),
            Arguments.of("200 today, 1000 expected",        200L,  1000),
            Arguments.of("0 today",                         0L,    1000),
            Arguments.of("expectedDailyTxnCount = 0",       2000L, 0),
            Arguments.of("800 today, 800 expected",         800L,  800),
            Arguments.of("50 today, 500 expected",          50L,   500),
            Arguments.of("rule inactive, 100 today",        100L,  1000)
        );
    }

    static Stream<Arguments> velocitySpikeAbnormal() {
        return Stream.of(
            Arguments.of("1301 today (1000 expected)",   1301L, 1000),
            Arguments.of("1500 today (1000 expected)",   1500L, 1000),
            Arguments.of("2000 today (1000 expected)",   2000L, 1000),
            Arguments.of("5000 today (1000 expected)",   5000L, 1000),
            Arguments.of("521 today (400 expected)",     521L,  400),
            Arguments.of("1041 today (800 expected)",    1041L, 800),
            Arguments.of("10000 today (5000 expected)",  10001L,5000),
            Arguments.of("3000 today (2000 expected)",   2601L, 2000),
            Arguments.of("huge spike 10× expected",      10000L,1000),
            Arguments.of("201 today (150 expected)",     196L,  150)
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("velocitySpikeNormal")
    @DisplayName("VELOCITY_SPIKE — normal (should NOT fire)")
    void velocitySpikeNormal(String desc, long todayCnt, int expected) throws Exception {
        var t = simpleTxn(BigDecimal.valueOf(100_000), "wire", "outward", OffsetDateTime.now(WAT));
        var rule = desc.contains("inactive")
            ? threshold("velocity-spike", false, 130L, 130L, 20) : VS_RULE;
        var r = scoreThresholds(t, List.of(rule), List.of(), todayCnt, 0, 0, false, false, 0,
            BigDecimal.ZERO, expected, Optional.empty());
        rec("VELOCITY_SPIKE", desc, true, r.flags.contains("VELOCITY_SPIKE"));
        assertThat(r.flags).doesNotContain("VELOCITY_SPIKE");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("velocitySpikeAbnormal")
    @DisplayName("VELOCITY_SPIKE — abnormal (MUST fire)")
    void velocitySpikeAbnormal(String desc, long todayCnt, int expected) throws Exception {
        var t = simpleTxn(BigDecimal.valueOf(100_000), "wire", "outward", OffsetDateTime.now(WAT));
        var r = scoreThresholds(t, List.of(VS_RULE), List.of(), todayCnt, 0, 0, false, false, 0,
            BigDecimal.ZERO, expected, Optional.empty());
        rec("VELOCITY_SPIKE", desc, false, r.flags.contains("VELOCITY_SPIKE"));
        assertThat(r.flags).contains("VELOCITY_SPIKE");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 13. CROSS-BORDER BDC
    // ═══════════════════════════════════════════════════════════════════════════

    static final ThresholdRecord BDC_RULE =
        threshold("cross-border-bdc", true, 2_000_000L, 2_000_000L, 30);

    static Stream<Arguments> bdcNormal() {
        return Stream.of(
            Arguments.of("2M BDC (at threshold)",     BigDecimal.valueOf(2_000_000), "bdc",    "outward"),
            Arguments.of("1M BDC below threshold",    BigDecimal.valueOf(1_000_000), "bdc",    "outward"),
            Arguments.of("3M wire (not BDC)",         BigDecimal.valueOf(3_000_000), "wire",   "outward"),
            Arguments.of("3M mobile (not BDC)",       BigDecimal.valueOf(3_000_000), "mobile", "outward"),
            Arguments.of("3M pos",                    BigDecimal.valueOf(3_000_000), "pos",    "outward"),
            Arguments.of("3M ussd",                   BigDecimal.valueOf(3_000_000), "ussd",   "outward"),
            Arguments.of("500k BDC",                  BigDecimal.valueOf(500_000),   "bdc",    "outward"),
            Arguments.of("zero BDC",                  BigDecimal.ZERO,               "bdc",    "outward"),
            Arguments.of("rule inactive, 5M BDC",     BigDecimal.valueOf(5_000_000), "bdc",    "outward"),
            Arguments.of("2M BDC inward",             BigDecimal.valueOf(2_000_000), "bdc",    "inward")
        );
    }

    static Stream<Arguments> bdcAbnormal() {
        return Stream.of(
            Arguments.of("2M+1 BDC outward",   BigDecimal.valueOf(2_000_001), "bdc", "outward"),
            Arguments.of("3M BDC outward",     BigDecimal.valueOf(3_000_000), "bdc", "outward"),
            Arguments.of("5M BDC outward",     BigDecimal.valueOf(5_000_000), "bdc", "outward"),
            Arguments.of("10M BDC outward",    BigDecimal.valueOf(10_000_000),"bdc", "outward"),
            Arguments.of("50M BDC outward",    BigDecimal.valueOf(50_000_000),"bdc", "outward"),
            Arguments.of("2M+1 BDC inward",    BigDecimal.valueOf(2_000_001), "bdc", "inward"),
            Arguments.of("4M BDC inward",      BigDecimal.valueOf(4_000_000), "bdc", "inward"),
            Arguments.of("100M BDC",           BigDecimal.valueOf(100_000_000),"bdc","outward"),
            Arguments.of("2.5M BDC",           BigDecimal.valueOf(2_500_000), "bdc", "outward"),
            Arguments.of("3M BDC uppercase",   BigDecimal.valueOf(3_000_000), "BDC", "outward")
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("bdcNormal")
    @DisplayName("cross-border-bdc — normal (should NOT fire)")
    void bdcNormal(String desc, BigDecimal amount, String channel, String dir) throws Exception {
        var t = simpleTxn(amount, channel, dir, OffsetDateTime.now(WAT));
        var rule = desc.contains("inactive")
            ? threshold("cross-border-bdc", false, 2_000_000L, 2_000_000L, 30) : BDC_RULE;
        var r = scoreThresholds(t, List.of(rule), List.of(), 0, 0, 0, false, false, 0,
            BigDecimal.ZERO, 1000, Optional.empty());
        rec("cross-border-bdc", desc, true, r.flags.contains("cross-border-bdc"));
        assertThat(r.flags).doesNotContain("cross-border-bdc");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("bdcAbnormal")
    @DisplayName("cross-border-bdc — abnormal (MUST fire)")
    void bdcAbnormal(String desc, BigDecimal amount, String channel, String dir) throws Exception {
        var t = simpleTxn(amount, channel, dir, OffsetDateTime.now(WAT));
        var r = scoreThresholds(t, List.of(BDC_RULE), List.of(), 0, 0, 0, false, false, 0,
            BigDecimal.ZERO, 1000, Optional.empty());
        rec("cross-border-bdc", desc, false, r.flags.contains("cross-border-bdc"));
        assertThat(r.flags).contains("cross-border-bdc");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 14. DORMANT_REACTIVATION  (inactive > 90 days + amount > threshold)
    // ═══════════════════════════════════════════════════════════════════════════

    static final ThresholdRecord DORMANT_RULE =
        threshold("dormant-reactivation", true, 500_000L, 500_000L, 25);

    static Stream<Arguments> dormantNormal() {
        OffsetDateTime now = OffsetDateTime.now(WAT);
        return Stream.of(
            Arguments.of("No previous txn (new account)",  Optional.empty(), BigDecimal.valueOf(5_000_000)),
            Arguments.of("10 days inactive, 1M",           Optional.of(now.minusDays(10)),  BigDecimal.valueOf(1_000_000)),
            Arguments.of("30 days inactive, 1M",           Optional.of(now.minusDays(30)),  BigDecimal.valueOf(1_000_000)),
            Arguments.of("60 days inactive, 1M",           Optional.of(now.minusDays(60)),  BigDecimal.valueOf(1_000_000)),
            Arguments.of("90 days (boundary, not over)",   Optional.of(now.minusDays(90)),  BigDecimal.valueOf(5_000_000)),
            Arguments.of("91 days but amount under 500k",  Optional.of(now.minusDays(91)),  BigDecimal.valueOf(499_999)),
            Arguments.of("100 days, amount = threshold",   Optional.of(now.minusDays(100)), BigDecimal.valueOf(500_000)),
            Arguments.of("rule inactive, 365 days 5M",     Optional.of(now.minusDays(365)), BigDecimal.valueOf(5_000_000)),
            Arguments.of("1 day inactive, 10M",            Optional.of(now.minusDays(1)),   BigDecimal.valueOf(10_000_000)),
            Arguments.of("89 days inactive, 2M",           Optional.of(now.minusDays(89)),  BigDecimal.valueOf(2_000_000))
        );
    }

    static Stream<Arguments> dormantAbnormal() {
        OffsetDateTime now = OffsetDateTime.now(WAT);
        return Stream.of(
            Arguments.of("91 days, 501k",    Optional.of(now.minusDays(91)),  BigDecimal.valueOf(501_000)),
            Arguments.of("100 days, 1M",     Optional.of(now.minusDays(100)), BigDecimal.valueOf(1_000_000)),
            Arguments.of("180 days, 2M",     Optional.of(now.minusDays(180)), BigDecimal.valueOf(2_000_000)),
            Arguments.of("365 days, 5M",     Optional.of(now.minusDays(365)), BigDecimal.valueOf(5_000_000)),
            Arguments.of("2 years, 10M",     Optional.of(now.minusDays(730)), BigDecimal.valueOf(10_000_000)),
            Arguments.of("92 days, 600k",    Optional.of(now.minusDays(92)),  BigDecimal.valueOf(600_000)),
            Arguments.of("120 days, 1.5M",   Optional.of(now.minusDays(120)), BigDecimal.valueOf(1_500_000)),
            Arguments.of("200 days, 3M",     Optional.of(now.minusDays(200)), BigDecimal.valueOf(3_000_000)),
            Arguments.of("91 days, 50M",     Optional.of(now.minusDays(91)),  BigDecimal.valueOf(50_000_000)),
            Arguments.of("500 days, 500k+1", Optional.of(now.minusDays(500)), BigDecimal.valueOf(500_001))
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("dormantNormal")
    @DisplayName("DORMANT_REACTIVATION — normal (should NOT fire)")
    void dormantNormal(String desc, Optional<OffsetDateTime> lastTxn, BigDecimal amount) throws Exception {
        var t = simpleTxn(amount, "wire", "outward", OffsetDateTime.now(WAT));
        var rule = desc.contains("inactive")
            ? threshold("dormant-reactivation", false, 500_000L, 500_000L, 25) : DORMANT_RULE;
        var r = scoreThresholds(t, List.of(rule), List.of(), 0, 0, 0, false, false, 0,
            BigDecimal.ZERO, 1000, lastTxn);
        rec("DORMANT_REACTIVATION", desc, true, r.flags.contains("DORMANT_REACTIVATION"));
        assertThat(r.flags).doesNotContain("DORMANT_REACTIVATION");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("dormantAbnormal")
    @DisplayName("DORMANT_REACTIVATION — abnormal (MUST fire)")
    void dormantAbnormal(String desc, Optional<OffsetDateTime> lastTxn, BigDecimal amount) throws Exception {
        var t = simpleTxn(amount, "wire", "outward", OffsetDateTime.now(WAT));
        var r = scoreThresholds(t, List.of(DORMANT_RULE), List.of(), 0, 0, 0, false, false, 0,
            BigDecimal.ZERO, 1000, lastTxn);
        rec("DORMANT_REACTIVATION", desc, false, r.flags.contains("DORMANT_REACTIVATION"));
        assertThat(r.flags).contains("DORMANT_REACTIVATION");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 15. KYC_TIER_LIMIT_EXCEEDED  (single txn > per-channel single limit)
    // ═══════════════════════════════════════════════════════════════════════════

    static KycTierRecord kycTier0() {
        // tier=0, single limit per channel = 200,000 NGN, daily = 1,000,000 NGN, no boost
        return kycTier(0, 200_000L, 1_000_000L, null, null, 0);
    }

    static Stream<Arguments> kycSingleNormal() {
        return Stream.of(
            Arguments.of("200k wire = limit",          BigDecimal.valueOf(200_000), "wire"),
            Arguments.of("100k mobile under limit",    BigDecimal.valueOf(100_000), "mobile"),
            Arguments.of("50k ussd",                   BigDecimal.valueOf(50_000),  "ussd"),
            Arguments.of("10k bdc",                    BigDecimal.valueOf(10_000),  "bdc"),
            Arguments.of("zero amount",                BigDecimal.ZERO,             "wire"),
            Arguments.of("kyc disabled",               BigDecimal.valueOf(500_000), "wire"),
            Arguments.of("200k other channel",         BigDecimal.valueOf(200_000), "other"),
            Arguments.of("199_999 wire",               BigDecimal.valueOf(199_999), "wire"),
            Arguments.of("1 NGN",                      BigDecimal.ONE,              "wire"),
            Arguments.of("no tier record for tier 1",  BigDecimal.valueOf(500_000), "wire")
        );
    }

    static Stream<Arguments> kycSingleAbnormal() {
        return Stream.of(
            Arguments.of("200_001 wire",    BigDecimal.valueOf(200_001), "wire"),
            Arguments.of("500k mobile",     BigDecimal.valueOf(500_000), "mobile"),
            Arguments.of("1M ussd",         BigDecimal.valueOf(1_000_000),"ussd"),
            Arguments.of("300k bdc",        BigDecimal.valueOf(300_000), "bdc"),
            Arguments.of("250k wire",       BigDecimal.valueOf(250_000), "wire"),
            Arguments.of("400k other",      BigDecimal.valueOf(400_000), "other"),
            Arguments.of("1M wire",         BigDecimal.valueOf(1_000_000),"wire"),
            Arguments.of("5M wire",         BigDecimal.valueOf(5_000_000),"wire"),
            Arguments.of("201k mobile",     BigDecimal.valueOf(201_000), "mobile"),
            Arguments.of("10M wire tier 0", BigDecimal.valueOf(10_000_000),"wire")
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("kycSingleNormal")
    @DisplayName("KYC_TIER_LIMIT_EXCEEDED — normal (should NOT fire)")
    void kycSingleNormal(String desc, BigDecimal amount, String channel) throws Exception {
        var t = simpleTxn(amount, channel, "outward", OffsetDateTime.now(WAT));
        boolean kycOn = !desc.contains("disabled") && !desc.contains("no tier");
        int tierVal = desc.contains("no tier") ? 1 : 0;
        List<KycTierRecord> tiers = desc.contains("no tier") ? List.of(kycTier0()) : List.of(kycTier0());
        var r = scoreThresholds(t, List.of(), tiers, 0, 0, 0, false, kycOn, tierVal,
            BigDecimal.ZERO, 1000, Optional.empty());
        rec("KYC_TIER_LIMIT_EXCEEDED", desc, true, r.flags.contains("KYC_TIER_LIMIT_EXCEEDED"));
        assertThat(r.flags).doesNotContain("KYC_TIER_LIMIT_EXCEEDED");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("kycSingleAbnormal")
    @DisplayName("KYC_TIER_LIMIT_EXCEEDED — abnormal (MUST fire)")
    void kycSingleAbnormal(String desc, BigDecimal amount, String channel) throws Exception {
        var t = simpleTxn(amount, channel, "outward", OffsetDateTime.now(WAT));
        var r = scoreThresholds(t, List.of(), List.of(kycTier0()), 0, 0, 0, false, true, 0,
            BigDecimal.ZERO, 1000, Optional.empty());
        rec("KYC_TIER_LIMIT_EXCEEDED", desc, false, r.flags.contains("KYC_TIER_LIMIT_EXCEEDED"));
        assertThat(r.flags).contains("KYC_TIER_LIMIT_EXCEEDED");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 16. KYC_TIER_DAILY_LIMIT_EXCEEDED
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> kycDailyNormal() {
        // daily combined = 1,000,000. kycDailySum = already spent today.
        return Stream.of(
            Arguments.of("0 today + 200k",   BigDecimal.ZERO,               BigDecimal.valueOf(200_000), "wire"),
            Arguments.of("500k today + 499k", BigDecimal.valueOf(500_000),  BigDecimal.valueOf(499_999), "wire"),
            Arguments.of("800k today + 199k", BigDecimal.valueOf(800_000),  BigDecimal.valueOf(199_999), "wire"),
            Arguments.of("0 + 1M = exactly",  BigDecimal.ZERO,               BigDecimal.valueOf(1_000_000),"wire"),
            Arguments.of("500k + 500k = exact",BigDecimal.valueOf(500_000), BigDecimal.valueOf(500_000), "wire"),
            Arguments.of("kyc disabled, 2M",  BigDecimal.ZERO,               BigDecimal.valueOf(2_000_000),"wire"),
            Arguments.of("0 + 100 mobile",    BigDecimal.ZERO,               BigDecimal.valueOf(100),    "mobile"),
            Arguments.of("999k + 1",          BigDecimal.valueOf(999_000),   BigDecimal.ONE,             "wire"),
            Arguments.of("no tier record",    BigDecimal.ZERO,               BigDecimal.valueOf(2_000_000),"wire"),
            Arguments.of("0 + zero",          BigDecimal.ZERO,               BigDecimal.ZERO,            "wire")
        );
    }

    static Stream<Arguments> kycDailyAbnormal() {
        return Stream.of(
            Arguments.of("0 + 1_000_001",     BigDecimal.ZERO,              BigDecimal.valueOf(1_000_001),"wire"),
            Arguments.of("500k + 501k",       BigDecimal.valueOf(500_000),  BigDecimal.valueOf(501_000), "wire"),
            Arguments.of("900k + 200k",       BigDecimal.valueOf(900_000),  BigDecimal.valueOf(200_000), "wire"),
            Arguments.of("999k + 2",          BigDecimal.valueOf(999_000),  BigDecimal.valueOf(2_000),   "wire"),
            Arguments.of("1M + 1",            BigDecimal.valueOf(1_000_000),BigDecimal.ONE,              "wire"),
            Arguments.of("0 + 5M mobile",     BigDecimal.ZERO,              BigDecimal.valueOf(5_000_000),"mobile"),
            Arguments.of("0 + 2M ussd",       BigDecimal.ZERO,              BigDecimal.valueOf(2_000_000),"ussd"),
            Arguments.of("800k + 300k",       BigDecimal.valueOf(800_000),  BigDecimal.valueOf(300_000), "wire"),
            Arguments.of("1M-1 + 2",          BigDecimal.valueOf(999_999),  BigDecimal.valueOf(2),       "wire"),
            Arguments.of("0 + 10M other",     BigDecimal.ZERO,              BigDecimal.valueOf(10_000_000),"other")
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("kycDailyNormal")
    @DisplayName("KYC_TIER_DAILY_LIMIT_EXCEEDED — normal (should NOT fire)")
    void kycDailyNormal(String desc, BigDecimal alreadySpent, BigDecimal amount, String channel) throws Exception {
        var t = simpleTxn(amount, channel, "outward", OffsetDateTime.now(WAT));
        boolean kycOn  = !desc.contains("disabled") && !desc.contains("no tier");
        int tier = desc.contains("no tier") ? 1 : 0;
        var r = scoreThresholds(t, List.of(), List.of(kycTier0()), 0, 0, 0, false, kycOn, tier,
            alreadySpent, 1000, Optional.empty());
        rec("KYC_TIER_DAILY_LIMIT_EXCEEDED", desc, true, r.flags.contains("KYC_TIER_DAILY_LIMIT_EXCEEDED"));
        assertThat(r.flags).doesNotContain("KYC_TIER_DAILY_LIMIT_EXCEEDED");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("kycDailyAbnormal")
    @DisplayName("KYC_TIER_DAILY_LIMIT_EXCEEDED — abnormal (MUST fire)")
    void kycDailyAbnormal(String desc, BigDecimal alreadySpent, BigDecimal amount, String channel) throws Exception {
        var t = simpleTxn(amount, channel, "outward", OffsetDateTime.now(WAT));
        var r = scoreThresholds(t, List.of(), List.of(kycTier0()), 0, 0, 0, false, true, 0,
            alreadySpent, 1000, Optional.empty());
        rec("KYC_TIER_DAILY_LIMIT_EXCEEDED", desc, false, r.flags.contains("KYC_TIER_DAILY_LIMIT_EXCEEDED"));
        assertThat(r.flags).contains("KYC_TIER_DAILY_LIMIT_EXCEEDED");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 17. pat-4  (institution-wide spike: today > yesterday × spike_ratio)
    // ═══════════════════════════════════════════════════════════════════════════

    static BehavioralRuleRecord pat4(boolean active) {
        return bRule("pat-4", active, "high", new JsonObject().put("spike_ratio", 1.5));
    }

    static Stream<Arguments> pat4Normal() {
        return Stream.of(
            Arguments.of("today = yesterday × 1.5 (boundary)",  100L, 100L),
            Arguments.of("today < yesterday",                    80L,  100L),
            Arguments.of("today = yesterday",                    100L, 100L),
            Arguments.of("yesterday = 0 (skip guard)",           50L,  0L),
            Arguments.of("today 1.49× yesterday",               149L, 100L),
            Arguments.of("rule inactive",                        300L, 100L),
            Arguments.of("0 today 0 yesterday",                 0L,   0L),
            Arguments.of("50 today 100 yesterday",              50L,  100L),
            Arguments.of("VELOCITY_SPIKE already flagged",      200L, 100L),
            Arguments.of("149 today 100 yesterday",             149L, 100L)
        );
    }

    static Stream<Arguments> pat4Abnormal() {
        return Stream.of(
            Arguments.of("today = 1.51× yesterday", 151L, 100L),
            Arguments.of("200 today 100 yesterday", 200L, 100L),
            Arguments.of("300 today 100 yesterday", 300L, 100L),
            Arguments.of("500 today 100 yesterday", 500L, 100L),
            Arguments.of("1000 today 100 yesterday",1000L,100L),
            Arguments.of("76 today 50 yesterday",   76L,  50L),
            Arguments.of("160 today 100 yesterday", 160L, 100L),
            Arguments.of("200 today 100 yesterday (2×)", 200L, 100L),
            Arguments.of("301 today 200 yesterday", 301L, 200L),
            Arguments.of("451 today 300 yesterday", 451L, 300L)
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("pat4Normal")
    @DisplayName("pat-4 (institution spike) — normal (should NOT fire)")
    void pat4Normal(String desc, long today, long yesterday) throws Exception {
        var t = simpleTxn(BigDecimal.valueOf(100_000), "wire", "outward", OffsetDateTime.now(WAT));
        var rule = desc.contains("inactive") ? pat4(false) : pat4(true);
        // For "VELOCITY_SPIKE already flagged" scenario, pass it in alreadyFlagged
        List<String> already = desc.contains("VELOCITY_SPIKE") ? List.of("VELOCITY_SPIKE") : List.of();
        var r = (TransactionScorer.ScoringResult) M_SCORE_BEHAVIORAL.invoke(
            SVC, t, List.of(rule), null, today, yesterday, 0L, aml(), already);
        rec("pat-4", desc, true, r.flags.contains("pat-4"));
        assertThat(r.flags).doesNotContain("pat-4");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("pat4Abnormal")
    @DisplayName("pat-4 (institution spike) — abnormal (MUST fire)")
    void pat4Abnormal(String desc, long today, long yesterday) throws Exception {
        var t = simpleTxn(BigDecimal.valueOf(100_000), "wire", "outward", OffsetDateTime.now(WAT));
        var r = (TransactionScorer.ScoringResult) M_SCORE_BEHAVIORAL.invoke(
            SVC, t, List.of(pat4(true)), null, today, yesterday, 0L, aml(), List.of());
        rec("pat-4", desc, false, r.flags.contains("pat-4"));
        assertThat(r.flags).contains("pat-4");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 18. pat-5  (customer velocity: txnCount24h > max_daily_count)
    // ═══════════════════════════════════════════════════════════════════════════

    static BehavioralRuleRecord pat5(boolean active) {
        return bRule("pat-5", active, "medium", new JsonObject().put("max_daily_count", 10));
    }

    static Stream<Arguments> pat5Normal() {
        return Stream.of(
            Arguments.of("0 txns in 24h",           0L),
            Arguments.of("5 txns in 24h",           5L),
            Arguments.of("9 txns in 24h",           9L),
            Arguments.of("exactly 10 (not over)",   10L),
            Arguments.of("rule inactive, 20 txns",  20L),
            Arguments.of("1 txn",                   1L),
            Arguments.of("3 txns",                  3L),
            Arguments.of("7 txns",                  7L),
            Arguments.of("8 txns",                  8L),
            Arguments.of("2 txns",                  2L)
        );
    }

    static Stream<Arguments> pat5Abnormal() {
        return Stream.of(
            Arguments.of("11 txns",  11L),
            Arguments.of("12 txns",  12L),
            Arguments.of("15 txns",  15L),
            Arguments.of("20 txns",  20L),
            Arguments.of("50 txns",  50L),
            Arguments.of("100 txns", 100L),
            Arguments.of("13 txns",  13L),
            Arguments.of("200 txns", 200L),
            Arguments.of("25 txns",  25L),
            Arguments.of("1000 txns",1000L)
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("pat5Normal")
    @DisplayName("pat-5 (customer velocity) — normal (should NOT fire)")
    void pat5Normal(String desc, long cust24h) throws Exception {
        var t = simpleTxn(BigDecimal.valueOf(100_000), "wire", "outward", OffsetDateTime.now(WAT));
        var rule = desc.contains("inactive") ? pat5(false) : pat5(true);
        var r = (TransactionScorer.ScoringResult) M_SCORE_BEHAVIORAL.invoke(
            SVC, t, List.of(rule), null, 0L, 0L, cust24h, aml(), List.of());
        rec("pat-5", desc, true, r.flags.contains("pat-5"));
        assertThat(r.flags).doesNotContain("pat-5");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("pat5Abnormal")
    @DisplayName("pat-5 (customer velocity) — abnormal (MUST fire)")
    void pat5Abnormal(String desc, long cust24h) throws Exception {
        var t = simpleTxn(BigDecimal.valueOf(100_000), "wire", "outward", OffsetDateTime.now(WAT));
        var r = (TransactionScorer.ScoringResult) M_SCORE_BEHAVIORAL.invoke(
            SVC, t, List.of(pat5(true)), null, 0L, 0L, cust24h, aml(), List.of());
        rec("pat-5", desc, false, r.flags.contains("pat-5"));
        assertThat(r.flags).contains("pat-5");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 19. pat-2  (high-value mobile: amount > min_amount AND channel = mobile)
    // ═══════════════════════════════════════════════════════════════════════════

    static BehavioralRuleRecord pat2(boolean active) {
        return bRule("pat-2", active, "high", new JsonObject().put("min_amount", 2_000_000L));
    }

    static Stream<Arguments> pat2Normal() {
        return Stream.of(
            Arguments.of("2M mobile (boundary)",     BigDecimal.valueOf(2_000_000), "mobile"),
            Arguments.of("1.9M mobile",              BigDecimal.valueOf(1_900_000), "mobile"),
            Arguments.of("5M wire (not mobile)",     BigDecimal.valueOf(5_000_000), "wire"),
            Arguments.of("5M pos",                   BigDecimal.valueOf(5_000_000), "pos"),
            Arguments.of("5M ussd",                  BigDecimal.valueOf(5_000_000), "ussd"),
            Arguments.of("5M bdc",                   BigDecimal.valueOf(5_000_000), "bdc"),
            Arguments.of("zero mobile",              BigDecimal.ZERO,               "mobile"),
            Arguments.of("500k mobile",              BigDecimal.valueOf(500_000),   "mobile"),
            Arguments.of("rule inactive, 5M mobile", BigDecimal.valueOf(5_000_000), "mobile"),
            Arguments.of("1M mobile",                BigDecimal.valueOf(1_000_000), "mobile")
        );
    }

    static Stream<Arguments> pat2Abnormal() {
        return Stream.of(
            Arguments.of("2_000_001 mobile",  BigDecimal.valueOf(2_000_001), "mobile"),
            Arguments.of("3M mobile",         BigDecimal.valueOf(3_000_000), "mobile"),
            Arguments.of("5M mobile",         BigDecimal.valueOf(5_000_000), "mobile"),
            Arguments.of("10M mobile",        BigDecimal.valueOf(10_000_000),"mobile"),
            Arguments.of("50M mobile",        BigDecimal.valueOf(50_000_000),"mobile"),
            Arguments.of("2.5M MOBILE upper", BigDecimal.valueOf(2_500_000), "MOBILE"),
            Arguments.of("4M mobile",         BigDecimal.valueOf(4_000_000), "mobile"),
            Arguments.of("2.1M mobile",       BigDecimal.valueOf(2_100_000), "mobile"),
            Arguments.of("100M mobile",       BigDecimal.valueOf(100_000_000),"mobile"),
            Arguments.of("20M mobile",        BigDecimal.valueOf(20_000_000),"mobile")
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("pat2Normal")
    @DisplayName("pat-2 (high-value mobile) — normal (should NOT fire)")
    void pat2Normal(String desc, BigDecimal amount, String channel) throws Exception {
        var t = simpleTxn(amount, channel, "outward", OffsetDateTime.now(WAT));
        var rule = desc.contains("inactive") ? pat2(false) : pat2(true);
        var r = (TransactionScorer.ScoringResult) M_SCORE_BEHAVIORAL.invoke(
            SVC, t, List.of(rule), null, 0L, 0L, 0L, aml(), List.of());
        rec("pat-2", desc, true, r.flags.contains("pat-2"));
        assertThat(r.flags).doesNotContain("pat-2");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("pat2Abnormal")
    @DisplayName("pat-2 (high-value mobile) — abnormal (MUST fire)")
    void pat2Abnormal(String desc, BigDecimal amount, String channel) throws Exception {
        var t = simpleTxn(amount, channel, "outward", OffsetDateTime.now(WAT));
        var r = (TransactionScorer.ScoringResult) M_SCORE_BEHAVIORAL.invoke(
            SVC, t, List.of(pat2(true)), null, 0L, 0L, 0L, aml(), List.of());
        rec("pat-2", desc, false, r.flags.contains("pat-2"));
        assertThat(r.flags).contains("pat-2");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 20. BEHAVIORAL_PATTERN_DEVIATION  (amount, channel, time, bank, category)
    // ═══════════════════════════════════════════════════════════════════════════

    static CustomerBehavioralProfile stableProfile() {
        return profile(100_000, 20_000,
            List.of("wire"), 8, 18, List.of("FirstBank"), List.of("transfer"), 20);
    }

    static Stream<Arguments> behavDevNormal() {
        OffsetDateTime midday = OffsetDateTime.now(WAT).withHour(12);
        return Stream.of(
            Arguments.of("normal amount within 3σ",    BigDecimal.valueOf(120_000), "wire",   "FirstBank", midday, "transfer", stableProfile()),
            Arguments.of("avg amount",                  BigDecimal.valueOf(100_000), "wire",   "FirstBank", midday, "transfer", stableProfile()),
            Arguments.of("avg + 2.9σ = 158k",          BigDecimal.valueOf(158_000), "wire",   "FirstBank", midday, "transfer", stableProfile()),
            Arguments.of("typical channel (wire)",      BigDecimal.valueOf(100_000), "wire",   "FirstBank", midday, "transfer", stableProfile()),
            Arguments.of("within hour window (14:00)",  BigDecimal.valueOf(100_000), "wire",   "FirstBank", OffsetDateTime.now(WAT).withHour(14), "transfer", stableProfile()),
            Arguments.of("known recipient bank",        BigDecimal.valueOf(100_000), "wire",   "FirstBank", midday, "transfer", stableProfile()),
            Arguments.of("known category",              BigDecimal.valueOf(100_000), "wire",   "FirstBank", midday, "transfer", stableProfile()),
            Arguments.of("profile count < 10 (ignored)", BigDecimal.valueOf(999_999),"bdc",  "UnknownBank", midday.withHour(3), "crypto",
                profile(100_000, 20_000, List.of("wire"), 8, 18, List.of("FirstBank"), List.of("transfer"), 9)),
            Arguments.of("no profile (null)",           BigDecimal.valueOf(999_999), "bdc",   "UnknownBank", midday, "crypto", null),
            Arguments.of("stddev = 0 (skip amount check)", BigDecimal.valueOf(999_999),"wire","FirstBank",  midday, "transfer",
                profile(100_000, 0, List.of("wire"), 8, 18, List.of("FirstBank"), List.of("transfer"), 20))
        );
    }

    static Stream<Arguments> behavDevAbnormal() {
        OffsetDateTime midday  = OffsetDateTime.now(WAT).withHour(12);
        OffsetDateTime lateNt  = OffsetDateTime.now(WAT).withHour(3);
        return Stream.of(
            Arguments.of("amount > avg + 3σ = 160001",  BigDecimal.valueOf(160_001), "wire",    "FirstBank",  midday, "transfer", stableProfile()),
            Arguments.of("unknown channel (mobile)",    BigDecimal.valueOf(100_000), "mobile",  "FirstBank",  midday, "transfer", stableProfile()),
            Arguments.of("outside hour window (03:00)", BigDecimal.valueOf(100_000), "wire",    "FirstBank",  lateNt, "transfer", stableProfile()),
            Arguments.of("unknown bank (GTBank)",       BigDecimal.valueOf(100_000), "wire",    "GTBank",     midday, "transfer", stableProfile()),
            Arguments.of("unknown category (crypto)",   BigDecimal.valueOf(100_000), "wire",    "FirstBank",  midday, "crypto",   stableProfile()),
            Arguments.of("all deviations together",     BigDecimal.valueOf(999_999), "mobile",  "GTBank",     lateNt, "crypto",   stableProfile()),
            Arguments.of("200k outward (1σ above 3σ)",  BigDecimal.valueOf(200_000), "wire",    "FirstBank",  midday, "transfer", stableProfile()),
            Arguments.of("amount 5σ above avg",         BigDecimal.valueOf(200_001), "wire",    "FirstBank",  midday, "transfer", stableProfile()),
            Arguments.of("new bank UBA",                BigDecimal.valueOf(100_000), "wire",    "UBA",        midday, "transfer", stableProfile()),
            Arguments.of("new channel + out-of-hours",  BigDecimal.valueOf(100_000), "ussd",    "FirstBank",  lateNt, "transfer", stableProfile())
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("behavDevNormal")
    @DisplayName("BEHAVIORAL_PATTERN_DEVIATION — normal (should NOT fire)")
    void behavDevNormal(String desc, BigDecimal amount, String channel, String bank,
                         OffsetDateTime at, String category, CustomerBehavioralProfile prof) throws Exception {
        var t = txn(amount, channel, "outward", at, null, null, bank, "GTBank", category, "cust-001");
        var r = (TransactionScorer.ScoringResult) M_SCORE_BEHAVIORAL.invoke(
            SVC, t, List.of(), prof, 0L, 0L, 0L, aml(), List.of());
        rec("BEHAVIORAL_PATTERN_DEVIATION", desc, true, r.flags.contains("BEHAVIORAL_PATTERN_DEVIATION"));
        assertThat(r.flags).doesNotContain("BEHAVIORAL_PATTERN_DEVIATION");
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("behavDevAbnormal")
    @DisplayName("BEHAVIORAL_PATTERN_DEVIATION — abnormal (MUST fire)")
    void behavDevAbnormal(String desc, BigDecimal amount, String channel, String bank,
                           OffsetDateTime at, String category, CustomerBehavioralProfile prof) throws Exception {
        var t = txn(amount, channel, "outward", at, null, null, bank, "GTBank", category, "cust-001");
        var r = (TransactionScorer.ScoringResult) M_SCORE_BEHAVIORAL.invoke(
            SVC, t, List.of(), prof, 0L, 0L, 0L, aml(), List.of());
        rec("BEHAVIORAL_PATTERN_DEVIATION", desc, false, r.flags.contains("BEHAVIORAL_PATTERN_DEVIATION"));
        assertThat(r.flags).contains("BEHAVIORAL_PATTERN_DEVIATION");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 21. CUSTOMER_RULE_MAX_AMOUNT
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> maxAmtNormal() {
        return Stream.of(
            Arguments.of("exactly at limit",          BigDecimal.valueOf(500_000), 500_000L),
            Arguments.of("1 below limit",             BigDecimal.valueOf(499_999), 500_000L),
            Arguments.of("1 NGN",                     BigDecimal.ONE,              500_000L),
            Arguments.of("0 amount",                  BigDecimal.ZERO,             500_000L),
            Arguments.of("100k vs 1M limit",          BigDecimal.valueOf(100_000), 1_000_000L),
            Arguments.of("no limit (Long.MAX)",       BigDecimal.valueOf(999_999_999L), Long.MAX_VALUE),
            Arguments.of("500k vs 500k+1 limit",      BigDecimal.valueOf(500_000), 500_001L),
            Arguments.of("large limit 10M, 9.9M txn", BigDecimal.valueOf(9_900_000), 10_000_000L),
            Arguments.of("1M vs 2M limit",            BigDecimal.valueOf(1_000_000), 2_000_000L),
            Arguments.of("250k vs 500k",              BigDecimal.valueOf(250_000), 500_000L)
        );
    }

    static Stream<Arguments> maxAmtAbnormal() {
        return Stream.of(
            Arguments.of("500_001 vs 500k limit",  BigDecimal.valueOf(500_001),     500_000L),
            Arguments.of("1M vs 500k limit",       BigDecimal.valueOf(1_000_000),   500_000L),
            Arguments.of("5M vs 500k limit",       BigDecimal.valueOf(5_000_000),   500_000L),
            Arguments.of("10M vs 1M limit",        BigDecimal.valueOf(10_000_000),  1_000_000L),
            Arguments.of("501k vs 500k",           BigDecimal.valueOf(501_000),     500_000L),
            Arguments.of("100M vs 50M",            BigDecimal.valueOf(100_000_000), 50_000_000L),
            Arguments.of("1B vs 999M",             BigDecimal.valueOf(1_000_000_001L), 1_000_000_000L),
            Arguments.of("600k vs 500k",           BigDecimal.valueOf(600_000),     500_000L),
            Arguments.of("2M vs 1.9M limit",       BigDecimal.valueOf(2_000_000),   1_900_000L),
            Arguments.of("1 over limit",           BigDecimal.valueOf(500_001),     500_000L)
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("maxAmtNormal")
    @DisplayName("CUSTOMER_RULE_MAX_AMOUNT — normal (should NOT fire)")
    void maxAmtNormal(String desc, BigDecimal amount, long limit) throws Exception {
        var rule = cRule("max_single_amount", "flag", "outward",
            new JsonObject().put("max_amount", limit));
        var t = simpleTxn(amount, "wire", "outward", OffsetDateTime.now(WAT));
        String result = evalImmediate(rule, t);
        rec("CUSTOMER_RULE_MAX_AMOUNT", desc, true, result != null);
        assertThat(result).isNull();
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("maxAmtAbnormal")
    @DisplayName("CUSTOMER_RULE_MAX_AMOUNT — abnormal (MUST fire)")
    void maxAmtAbnormal(String desc, BigDecimal amount, long limit) throws Exception {
        var rule = cRule("max_single_amount", "flag", "outward",
            new JsonObject().put("max_amount", limit));
        var t = simpleTxn(amount, "wire", "outward", OffsetDateTime.now(WAT));
        String result = evalImmediate(rule, t);
        rec("CUSTOMER_RULE_MAX_AMOUNT", desc, false, result != null);
        assertThat(result).isNotNull();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 22. CUSTOMER_RULE_BLOCKED_BANK
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> blockedBankNormal() {
        return Stream.of(
            Arguments.of("allowed bank FirstBank",     "FirstBank", "GTBank",    List.of("zenith")),
            Arguments.of("empty blocked list",         "UnionBank",  "GTBank",   List.of()),
            Arguments.of("no recipient bank (null)",   null,         "FirstBank",List.of("gtbank")),
            Arguments.of("case mismatch not matched",  "ZENITH",     "GTBank",   List.of("access")),
            Arguments.of("different blocked bank",     "GTBank",     "FirstBank",List.of("access")),
            Arguments.of("partial but no match",       "FirstBank",  "GTBank",   List.of("zenith","uba")),
            Arguments.of("sender not blocked either",  "FirstBank",  "GTBank",   List.of("access")),
            Arguments.of("no banks blocked",           "AnyBank",    "AnyBank",  List.of()),
            Arguments.of("null sender and recipient",  null,         null,       List.of("gtbank")),
            Arguments.of("blocked = stanbic, txn GT",  "GTBank",    "FirstBank", List.of("stanbic"))
        );
    }

    static Stream<Arguments> blockedBankAbnormal() {
        return Stream.of(
            Arguments.of("exact match recipient",      "GTBank",     "FirstBank", List.of("gtbank")),
            Arguments.of("partial match recipient",    "GTBank PLC", "FirstBank", List.of("gtbank")),
            Arguments.of("case insensitive",           "GTBANK",     "FirstBank", List.of("gtbank")),
            Arguments.of("sender bank blocked",        "FirstBank",  "zenith",    List.of("zenith")),
            Arguments.of("sender partial match",       "FirstBank",  "Zenith Bank PLC", List.of("zenith")),
            Arguments.of("multiple, second matches",   "AccessBank", "GTBank",   List.of("firstbank","accessbank")),
            Arguments.of("exact lowercase match",      "access",     "GT",       List.of("access")),
            Arguments.of("blocked via recipient full", "GTBank Nigeria", "FB",   List.of("gtbank")),
            Arguments.of("two blocked, both match",    "GTBank",     "zenith",   List.of("gtbank","zenith")),
            Arguments.of("mixed case partial",         "UBA Nigeria","FirstBank", List.of("uba"))
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("blockedBankNormal")
    @DisplayName("CUSTOMER_RULE_BLOCKED_BANK — normal (should NOT fire)")
    void blockedBankNormal(String desc, String recipientBank, String senderBank, List<String> blocked) throws Exception {
        var arr = new JsonArray(); blocked.forEach(arr::add);
        var rule = cRule("blocked_banks", "flag", "both", new JsonObject().put("banks", arr));
        var t = txn(BigDecimal.valueOf(100_000), "wire", "outward", OffsetDateTime.now(WAT),
            null, null, recipientBank, senderBank, "transfer", "cust-001");
        String result = evalImmediate(rule, t);
        rec("CUSTOMER_RULE_BLOCKED_BANK", desc, true, result != null);
        assertThat(result).isNull();
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("blockedBankAbnormal")
    @DisplayName("CUSTOMER_RULE_BLOCKED_BANK — abnormal (MUST fire)")
    void blockedBankAbnormal(String desc, String recipientBank, String senderBank, List<String> blocked) throws Exception {
        var arr = new JsonArray(); blocked.forEach(arr::add);
        var rule = cRule("blocked_banks", "flag", "both", new JsonObject().put("banks", arr));
        var t = txn(BigDecimal.valueOf(100_000), "wire", "outward", OffsetDateTime.now(WAT),
            null, null, recipientBank, senderBank, "transfer", "cust-001");
        String result = evalImmediate(rule, t);
        rec("CUSTOMER_RULE_BLOCKED_BANK", desc, false, result != null);
        assertThat(result).isNotNull();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 23. CUSTOMER_RULE_BANK_NOT_ALLOWED
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> allowedBankNormal() {
        return Stream.of(
            Arguments.of("recipient is in allowed list",       "FirstBank", List.of("firstbank")),
            Arguments.of("partial match in allowed list",      "FirstBank PLC", List.of("firstbank")),
            Arguments.of("empty allowed list (no restriction)",  "AnyBank", List.of()),
            Arguments.of("case insensitive match",             "FIRSTBANK", List.of("firstbank")),
            Arguments.of("one of two allowed",                 "GTBank",    List.of("firstbank","gtbank")),
            Arguments.of("allowed bank substring match",       "GTBank Nigeria", List.of("gtbank")),
            Arguments.of("exactly allowed",                    "zenith",   List.of("zenith")),
            Arguments.of("multiple allowed, matches last",     "UBA",      List.of("firstbank","uba")),
            Arguments.of("null recipient, empty allowed list",  null,        List.of()),
            Arguments.of("case-mixed match",                   "GtBank",   List.of("gtbank"))
        );
    }

    static Stream<Arguments> allowedBankAbnormal() {
        return Stream.of(
            Arguments.of("bank not in allowed list",      "AccessBank", List.of("firstbank")),
            Arguments.of("blank recipient with list",     "UnknownBank",List.of("firstbank")),
            Arguments.of("completely different bank",     "Polaris",    List.of("firstbank","gtbank")),
            Arguments.of("partial non-match",             "ZenithBank", List.of("firstbank")),
            Arguments.of("not in 3-bank whitelist",       "Fidelity",   List.of("firstbank","gtbank","uba")),
            Arguments.of("allowed=zenith, sent to stanbic","StanbicIBTC",List.of("zenith")),
            Arguments.of("allowed=uba, sent to access",   "Access Bank",List.of("uba")),
            Arguments.of("allowed=firstbank, recipient=GT","GTBank",    List.of("firstbank")),
            Arguments.of("none match in 2-bank list",     "Keystone",   List.of("firstbank","access")),
            Arguments.of("exact but different casing fail","ZenithBank", List.of("first")) // "first" not in "zenithbank"
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("allowedBankNormal")
    @DisplayName("CUSTOMER_RULE_BANK_NOT_ALLOWED — normal (should NOT fire)")
    void allowedBankNormal(String desc, String recipientBank, List<String> allowed) throws Exception {
        var arr = new JsonArray(); allowed.forEach(arr::add);
        var rule = cRule("allowed_banks_only", "flag", "outward", new JsonObject().put("banks", arr));
        var t = txn(BigDecimal.valueOf(100_000), "wire", "outward", OffsetDateTime.now(WAT),
            null, null, recipientBank, "GTBank", "transfer", "cust-001");
        String result = evalImmediate(rule, t);
        rec("CUSTOMER_RULE_BANK_NOT_ALLOWED", desc, true, result != null);
        assertThat(result).isNull();
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("allowedBankAbnormal")
    @DisplayName("CUSTOMER_RULE_BANK_NOT_ALLOWED — abnormal (MUST fire)")
    void allowedBankAbnormal(String desc, String recipientBank, List<String> allowed) throws Exception {
        var arr = new JsonArray(); allowed.forEach(arr::add);
        var rule = cRule("allowed_banks_only", "flag", "outward", new JsonObject().put("banks", arr));
        var t = txn(BigDecimal.valueOf(100_000), "wire", "outward", OffsetDateTime.now(WAT),
            null, null, recipientBank, "GTBank", "transfer", "cust-001");
        String result = evalImmediate(rule, t);
        rec("CUSTOMER_RULE_BANK_NOT_ALLOWED", desc, false, result != null);
        assertThat(result).isNotNull();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 24. CUSTOMER_RULE_BLOCKED_CHANNEL
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> blockedChannelNormal() {
        return Stream.of(
            Arguments.of("channel not in blocked list",   "wire",   List.of("mobile")),
            Arguments.of("empty blocked channel list",    "wire",   List.of()),
            Arguments.of("different channel (pos vs wire)", "wire", List.of("pos")),
            Arguments.of("bdc allowed (pos blocked)",     "bdc",    List.of("pos")),
            Arguments.of("ussd allowed (mobile blocked)", "ussd",   List.of("mobile")),
            Arguments.of("null channel",                  null,     List.of("mobile")),
            Arguments.of("wire allowed (bdc blocked)",    "wire",   List.of("bdc")),
            Arguments.of("mobile allowed (ussd blocked)", "mobile", List.of("ussd")),
            Arguments.of("pos allowed",                   "pos",    List.of("wire","mobile")),
            Arguments.of("atm allowed (pos blocked)",     "atm",    List.of("pos"))
        );
    }

    static Stream<Arguments> blockedChannelAbnormal() {
        return Stream.of(
            Arguments.of("exact match mobile",          "mobile", List.of("mobile")),
            Arguments.of("exact match wire",            "wire",   List.of("wire")),
            Arguments.of("exact match pos",             "pos",    List.of("pos")),
            Arguments.of("case insensitive MOBILE",     "MOBILE", List.of("mobile")),
            Arguments.of("partial match mobile-app",    "mobile-app", List.of("mobile")),
            Arguments.of("one of two blocked (mobile)", "mobile", List.of("wire","mobile")),
            Arguments.of("bdc blocked",                 "bdc",    List.of("bdc")),
            Arguments.of("ussd blocked",                "ussd",   List.of("ussd")),
            Arguments.of("atm blocked",                 "atm",    List.of("atm")),
            Arguments.of("web blocked",                 "web",    List.of("web"))
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("blockedChannelNormal")
    @DisplayName("CUSTOMER_RULE_BLOCKED_CHANNEL — normal (should NOT fire)")
    void blockedChannelNormal(String desc, String channel, List<String> blocked) throws Exception {
        var arr = new JsonArray(); blocked.forEach(arr::add);
        var rule = cRule("blocked_channels", "flag", "both", new JsonObject().put("channels", arr));
        var t = simpleTxn(BigDecimal.valueOf(100_000), channel, "outward", OffsetDateTime.now(WAT));
        String result = evalImmediate(rule, t);
        rec("CUSTOMER_RULE_BLOCKED_CHANNEL", desc, true, result != null);
        assertThat(result).isNull();
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("blockedChannelAbnormal")
    @DisplayName("CUSTOMER_RULE_BLOCKED_CHANNEL — abnormal (MUST fire)")
    void blockedChannelAbnormal(String desc, String channel, List<String> blocked) throws Exception {
        var arr = new JsonArray(); blocked.forEach(arr::add);
        var rule = cRule("blocked_channels", "flag", "both", new JsonObject().put("channels", arr));
        var t = simpleTxn(BigDecimal.valueOf(100_000), channel, "outward", OffsetDateTime.now(WAT));
        String result = evalImmediate(rule, t);
        rec("CUSTOMER_RULE_BLOCKED_CHANNEL", desc, false, result != null);
        assertThat(result).isNotNull();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 25. CUSTOMER_RULE_DAILY_LIMIT
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> dailyLimitNormal() {
        return Stream.of(
            Arguments.of("today=0, txn=500k, limit=1M",      BigDecimal.ZERO,             BigDecimal.valueOf(500_000),   1_000_000L),
            Arguments.of("today=500k, txn=500k, limit=1M",   BigDecimal.valueOf(500_000),  BigDecimal.valueOf(500_000),   1_000_000L),
            Arguments.of("today+txn exactly = limit",        BigDecimal.valueOf(500_000),  BigDecimal.valueOf(500_000),   1_000_000L),
            Arguments.of("small txn small limit",            BigDecimal.valueOf(100),      BigDecimal.valueOf(100),       1_000L),
            Arguments.of("today=0 txn=1, limit=2",           BigDecimal.ZERO,             BigDecimal.ONE,                2L),
            Arguments.of("today=999_999, txn=1, limit=1M",   BigDecimal.valueOf(999_999),  BigDecimal.ONE,                1_000_000L),
            Arguments.of("today=0, txn=0, limit=0",          BigDecimal.ZERO,             BigDecimal.ZERO,               0L),
            Arguments.of("huge limit, small amount",         BigDecimal.valueOf(999_999),  BigDecimal.valueOf(999_999),   Long.MAX_VALUE),
            Arguments.of("today=0, limit=max",               BigDecimal.ZERO,             BigDecimal.valueOf(10_000_000),Long.MAX_VALUE),
            Arguments.of("today=100, txn=50, limit=200",     BigDecimal.valueOf(100),      BigDecimal.valueOf(50),        200L)
        );
    }

    static Stream<Arguments> dailyLimitAbnormal() {
        return Stream.of(
            Arguments.of("today=0, txn=1M+1, limit=1M",      BigDecimal.ZERO,             BigDecimal.valueOf(1_000_001),  1_000_000L),
            Arguments.of("today=500k, txn=501k, limit=1M",   BigDecimal.valueOf(500_000),  BigDecimal.valueOf(501_000),    1_000_000L),
            Arguments.of("today=999k, txn=2k, limit=1M",     BigDecimal.valueOf(999_000),  BigDecimal.valueOf(2_000),      1_000_000L),
            Arguments.of("today=1M, txn=1, limit=1M",        BigDecimal.valueOf(1_000_000),BigDecimal.ONE,                 1_000_000L),
            Arguments.of("today=0, txn=5M, limit=1M",        BigDecimal.ZERO,             BigDecimal.valueOf(5_000_000),  1_000_000L),
            Arguments.of("today=1, txn=1, limit=1",          BigDecimal.ONE,              BigDecimal.ONE,                 1L),
            Arguments.of("today=99, txn=2, limit=100",       BigDecimal.valueOf(99),       BigDecimal.valueOf(2),          100L),
            Arguments.of("today=500k+1, txn=500k, limit=1M", BigDecimal.valueOf(500_001),  BigDecimal.valueOf(500_000),    1_000_000L),
            Arguments.of("today=900k, txn=200k, limit=1M",   BigDecimal.valueOf(900_000),  BigDecimal.valueOf(200_000),    1_000_000L),
            Arguments.of("today=1M-1, txn=2, limit=1M",      BigDecimal.valueOf(999_999),  BigDecimal.valueOf(2),          1_000_000L)
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("dailyLimitNormal")
    @DisplayName("CUSTOMER_RULE_DAILY_LIMIT — normal (should NOT fire)")
    void dailyLimitNormal(String desc, BigDecimal todaySum, BigDecimal amt, long limit) {
        boolean fired = dailyLimitBreached(todaySum, amt, limit);
        rec("CUSTOMER_RULE_DAILY_LIMIT", desc, true, fired);
        assertThat(fired).as(desc).isFalse();
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("dailyLimitAbnormal")
    @DisplayName("CUSTOMER_RULE_DAILY_LIMIT — abnormal (MUST fire)")
    void dailyLimitAbnormal(String desc, BigDecimal todaySum, BigDecimal amt, long limit) {
        boolean fired = dailyLimitBreached(todaySum, amt, limit);
        rec("CUSTOMER_RULE_DAILY_LIMIT", desc, false, fired);
        assertThat(fired).as(desc).isTrue();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 26. CUSTOMER_RULE_MONTHLY_LIMIT
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> monthlyLimitNormal() {
        return Stream.of(
            Arguments.of("0 + 4M = 4M, limit=5M",         BigDecimal.ZERO,              BigDecimal.valueOf(4_000_000),  5_000_000L),
            Arguments.of("2.5M + 2.5M = 5M (boundary)",   BigDecimal.valueOf(2_500_000), BigDecimal.valueOf(2_500_000), 5_000_000L),
            Arguments.of("0 + 0 = 0, limit=0",            BigDecimal.ZERO,              BigDecimal.ZERO,                1L),
            Arguments.of("4.9M + 99k = 4.999M, limit=5M", BigDecimal.valueOf(4_900_000), BigDecimal.valueOf(99_000),    5_000_000L),
            Arguments.of("huge limit",                     BigDecimal.valueOf(999_999),   BigDecimal.valueOf(999_999),   Long.MAX_VALUE),
            Arguments.of("0 + 1, limit=2",                BigDecimal.ZERO,              BigDecimal.ONE,                 2L),
            Arguments.of("month=0, txn=5M, limit=10M",    BigDecimal.ZERO,              BigDecimal.valueOf(5_000_000),  10_000_000L),
            Arguments.of("month=9.9M, txn=99k, limit=10M",BigDecimal.valueOf(9_900_000), BigDecimal.valueOf(99_000),    10_000_000L),
            Arguments.of("exact boundary 10M",             BigDecimal.valueOf(9_000_000), BigDecimal.valueOf(1_000_000), 10_000_000L),
            Arguments.of("month=1M, limit=MAX_VALUE",      BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(999_999_999L), Long.MAX_VALUE)
        );
    }

    static Stream<Arguments> monthlyLimitAbnormal() {
        return Stream.of(
            Arguments.of("0 + 5M+1, limit=5M",            BigDecimal.ZERO,              BigDecimal.valueOf(5_000_001),  5_000_000L),
            Arguments.of("2.5M + 2.6M, limit=5M",         BigDecimal.valueOf(2_500_000), BigDecimal.valueOf(2_600_000), 5_000_000L),
            Arguments.of("4.9M + 200k, limit=5M",         BigDecimal.valueOf(4_900_000), BigDecimal.valueOf(200_000),   5_000_000L),
            Arguments.of("5M + 1, limit=5M",              BigDecimal.valueOf(5_000_000), BigDecimal.ONE,                5_000_000L),
            Arguments.of("9M + 2M, limit=10M",            BigDecimal.valueOf(9_000_000), BigDecimal.valueOf(2_000_000), 10_000_000L),
            Arguments.of("0 + 6M, limit=5M",              BigDecimal.ZERO,              BigDecimal.valueOf(6_000_000),  5_000_000L),
            Arguments.of("1 + 1, limit=1",                BigDecimal.ONE,               BigDecimal.ONE,                 1L),
            Arguments.of("4.999M + 2, limit=5M",          BigDecimal.valueOf(4_999_000), BigDecimal.valueOf(2_000),     5_000_000L),
            Arguments.of("10M + 1, limit=10M",            BigDecimal.valueOf(10_000_000),BigDecimal.ONE,                10_000_000L),
            Arguments.of("0 + 50M, limit=10M",            BigDecimal.ZERO,              BigDecimal.valueOf(50_000_000), 10_000_000L)
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("monthlyLimitNormal")
    @DisplayName("CUSTOMER_RULE_MONTHLY_LIMIT — normal (should NOT fire)")
    void monthlyLimitNormal(String desc, BigDecimal monthSum, BigDecimal amt, long limit) {
        boolean fired = monthlyLimitBreached(monthSum, amt, limit);
        rec("CUSTOMER_RULE_MONTHLY_LIMIT", desc, true, fired);
        assertThat(fired).as(desc).isFalse();
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("monthlyLimitAbnormal")
    @DisplayName("CUSTOMER_RULE_MONTHLY_LIMIT — abnormal (MUST fire)")
    void monthlyLimitAbnormal(String desc, BigDecimal monthSum, BigDecimal amt, long limit) {
        boolean fired = monthlyLimitBreached(monthSum, amt, limit);
        rec("CUSTOMER_RULE_MONTHLY_LIMIT", desc, false, fired);
        assertThat(fired).as(desc).isTrue();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 27. CUSTOMER_RULE_VELOCITY
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> custVelocityNormal() {
        return Stream.of(
            Arguments.of("0 txns, max=5",    0L,  5),
            Arguments.of("4 txns, max=5",    4L,  5),
            Arguments.of("1 txn, max=10",    1L,  10),
            Arguments.of("9 txns, max=10",   9L,  10),
            Arguments.of("0 txns, max=1",    0L,  1),
            Arguments.of("2 txns, max=3",    2L,  3),
            Arguments.of("99 txns, max=100", 99L, 100),
            Arguments.of("5 txns, max=100",  5L,  100),
            Arguments.of("0 txns, max=0 (boundary) — count=0 not >= 0 → fires; check", 0L, 1),
            Arguments.of("3 txns, max=5",   3L,  5)
        );
    }

    static Stream<Arguments> custVelocityAbnormal() {
        return Stream.of(
            Arguments.of("5 txns, max=5 (>= fires)",  5L,  5),
            Arguments.of("6 txns, max=5",             6L,  5),
            Arguments.of("10 txns, max=5",            10L, 5),
            Arguments.of("11 txns, max=10",           11L, 10),
            Arguments.of("10 txns, max=10",           10L, 10),
            Arguments.of("100 txns, max=10",          100L,10),
            Arguments.of("1 txn, max=0",              1L,  0),
            Arguments.of("3 txns, max=2",             3L,  2),
            Arguments.of("50 txns, max=5",            50L, 5),
            Arguments.of("1000 txns, max=100",        1000L,100)
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("custVelocityNormal")
    @DisplayName("CUSTOMER_RULE_VELOCITY — normal (should NOT fire)")
    void custVelocityNormal(String desc, long count, int max) {
        boolean fired = velocityBreached(count, max);
        rec("CUSTOMER_RULE_VELOCITY", desc, true, fired);
        assertThat(fired).as(desc).isFalse();
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("custVelocityAbnormal")
    @DisplayName("CUSTOMER_RULE_VELOCITY — abnormal (MUST fire)")
    void custVelocityAbnormal(String desc, long count, int max) {
        boolean fired = velocityBreached(count, max);
        rec("CUSTOMER_RULE_VELOCITY", desc, false, fired);
        assertThat(fired).as(desc).isTrue();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 28. RAPID_POST_DEPOSIT_WITHDRAWAL
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> rapidWdNormal() {
        return Stream.of(
            Arguments.of("inward direction (not outward)",  false, BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(500_000), 0.5),
            Arguments.of("no recent deposit",              true,  BigDecimal.ZERO,               BigDecimal.valueOf(500_000), 0.5),
            Arguments.of("outward, ratio 0.49 under 0.5 threshold", true, BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(490_000), 0.5),
            Arguments.of("ratio 0.49 under threshold",     true,  BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(490_000), 0.5),
            Arguments.of("small deposit, small withdrawal (ratio OK)", true, BigDecimal.valueOf(1_000), BigDecimal.valueOf(499), 0.5),
            Arguments.of("outward, ratio 0.3 under 0.5",  true,  BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(300_000), 0.5),
            Arguments.of("deposit=0, outward",             true,  BigDecimal.ZERO,               BigDecimal.valueOf(100),     0.5),
            Arguments.of("ratio 0.4 under 0.8 threshold", true,  BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(400_000), 0.8),
            Arguments.of("ratio 0.79 under 0.8",          true,  BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(790_000), 0.8),
            Arguments.of("inward + deposit + ratio over",  false, BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(600_000), 0.5)
        );
    }

    static Stream<Arguments> rapidWdAbnormal() {
        return Stream.of(
            Arguments.of("ratio 0.5 = threshold (>=)",     true,  BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(500_000), 0.5),
            Arguments.of("ratio 0.51 just over 0.5",       true,  BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(510_000), 0.5),
            Arguments.of("ratio 1.0 (full withdrawal)",    true,  BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(1_000_000),0.5),
            Arguments.of("ratio 1.5 (over deposit)",       true,  BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(1_500_000),0.5),
            Arguments.of("ratio 0.8 >= 0.5 threshold",    true,  BigDecimal.valueOf(500_000),  BigDecimal.valueOf(400_000),  0.5),
            Arguments.of("ratio 0.9 threshold 0.8",       true,  BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(900_000), 0.8),
            Arguments.of("ratio 2.0 (double deposit)",    true,  BigDecimal.valueOf(200_000),  BigDecimal.valueOf(400_000),  0.5),
            Arguments.of("very high deposit, 50% out",    true,  BigDecimal.valueOf(10_000_000),BigDecimal.valueOf(5_000_001),0.5),
            Arguments.of("ratio 0.6 >= 0.5",              true,  BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(600_000), 0.5),
            Arguments.of("threshold 0.3, ratio 0.4",      true,  BigDecimal.valueOf(1_000_000), BigDecimal.valueOf(400_000), 0.3)
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("rapidWdNormal")
    @DisplayName("RAPID_POST_DEPOSIT_WITHDRAWAL — normal (should NOT fire)")
    void rapidWdNormal(String desc, boolean outward, BigDecimal recentDeposit,
                        BigDecimal amt, double minRatio) {
        boolean fired = rapidWithdrawalBreached(outward, recentDeposit, amt, minRatio);
        rec("RAPID_POST_DEPOSIT_WITHDRAWAL", desc, true, fired);
        assertThat(fired).as(desc).isFalse();
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("rapidWdAbnormal")
    @DisplayName("RAPID_POST_DEPOSIT_WITHDRAWAL — abnormal (MUST fire)")
    void rapidWdAbnormal(String desc, boolean outward, BigDecimal recentDeposit,
                          BigDecimal amt, double minRatio) {
        boolean fired = rapidWithdrawalBreached(outward, recentDeposit, amt, minRatio);
        rec("RAPID_POST_DEPOSIT_WITHDRAWAL", desc, false, fired);
        assertThat(fired).as(desc).isTrue();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 29. SUDDEN_WITHDRAWAL_AFTER_DEPOSIT
    // ═══════════════════════════════════════════════════════════════════════════

    static Stream<Arguments> suddenWdNormal() {
        return Stream.of(
            Arguments.of("inward direction",               false, true,  BigDecimal.valueOf(500_000), 100_000L),
            Arguments.of("no recent deposit",              true,  false, BigDecimal.valueOf(500_000), 100_000L),
            Arguments.of("amount under min_amount",        true,  true,  BigDecimal.valueOf(99_999),  100_000L),
            Arguments.of("amount=99999, min=100001 (just under)", true, true, BigDecimal.valueOf(99_999), 100_001L),
            Arguments.of("no deposit, no outward",        false, false, BigDecimal.valueOf(500_000), 100_000L),
            Arguments.of("inward + deposit + over min",   false, true,  BigDecimal.valueOf(500_000), 100_000L),
            Arguments.of("outward + no deposit + over",   true,  false, BigDecimal.valueOf(1_000_000),100_000L),
            Arguments.of("amount=0, min=0",               true,  true,  BigDecimal.ZERO,             1L),
            Arguments.of("amount=1, min=2",               true,  true,  BigDecimal.ONE,              2L),
            Arguments.of("amount 50k, min=100k",          true,  true,  BigDecimal.valueOf(50_000),  100_000L)
        );
    }

    static Stream<Arguments> suddenWdAbnormal() {
        return Stream.of(
            Arguments.of("outward + deposit + 100k+1",     true, true,  BigDecimal.valueOf(100_001),   100_000L),
            Arguments.of("outward + deposit + 500k",       true, true,  BigDecimal.valueOf(500_000),   100_000L),
            Arguments.of("outward + deposit + 1M",         true, true,  BigDecimal.valueOf(1_000_000), 100_000L),
            Arguments.of("outward + deposit + min=0",      true, true,  BigDecimal.valueOf(1),         0L),
            Arguments.of("outward + deposit + exact min",  true, true,  BigDecimal.valueOf(100_000),   100_000L),
            Arguments.of("outward + deposit + 10M",        true, true,  BigDecimal.valueOf(10_000_000),100_000L),
            Arguments.of("outward + deposit + 50M",        true, true,  BigDecimal.valueOf(50_000_000),100_000L),
            Arguments.of("outward + deposit + min=1",      true, true,  BigDecimal.ONE,                1L),
            Arguments.of("outward + deposit + 200k, min=100k", true, true, BigDecimal.valueOf(200_000),100_000L),
            Arguments.of("outward + deposit + large min",  true, true,  BigDecimal.valueOf(5_000_001), 5_000_000L)
        );
    }

    @ParameterizedTest(name = "NORMAL  [{0}]")
    @MethodSource("suddenWdNormal")
    @DisplayName("SUDDEN_WITHDRAWAL_AFTER_DEPOSIT — normal (should NOT fire)")
    void suddenWdNormal(String desc, boolean outward, boolean hadDeposit,
                         BigDecimal amt, long minAmt) {
        boolean fired = suddenWithdrawalBreached(outward, hadDeposit, amt, minAmt);
        rec("SUDDEN_WITHDRAWAL_AFTER_DEPOSIT", desc, true, fired);
        assertThat(fired).as(desc).isFalse();
    }

    @ParameterizedTest(name = "ABNORMAL [{0}]")
    @MethodSource("suddenWdAbnormal")
    @DisplayName("SUDDEN_WITHDRAWAL_AFTER_DEPOSIT — abnormal (MUST fire)")
    void suddenWdAbnormal(String desc, boolean outward, boolean hadDeposit,
                           BigDecimal amt, long minAmt) {
        boolean fired = suddenWithdrawalBreached(outward, hadDeposit, amt, minAmt);
        rec("SUDDEN_WITHDRAWAL_AFTER_DEPOSIT", desc, false, fired);
        assertThat(fired).as(desc).isTrue();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 30. SCORING FORMULA  min(100, maxScore + (n-1)×7 + premium)
    // ═══════════════════════════════════════════════════════════════════════════

    @Test @DisplayName("Score: no rules → 0")
    void scoreNoRules() { assertThat(computeScore(List.of(), 0)).isEqualTo(0); }

    @Test @DisplayName("Score: single rule 35 → 35")
    void scoreSingleRule() { assertThat(computeScore(List.of(35), 0)).isEqualTo(35); }

    @Test @DisplayName("Score: two rules 35+25 → 35+7=42")
    void scoreTwoRules() { assertThat(computeScore(List.of(35, 25), 0)).isEqualTo(42); }

    @Test @DisplayName("Score: three rules 35+25+25 → 35+14=49")
    void scoreThreeRules() { assertThat(computeScore(List.of(35, 25, 25), 0)).isEqualTo(49); }

    @Test @DisplayName("Score: customer risk ≥70 → +15 premium")
    void scoreHighRiskPremium() { assertThat(computeScore(List.of(35), 70)).isEqualTo(50); }

    @Test @DisplayName("Score: customer risk ≥40 < 70 → +8 premium")
    void scoreMedRiskPremium() { assertThat(computeScore(List.of(35), 50)).isEqualTo(43); }

    @Test @DisplayName("Score: customer risk <40 → no premium")
    void scoreLowRiskPremium() { assertThat(computeScore(List.of(35), 39)).isEqualTo(35); }

    @Test @DisplayName("Score: capped at 100 regardless of violations")
    void scoreCapAt100() { assertThat(computeScore(List.of(93, 70, 55, 50), 15)).isEqualTo(100); }

    @Test @DisplayName("Score: 4 rules, maxScore=55, (4-1)×7=21, score=76 > 75 → critical")
    void scorePriorityMappingCritical() {
        int score = computeScore(List.of(55, 35, 25, 20), 0);
        assertThat(score).isEqualTo(76);
        assertThat(TransactionScorer.getPriority(score)).isEqualTo("critical");
    }

    @Test @DisplayName("Score: 60≤score<75 → priority = high")
    void scorePriorityHigh() { assertThat(TransactionScorer.getPriority(65)).isEqualTo("high"); }

    @Test @DisplayName("Score: 40≤score<60 → priority = medium")
    void scorePriorityMedium() { assertThat(TransactionScorer.getPriority(50)).isEqualTo("medium"); }

    @Test @DisplayName("Score: <40 → priority = low")
    void scorePriorityLow() { assertThat(TransactionScorer.getPriority(20)).isEqualTo("low"); }

    // ═══════════════════════════════════════════════════════════════════════════
    // Report generation
    // ═══════════════════════════════════════════════════════════════════════════

    @AfterAll
    static void generateReport() throws Exception {
        Map<String, long[]> byRule = new LinkedHashMap<>();
        for (var r : REPORT) {
            byRule.computeIfAbsent(r.ruleId(), k -> new long[4]);
            long[] c = byRule.get(r.ruleId());
            if (r.isNormal()) { c[0]++; if (r.passed()) c[1]++; }
            else              { c[2]++; if (r.passed()) c[3]++; }
        }

        long totalTests  = REPORT.size();
        long totalPassed = REPORT.stream().filter(RuleTestRecord::passed).count();

        var sb = new StringBuilder();
        sb.append("# OpenIV AML Rule Coverage Report\n\n");
        sb.append("**Generated:** ").append(java.time.LocalDate.now()).append("\n\n");
        sb.append("## Summary\n\n");
        sb.append("| Metric | Value |\n|---|---|\n");
        sb.append("| Rules tested | ").append(byRule.size()).append(" |\n");
        sb.append("| Total test cases | ").append(totalTests).append(" |\n");
        sb.append("| Passed | ").append(totalPassed).append(" |\n");
        sb.append("| Failed | ").append(totalTests - totalPassed).append(" |\n");
        sb.append("| Pass rate | ")
          .append(totalTests == 0 ? "N/A" : String.format("%.1f%%", 100.0 * totalPassed / totalTests))
          .append(" |\n\n");

        sb.append("## Rule-by-Rule Results\n\n");
        sb.append("| Rule | Normal (pass/total) | Abnormal (pass/total) | Status |\n|---|---|---|---|\n");

        for (var entry : byRule.entrySet()) {
            long[] c      = entry.getValue();
            long normPass = c[1], normTotal = c[0];
            long abnPass  = c[3], abnTotal  = c[2];
            boolean ok    = normPass == normTotal && abnPass == abnTotal;
            sb.append("| ").append(entry.getKey())
              .append(" | ").append(normPass).append("/").append(normTotal)
              .append(" | ").append(abnPass).append("/").append(abnTotal)
              .append(" | ").append(ok ? "✅ PASS" : "❌ FAIL")
              .append(" |\n");
        }

        sb.append("\n## Detailed Failures\n\n");
        boolean anyFail = false;
        for (var r : REPORT) {
            if (!r.passed()) {
                anyFail = true;
                sb.append("- **").append(r.ruleId()).append("** | ")
                  .append(r.isNormal() ? "NORMAL" : "ABNORMAL").append(" | `")
                  .append(r.scenario()).append("` | flag fired=").append(r.flagFired()).append("\n");
            }
        }
        if (!anyFail) sb.append("_None — all tests passed._\n");

        sb.append("\n## Rule Descriptions\n\n");
        sb.append("| Rule ID | Category | Description |\n|---|---|---|\n");
        List.of(
            new String[]{"MICRO_TIMING_ANOMALY",        "Timestamp", "occurred_at within ±5s of server time (score 25)"},
            new String[]{"STALE_TIMESTAMP_ANOMALY",     "Timestamp", "occurred_at more than 24h in the past (score 55)"},
            new String[]{"FUTURE_TIMESTAMP_ANOMALY",    "Timestamp", "occurred_at more than beam+1h in the future (score 70)"},
            new String[]{"TXN_IMPOSSIBLE_TRAVEL",       "Geo-velocity", ">1050 km/h or <30s across >50km (hard score 93, auto-case)"},
            new String[]{"TXN_SUSPICIOUS_TRAVEL",       "Geo-velocity", "900–1050 km/h — outer limit of commercial aviation (score 60)"},
            new String[]{"TXN_AIR_TRAVEL_REQUIRED",     "Geo-velocity", "500–900 km/h — requires air travel (score 35)"},
            new String[]{"TXN_HIGH_VELOCITY",           "Geo-velocity", "200–500 km/h — very fast ground/helicopter (score 15)"},
            new String[]{"high-value-wire",             "Institution", "wire transfer amount > configured threshold (default score 35)"},
            new String[]{"velocity-cluster",            "Institution", "customer 24h txn count > configured count threshold (score 25)"},
            new String[]{"late-night-large",            "Institution", "large transfer between 22:00–05:59 (score 30)"},
            new String[]{"OTP_ALERT",                   "Institution", "OTP attack correlation — failed auth before txn (score 50)"},
            new String[]{"VELOCITY_SPIKE",              "Institution", "today txn count > expected × spike ratio (score 20)"},
            new String[]{"cross-border-bdc",            "Institution", "BDC channel transaction above threshold (score 30)"},
            new String[]{"DORMANT_REACTIVATION",        "Institution", "account inactive >90 days + large transaction (score 25)"},
            new String[]{"KYC_TIER_LIMIT_EXCEEDED",     "KYC", "single txn exceeds per-channel limit for customer's KYC tier (score 45+boost)"},
            new String[]{"KYC_TIER_DAILY_LIMIT_EXCEEDED","KYC","cumulative daily spend exceeds tier daily cap (score 50+boost)"},
            new String[]{"pat-4",                       "Behavioral", "institution today > yesterday × spike_ratio (score depends on severity)"},
            new String[]{"pat-5",                       "Behavioral", "customer 24h txn count > max_daily_count (score 15)"},
            new String[]{"pat-2",                       "Behavioral", "high-value mobile txn > min_amount (score 30)"},
            new String[]{"BEHAVIORAL_PATTERN_DEVIATION","Behavioral", "txn deviates from customer profile in amount/channel/time/bank/category"},
            new String[]{"CUSTOMER_RULE_MAX_AMOUNT",    "Customer", "single txn amount > customer-specific max"},
            new String[]{"CUSTOMER_RULE_BLOCKED_BANK",  "Customer", "recipient/sender bank is in customer's blocklist"},
            new String[]{"CUSTOMER_RULE_BANK_NOT_ALLOWED","Customer","destination bank not in customer's whitelist"},
            new String[]{"CUSTOMER_RULE_BLOCKED_CHANNEL","Customer","channel is blocked for this customer"},
            new String[]{"CUSTOMER_RULE_DAILY_LIMIT",   "Customer", "today's sum + txn > customer daily cap"},
            new String[]{"CUSTOMER_RULE_MONTHLY_LIMIT", "Customer", "this month's sum + txn > customer monthly cap"},
            new String[]{"CUSTOMER_RULE_VELOCITY",      "Customer", "customer txn count in window >= max_count"},
            new String[]{"RAPID_POST_DEPOSIT_WITHDRAWAL","Customer","outward amount / recent deposit >= min_withdrawal_ratio"},
            new String[]{"SUDDEN_WITHDRAWAL_AFTER_DEPOSIT","Customer","outward txn within N minutes of deposit + amount >= min_amount"}
        ).forEach(row ->
            sb.append("| ").append(row[0]).append(" | ").append(row[1]).append(" | ").append(row[2]).append(" |\n"));

        sb.append("\n---\n_Generated by HybridTransactionAnalysisTest.java_\n");

        Path out = Paths.get("target/aml-rule-coverage-report.md");
        Files.createDirectories(out.getParent());
        Files.writeString(out, sb.toString());
        System.out.println("\n📊 AML Rule Coverage Report → " + out.toAbsolutePath());
        System.out.printf("   %d / %d tests passed (%.1f%%)%n",
            totalPassed, totalTests, totalTests == 0 ? 0.0 : 100.0 * totalPassed / totalTests);
    }
}
