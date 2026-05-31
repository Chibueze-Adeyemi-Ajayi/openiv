package com.openiv.backend.transactions;

import com.openiv.backend.aml.AmlSettingsRepository;
import com.openiv.backend.alerts.InstitutionAlertRepository;
import com.openiv.backend.behavioral.BehavioralRuleRepository;
import com.openiv.backend.behavioral.BehavioralRuleRecord;
import com.openiv.backend.cases.AutoCaseCreationService;
import com.openiv.backend.auth.service.EmailSender;
import com.openiv.backend.customers.CustomerBehavioralProfile;
import com.openiv.backend.customers.CustomerBehavioralProfileRepository;
import com.openiv.backend.customers.CustomerRepository;
import com.openiv.backend.customers.CustomerTransactionRule;
import com.openiv.backend.customers.CustomerTransactionRuleRepository;
import com.openiv.backend.kyc.KycService;
import com.openiv.backend.thresholds.ThresholdRepository;
import com.openiv.backend.thresholds.KycTierRecord;
import com.openiv.backend.thresholds.ThresholdRecord;

import io.vertx.core.Future;
import io.vertx.core.json.JsonArray;
import io.vertx.sqlclient.Pool;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;

/**
 * Rule-based fraud detection for transactions.
 *
 * Scoring formula (per transaction):
 *   finalScore = min(100, maxRuleScore + (violationCount − 1) × 7 + 20 + customerRiskPremium)
 *
 * Customer risk premium:
 *   +15 if overall_risk_score ≥ 70
 *   +8  if overall_risk_score ≥ 40
 *   +0  otherwise
 */
public class HybridTransactionAnalysisService {
  private static final Logger log = LoggerFactory.getLogger(HybridTransactionAnalysisService.class);

  @SuppressWarnings("unused")
  private final TransactionScorer scorer;
  private final AutoCaseCreationService caseService;
  private final ThresholdRepository thresholdRepository;
  private final Pool pool;
  private final KycService kycService;
  private final AmlSettingsRepository amlSettingsRepository;
  private final EmailSender emailSender;
  private final BehavioralRuleRepository behavioralRuleRepository;
  private final CustomerTransactionRuleRepository customerRuleRepo;
  private final CustomerBehavioralProfileRepository profileRepo;
  private final CustomerRepository customerRepo;
  private final InstitutionAlertRepository alertRepo;

  public record AnalysisResult(
      int riskScore,
      String priority,
      List<String> triggeredRules,
      String caseid,
      String aiAnalysis,
      boolean caseCreated,
      boolean aiAnalyzed,
      boolean shouldFlag,
      String recommendedAction,
      List<String> flagReasons) {

    // Backwards-compatible constructor without flagReasons
    public AnalysisResult(int riskScore, String priority, List<String> triggeredRules,
        String caseid, String aiAnalysis, boolean caseCreated, boolean aiAnalyzed,
        boolean shouldFlag, String recommendedAction) {
      this(riskScore, priority, triggeredRules, caseid, aiAnalysis, caseCreated, aiAnalyzed,
          shouldFlag, recommendedAction, List.of());
    }
  }

  public HybridTransactionAnalysisService(
      TransactionScorer scorer,
      AutoCaseCreationService caseService,
      ThresholdRepository thresholdRepository,
      Pool pool,
      KycService kycService,
      AmlSettingsRepository amlSettingsRepository,
      EmailSender emailSender,
      BehavioralRuleRepository behavioralRuleRepository,
      CustomerTransactionRuleRepository customerRuleRepo,
      CustomerBehavioralProfileRepository profileRepo,
      CustomerRepository customerRepo,
      InstitutionAlertRepository alertRepo) {
    this.scorer = scorer;
    this.caseService = caseService;
    this.thresholdRepository = thresholdRepository;
    this.pool = pool;
    this.kycService = kycService;
    this.amlSettingsRepository = amlSettingsRepository;
    this.emailSender = emailSender;
    this.behavioralRuleRepository = behavioralRuleRepository;
    this.customerRuleRepo = customerRuleRepo;
    this.profileRepo = profileRepo;
    this.customerRepo = customerRepo;
    this.alertRepo = alertRepo;
  }

  public Future<AnalysisResult> analyzeTransaction(
      long institutionId,
      Transaction transaction,
      long todayCount,
      long yesterdayCount,
      long customerTxnCount24h,
      boolean hasOtpAlert,
      boolean skipKyc,
      Optional<Transaction> previousTransactionWithLocation) {

    // ── Step 1: load customer rules first (needed to know which aggregate queries to run) ──
    return customerRuleRepo.listActiveByExternalCustomerId(institutionId, transaction.customerId())
        .<AnalysisResult>compose(customerRules -> {

          // Determine which customer-aggregate queries are needed. Daily/monthly sums are
          // direction-aware (a "spending limit" rule with direction=outward must only sum
          // outward transactions; otherwise inward deposits inflate the running total and
          // cause false positives).
          java.util.Set<String> dailyDirs = customerRules.stream()
              .filter(r -> r.isActive() && "daily_amount_limit".equals(r.ruleType()))
              .map(r -> r.direction() == null ? "both" : r.direction())
              .collect(java.util.stream.Collectors.toSet());
          java.util.Set<String> monthlyDirs = customerRules.stream()
              .filter(r -> r.isActive() && "monthly_amount_limit".equals(r.ruleType()))
              .map(r -> r.direction() == null ? "both" : r.direction())
              .collect(java.util.stream.Collectors.toSet());
          boolean needsDailyOutward   = dailyDirs.contains("outward")   || dailyDirs.contains("both");
          boolean needsDailyInward    = dailyDirs.contains("inward")    || dailyDirs.contains("both");
          boolean needsMonthlyOutward = monthlyDirs.contains("outward") || monthlyDirs.contains("both");
          boolean needsMonthlyInward  = monthlyDirs.contains("inward")  || monthlyDirs.contains("both");

          boolean needsVelocity = customerRules.stream().anyMatch(r -> r.isActive() && "transaction_velocity".equals(r.ruleType()));
          boolean needsRapidWd  = customerRules.stream().anyMatch(r -> r.isActive() && "rapid_post_deposit_withdrawal".equals(r.ruleType()));
          boolean needsSuddenWd = customerRules.stream().anyMatch(r -> r.isActive() && "sudden_withdrawal_after_deposit".equals(r.ruleType()));
          int vHours = customerRules.stream()
              .filter(r -> r.isActive() && "transaction_velocity".equals(r.ruleType()))
              .mapToInt(r -> r.params().getInteger("window_hours", 24)).max().orElse(24);
          int wdHours = customerRules.stream()
              .filter(r -> r.isActive() && "rapid_post_deposit_withdrawal".equals(r.ruleType()))
              .mapToInt(r -> r.params().getInteger("window_hours", 6)).max().orElse(6);
          int swdMinutes = customerRules.stream()
              .filter(r -> r.isActive() && "sudden_withdrawal_after_deposit".equals(r.ruleType()))
              .mapToInt(r -> r.params().getInteger("window_minutes", 30)).max().orElse(30);

          // ── Step 2: fire ALL remaining queries in one parallel batch ─────────
          // Customer aggregate data (direction-aware sums)
          Future<java.math.BigDecimal> fTodayOutward = needsDailyOutward
              ? customerRuleRepo.sumTodayAmount(institutionId, transaction.customerId(), "outward")
              : Future.succeededFuture(java.math.BigDecimal.ZERO);
          Future<java.math.BigDecimal> fTodayInward = needsDailyInward
              ? customerRuleRepo.sumTodayAmount(institutionId, transaction.customerId(), "inward")
              : Future.succeededFuture(java.math.BigDecimal.ZERO);
          Future<java.math.BigDecimal> fMonthOutward = needsMonthlyOutward
              ? customerRuleRepo.sumMonthAmount(institutionId, transaction.customerId(), "outward")
              : Future.succeededFuture(java.math.BigDecimal.ZERO);
          Future<java.math.BigDecimal> fMonthInward = needsMonthlyInward
              ? customerRuleRepo.sumMonthAmount(institutionId, transaction.customerId(), "inward")
              : Future.succeededFuture(java.math.BigDecimal.ZERO);
          Future<Long> fVelocityCount = needsVelocity
              ? customerRuleRepo.countInVelocityWindow(institutionId, transaction.customerId(), vHours)
              : Future.succeededFuture(0L);
          Future<java.math.BigDecimal> fRecentDeposit = needsRapidWd
              ? customerRuleRepo.sumInwardAmountInWindow(institutionId, transaction.customerId(), wdHours)
              : Future.succeededFuture(java.math.BigDecimal.ZERO);
          Future<Boolean> fSuddenWdDeposit = needsSuddenWd
              ? customerRuleRepo.hasDepositInLastMinutes(institutionId, transaction.customerId(), swdMinutes)
              : Future.succeededFuture(Boolean.FALSE);
          String kycChannel   = transaction.channel()   != null ? transaction.channel().toLowerCase() : "other";
          String kycDirection = transaction.direction() != null ? transaction.direction()              : "outward";
          Future<java.math.BigDecimal> fKycDailySum =
              customerRuleRepo.sumTodayAmountByChannelAndDirection(institutionId, transaction.customerId(), kycChannel, kycDirection);

          // Institution data (loaded in parallel with customer aggregate data)
          Future<List<ThresholdRecord>>     fThresholds     = thresholdRepository.list(institutionId);
          Future<List<KycTierRecord>>       fTierThresholds = thresholdRepository.listKycTierThresholds(institutionId);
          Future<java.util.Optional<com.openiv.backend.aml.AmlSettings>> fAmlSettings =
              amlSettingsRepository.getByInstitution(institutionId);
          Future<List<BehavioralRuleRecord>> fBehavioralRules = behavioralRuleRepository.list(institutionId);
          Future<Boolean>  fKycSuppressed = thresholdRepository.getKycSuppressed(institutionId);
          Future<Integer>  fOverallRisk   = customerRepo.getOverallRiskScore(institutionId, transaction.customerId());
          Future<java.util.Optional<com.openiv.backend.kyc.KycPipelineResult>> fKyc =
              kycService.getCustomerKycByInstitution(institutionId, transaction.customerId());
          Future<java.util.Optional<CustomerBehavioralProfile>> fProfile =
              profileRepo.getProfile(institutionId, transaction.customerId());
          Future<java.util.Optional<java.time.OffsetDateTime>> fLastTxnDate =
              findPreviousTransactionDate(institutionId, transaction.customerId(), transaction.id());

          // Indices: 0-7 customer aggregate, 8-16 institution data
          return Future.all(new java.util.ArrayList<>(java.util.List.of(
              fTodayOutward, fTodayInward, fMonthOutward, fMonthInward,
              fVelocityCount, fRecentDeposit, fKycDailySum, fSuddenWdDeposit,
              fThresholds, fTierThresholds, fAmlSettings, fBehavioralRules, fKycSuppressed,
              fOverallRisk, fKyc, fProfile, fLastTxnDate)))
              .<AnalysisResult>compose(all -> {

                java.math.BigDecimal todayOutward  = all.resultAt(0);
                java.math.BigDecimal todayInward   = all.resultAt(1);
                java.math.BigDecimal monthOutward  = all.resultAt(2);
                java.math.BigDecimal monthInward   = all.resultAt(3);
                long velocityCount                 = (Long) all.resultAt(4);
                java.math.BigDecimal recentDeposit = all.resultAt(5);
                java.math.BigDecimal kycDailySum   = all.resultAt(6);
                boolean hadRecentDeposit           = Boolean.TRUE.equals((Boolean) all.resultAt(7));

                List<ThresholdRecord>     thresholds      = all.resultAt(8);
                List<KycTierRecord>       tierThresholds  = all.resultAt(9);
                java.util.Optional<com.openiv.backend.aml.AmlSettings> optAml = all.resultAt(10);
                List<BehavioralRuleRecord> behavioralRules = all.resultAt(11);
                boolean kycSuppressed = Boolean.TRUE.equals((Boolean) all.resultAt(12));
                int customerOverallRisk               = (Integer) all.resultAt(13);
                java.util.Optional<com.openiv.backend.kyc.KycPipelineResult> optKyc = all.resultAt(14);
                java.util.Optional<CustomerBehavioralProfile> optProfile             = all.resultAt(15);
                java.util.Optional<java.time.OffsetDateTime> lastTxnDate             = all.resultAt(16);

                boolean kycTierCheckEnabled = !kycSuppressed && !skipKyc;
                int customerKycTier = optKyc.map(k ->
                    com.openiv.backend.kyc.KycPipelineResultRepository.fromKnowledgeLevel(k.knowledgeLevel()))
                    .orElse(0);

                com.openiv.backend.aml.AmlSettings aml = optAml.orElse(
                    new com.openiv.backend.aml.AmlSettings(0, institutionId, false, null, 51, 81, 60, 85, 30, 30, 180, "Africa/Lagos", 40, 75, 10, 1000));
                java.time.ZoneId zone     = java.time.ZoneId.of(aml.timezone());
                int beamWindowSeconds     = aml.beamWindowSeconds();

                // Build once; passed to every updateTransactionRisk call for audit compliance
                final String rulesSnapshot = buildRulesSnapshot(
                    institutionId, transaction.id(), aml, thresholds, behavioralRules, tierThresholds);

                // ── PHASE 1: INSTITUTION RULES ──────────────────────────────────
                // Timestamp anomalies
                java.util.List<String>  timestampFlags  = new java.util.ArrayList<>();
                java.util.List<Integer> timestampScores = new java.util.ArrayList<>();
                if (transaction.occurredAt() != null) {
                  java.time.OffsetDateTime now = java.time.OffsetDateTime.now(zone);
                  long signedDiff  = java.time.temporal.ChronoUnit.SECONDS.between(transaction.occurredAt(), now);
                  long secondsDiff = Math.abs(signedDiff);

                  // MICRO_TIMING: occurred_at within ±5 s of now.
                  // Low score (25) — real-time institutions routinely set occurred_at = now();
                  // this alone should never block a transaction.
                  if (secondsDiff <= 5) {
                    log.debug("[TIMESTAMP] Micro-timing on txn={} ({}s from institution now) — scored flag only", transaction.id(), secondsDiff);
                    timestampFlags.add("MICRO_TIMING_ANOMALY");
                    timestampScores.add(25);
                  } else {
                    final long FUTURE_GRACE = 3600L;
                    // Use 24 hours as the minimum staleness window — beamWindowSeconds governs
                    // SSE stream freshness, not fraud detection.  Batch uploads, processing
                    // queues, and network retries can all produce timestamps that are minutes old.
                    final long STALE_WINDOW = Math.max(beamWindowSeconds, 86400L);
                    if (signedDiff < -(beamWindowSeconds + FUTURE_GRACE)) {
                      long minutesAhead = Math.max(1, Math.abs(signedDiff) / 60);
                      log.warn("[TIMESTAMP] FUTURE_TIMESTAMP_ANOMALY on txn={} ({}m ahead of institution now)", transaction.id(), minutesAhead);
                      timestampFlags.add("FUTURE_TIMESTAMP_ANOMALY");
                      timestampScores.add(70);
                    } else if (signedDiff > STALE_WINDOW) {
                      long hoursOld   = signedDiff / 3600;
                      long minutesOld = (signedDiff % 3600) / 60;
                      String ageDesc  = hoursOld > 0
                          ? hoursOld + " hour" + (hoursOld == 1 ? "" : "s")
                          : minutesOld + " minute" + (minutesOld == 1 ? "" : "s");
                      log.warn("[TIMESTAMP] STALE_TIMESTAMP_ANOMALY on txn={} ({} old)", transaction.id(), ageDesc);
                      timestampFlags.add("STALE_TIMESTAMP_ANOMALY");
                      timestampScores.add(55);
                    }
                  }
                }

                // Geo-velocity check (institution-level critical block)
                GeoVelocityChecker.GeoVelocityResult geoResult =
                    GeoVelocityChecker.check(transaction, previousTransactionWithLocation);

                if (geoResult.triggered() && "TXN_IMPOSSIBLE_TRAVEL".equals(geoResult.ruleId())) {
                  log.warn("[CRITICAL] TXN_IMPOSSIBLE_TRAVEL on txn={}: {}km/h", transaction.id(),
                      geoResult.impliedSpeedKmh() == Double.MAX_VALUE ? "∞" : String.format("%.0f", geoResult.impliedSpeedKmh()));
                  java.util.List<String> geoFlags   = java.util.List.of("TXN_IMPOSSIBLE_TRAVEL");
                  java.util.List<String> geoReasons = java.util.List.of(geoResult.reason());
                  return updateTransactionRisk(institutionId, transaction.id(), 93, geoResult.reason(), geoReasons, rulesSnapshot)
                      .compose(v -> caseService.createCaseFromTransaction(institutionId, transaction,
                          new TransactionScorer.ScoringResult(93, geoFlags, geoResult.reason())))
                      .compose(caseRecord -> {
                        sendCaseNotificationEmails(institutionId, caseRecord)
                            .onFailure(e -> log.warn("[Case Notifications] geo-velocity case {}: {}", caseRecord.id(), e.getMessage()));
                        return Future.succeededFuture(new AnalysisResult(93, TransactionScorer.getPriority(93),
                            geoFlags, caseRecord.id(), null, true, false, true, "DECLINE", geoReasons));
                      });
                }

                // Institution threshold + KYC tier scoring
                TransactionScorer.ScoringResult txnResult = scoreWithThresholds(
                    transaction, thresholds, tierThresholds,
                    todayCount, yesterdayCount, customerTxnCount24h,
                    hasOtpAlert, kycTierCheckEnabled, customerKycTier, zone, kycDailySum,
                    aml.expectedDailyTxnCount(), lastTxnDate);

                // Behavioral pattern scoring
                TransactionScorer.ScoringResult behResult = scoreBehavioralPatterns(
                    transaction, behavioralRules, optProfile.orElse(null),
                    todayCount, yesterdayCount, customerTxnCount24h, aml, txnResult.flags);

                // ── PHASE 2: CUSTOMER-SPECIFIC RULES (immediately after institution rules) ──
                java.util.List<String>  custFlags  = new java.util.ArrayList<>();
                java.util.List<Integer> custScores = new java.util.ArrayList<>();

                // Immediate (no-DB) customer rules
                for (CustomerTransactionRule rule : customerRules) {
                  if (!rule.isActive()) continue;
                  if (!directionMatches(rule.direction(), transaction.direction())) continue;
                  String violation = evalImmediateRule(rule, transaction);
                  if (violation == null) continue;
                  if ("block".equals(rule.action())) {
                    return handleCustomerBlock(institutionId, transaction, violation, rule.ruleType());
                  }
                  custFlags.add(ruleTypeToFlag(rule.ruleType()));
                  custScores.add("flag".equals(rule.action()) ? 75 : 55);
                }

                // Aggregate customer rules
                for (CustomerTransactionRule rule : customerRules) {
                  if (!rule.isActive()) continue;
                  if (!directionMatches(rule.direction(), transaction.direction())) continue;
                  switch (rule.ruleType()) {
                    case "daily_amount_limit" -> {
                      long maxD = rule.params().getLong("max_amount", Long.MAX_VALUE);
                      java.math.BigDecimal effDaily = switch (rule.direction() == null ? "both" : rule.direction()) {
                        case "outward" -> todayOutward;
                        case "inward"  -> todayInward;
                        default        -> todayOutward.add(todayInward);
                      };
                      if (effDaily.add(transaction.amount()).longValue() > maxD) {
                        if ("block".equals(rule.action()))
                          return handleCustomerBlock(institutionId, transaction,
                              "Transaction would exceed this customer's daily spending limit of ₦" + String.format("%,d", maxD),
                              "daily_amount_limit");
                        custFlags.add("CUSTOMER_RULE_DAILY_LIMIT");
                        custScores.add("flag".equals(rule.action()) ? 75 : 55);
                      }
                    }
                    case "monthly_amount_limit" -> {
                      long maxM = rule.params().getLong("max_amount", Long.MAX_VALUE);
                      java.math.BigDecimal effMonthly = switch (rule.direction() == null ? "both" : rule.direction()) {
                        case "outward" -> monthOutward;
                        case "inward"  -> monthInward;
                        default        -> monthOutward.add(monthInward);
                      };
                      if (effMonthly.add(transaction.amount()).longValue() > maxM) {
                        if ("block".equals(rule.action()))
                          return handleCustomerBlock(institutionId, transaction,
                              "Transaction would exceed this customer's monthly spending limit of ₦" + String.format("%,d", maxM),
                              "monthly_amount_limit");
                        custFlags.add("CUSTOMER_RULE_MONTHLY_LIMIT");
                        custScores.add("flag".equals(rule.action()) ? 75 : 55);
                      }
                    }
                    case "transaction_velocity" -> {
                      int maxV = rule.params().getInteger("max_count", Integer.MAX_VALUE);
                      if (velocityCount >= maxV) {
                        if ("block".equals(rule.action()))
                          return handleCustomerBlock(institutionId, transaction,
                              "Customer has reached the velocity limit of " + maxV + " transactions per " + vHours + " hours",
                              "transaction_velocity");
                        custFlags.add("CUSTOMER_RULE_VELOCITY");
                        custScores.add("flag".equals(rule.action()) ? 75 : 55);
                      }
                    }
                    case "rapid_post_deposit_withdrawal" -> {
                      if ("outward".equals(transaction.direction()) && recentDeposit.compareTo(java.math.BigDecimal.ZERO) > 0) {
                        double withdrawalRatio = transaction.amount().doubleValue() / recentDeposit.doubleValue();
                        double threshold = rule.params().getDouble("min_withdrawal_ratio", 0.5);
                        if (withdrawalRatio >= threshold) {
                          if ("block".equals(rule.action()))
                            return handleCustomerBlock(institutionId, transaction,
                                "Customer is withdrawing " + String.format("%.0f%%", withdrawalRatio * 100) +
                                " of a deposit received within the last " + wdHours + " hours — a common money laundering pattern",
                                "rapid_post_deposit_withdrawal");
                          custFlags.add("RAPID_POST_DEPOSIT_WITHDRAWAL");
                          custScores.add("flag".equals(rule.action()) ? 75 : 55);
                        }
                      }
                    }
                    case "sudden_withdrawal_after_deposit" -> {
                      if ("outward".equals(transaction.direction()) && hadRecentDeposit) {
                        long minAmt = rule.params().getLong("min_amount", 0L);
                        if (transaction.amount().longValue() >= minAmt) {
                          if ("block".equals(rule.action()))
                            return handleCustomerBlock(institutionId, transaction,
                                "Outward transfer of ₦" + String.format("%,.0f", transaction.amount()) +
                                " detected within " + swdMinutes + " minutes of a deposit — matches a pass-through / cash-out pattern",
                                "sudden_withdrawal_after_deposit");
                          custFlags.add("SUDDEN_WITHDRAWAL_AFTER_DEPOSIT");
                          custScores.add("flag".equals(rule.action()) ? 75 : 55);
                        }
                      }
                    }
                    default -> { }
                  }
                }

                // ── PHASE 3: COMBINE ALL SCORES ─────────────────────────────────
                java.util.List<Integer> allRuleScores = new java.util.ArrayList<>();
                allRuleScores.addAll(txnResult.ruleScores);
                allRuleScores.addAll(behResult.ruleScores);
                if (geoResult.triggered()) allRuleScores.add(geoResult.scoreContribution());
                allRuleScores.addAll(custScores);
                allRuleScores.addAll(timestampScores);

                java.util.List<String> combinedFlags = new java.util.ArrayList<>();
                combinedFlags.addAll(txnResult.flags);
                combinedFlags.addAll(behResult.flags);
                if (geoResult.triggered()) combinedFlags.add(geoResult.ruleId());
                combinedFlags.addAll(custFlags);
                combinedFlags.addAll(timestampFlags);

                      // ── SCORING FORMULA ──────────────────────────────────────
                      // score = min(100, maxRuleScore + (violations−1)×7 + customerPremium)
                      int customerPremium = customerOverallRisk >= 70 ? 15 : customerOverallRisk >= 40 ? 8 : 0;
                      int computedScore = 0;
                      if (!allRuleScores.isEmpty() && !combinedFlags.isEmpty()) {
                        int maxScore = allRuleScores.stream().mapToInt(Integer::intValue).max().orElse(0);
                        int violations = allRuleScores.size();
                        computedScore = Math.min(100, maxScore + (violations - 1) * 7 + customerPremium);
                      }
                      final int finalScore = computedScore;

                      // Build individual plain-English reasons (one per violated rule)
                      java.util.List<String> flagReasons = buildFlagReasons(combinedFlags, finalScore);
                      String legacyReason = flagReasons.isEmpty()
                          ? "No suspicious patterns detected."
                          : String.join(" ", flagReasons);

                      TransactionScorer.ScoringResult scoringResult = new TransactionScorer.ScoringResult(
                          finalScore, combinedFlags, legacyReason, allRuleScores);

                      boolean shouldCase = finalScore >= aml.riskScoreCaseThreshold();
                      boolean shouldFlag = finalScore >= aml.riskScoreFlagThreshold();

                      String recommendedAction = "ALLOW";
                      if (shouldCase) recommendedAction = "DECLINE";
                      else if (shouldFlag) recommendedAction = "HOLD";

                      log.info("[HybridAnalysis] txn={} risk={} violations={} premium={} rules={}",
                          transaction.id(), finalScore, allRuleScores.size(), customerPremium, combinedFlags);

                      final java.util.List<String> finalFlagReasons = flagReasons;
                      final String finalRecommendedAction = recommendedAction;
                      final boolean finalShouldFlag = shouldFlag;

                      // ── PLATFORM-WIDE SURGE ALERT ────────────────────────────
                      // When VELOCITY_SPIKE fires, create a deduped institution alert (once per 2 hours max).
                      // Fire-and-forget — never blocks the transaction pipeline.
                      if (combinedFlags.contains("VELOCITY_SPIKE")) {
                        final long finalExpected = aml.expectedDailyTxnCount();
                        final long finalToday    = todayCount;
                        java.time.OffsetDateTime dedupSince = java.time.OffsetDateTime.now().minusHours(2);
                        alertRepo.findOpenSurge(institutionId, dedupSince)
                            .onSuccess(existing -> {
                              if (existing.isPresent()) return; // already alerted within 2 hours
                              int pct = (int) Math.round(((double) finalToday / finalExpected - 1.0) * 100);
                              String title   = "Transaction Surge Detected";
                              String message = "Today's transaction volume (" + finalToday + ") has exceeded your expected daily baseline of " +
                                  finalExpected + " by " + pct + "%. This may indicate coordinated fraud activity. Investigate immediately.";
                              io.vertx.core.json.JsonObject meta = new io.vertx.core.json.JsonObject()
                                  .put("surgePct", pct)
                                  .put("todayCount", finalToday)
                                  .put("expectedCount", finalExpected);
                              alertRepo.create(institutionId, "TRANSACTION_SURGE", title, message, "high", meta)
                                  .onSuccess(a -> log.warn("[SurgeAlert] Created institution alert id={} for institution={} surge={}%", a.id(), institutionId, pct))
                                  .onFailure(e -> log.warn("[SurgeAlert] Failed to create alert for institution={}: {}", institutionId, e.getMessage()));
                            })
                            .onFailure(e -> log.warn("[SurgeAlert] Dedup check failed for institution={}: {}", institutionId, e.getMessage()));
                      }

                      return updateTransactionRisk(institutionId, transaction.id(), finalScore, legacyReason, flagReasons, rulesSnapshot)
                          .<AnalysisResult>compose(v -> {
                            // Fire-and-forget: refresh customer overall_risk_score and behavioral profile
                            customerRepo.refreshCustomerScore(institutionId, transaction.customerId())
                                .onFailure(e -> log.warn("[HybridAnalysis] refreshCustomerScore failed for {}: {}",
                                    transaction.customerId(), e.getMessage()));
                            profileRepo.upsertProfile(institutionId, transaction.customerId())
                                .onFailure(e -> log.warn("[HybridAnalysis] upsertProfile failed for {}: {}",
                                    transaction.customerId(), e.getMessage()));

                            if (!shouldCase) {
                              return Future.succeededFuture(new AnalysisResult(
                                  finalScore, TransactionScorer.getPriority(finalScore), combinedFlags,
                                  null, null, false, false, finalShouldFlag, finalRecommendedAction, finalFlagReasons));
                            }

                            return caseService.createCaseFromTransaction(institutionId, transaction, scoringResult)
                                .compose(caseRecord -> {
                                  thresholdRepository.getKycSuppressed(institutionId).onSuccess(suppressed -> {
                                    if (!suppressed) {
                                      kycService.lookupForPipeline(institutionId, transaction.customerId(), caseRecord.id())
                                          .onFailure(e -> log.warn("[KYC Pipeline] lookup failed for txn {}: {}", transaction.id(), e.getMessage()));
                                    }
                                  });
                                  sendCaseNotificationEmails(institutionId, caseRecord)
                                      .onFailure(e -> log.warn("[Case Notifications] case {}: {}", caseRecord.id(), e.getMessage()));
                                  return Future.succeededFuture(new AnalysisResult(
                                      finalScore, TransactionScorer.getPriority(finalScore), combinedFlags,
                                      caseRecord.id(), null, true, false, finalShouldFlag, finalRecommendedAction, finalFlagReasons));
                                });
                          });
              });
        })
        .onFailure(e -> log.error("[HybridAnalysis] Analysis failed for txn {}", transaction.id(), e));
  }

  // ── Direction filtering ────────────────────────────────────────────────────
  private static boolean directionMatches(String ruleDirection, String txnDirection) {
    if ("both".equals(ruleDirection) || ruleDirection == null) return true;
    return ruleDirection.equals(txnDirection);
  }

  // ── Immediate rule evaluation (no DB) ────────────────────────────────────
  private String evalImmediateRule(CustomerTransactionRule rule, Transaction txn) {
    return switch (rule.ruleType()) {
      case "max_single_amount" -> {
        long max = rule.params().getLong("max_amount", Long.MAX_VALUE);
        yield txn.amount().longValue() > max
            ? "Transaction amount ₦" + String.format("%,.0f", txn.amount())
                + " exceeds this customer's single-transaction limit of ₦" + String.format("%,d", max)
            : null;
      }
      case "blocked_banks" -> {
        io.vertx.core.json.JsonArray banks = rule.params().getJsonArray("banks", new io.vertx.core.json.JsonArray());
        String rb = txn.recipientBank() != null ? txn.recipientBank().toLowerCase() : "";
        String sb = txn.senderBank()    != null ? txn.senderBank().toLowerCase()    : "";
        boolean blocked = false;
        for (int i = 0; i < banks.size(); i++) {
          String b = banks.getString(i).toLowerCase();
          if (rb.contains(b) || sb.contains(b)) { blocked = true; break; }
        }
        yield blocked
            ? "Transaction to/from a bank restricted for this customer (" +
              (txn.recipientBank() != null ? txn.recipientBank() : txn.senderBank()) + ")"
            : null;
      }
      case "allowed_banks_only" -> {
        io.vertx.core.json.JsonArray banks = rule.params().getJsonArray("banks", new io.vertx.core.json.JsonArray());
        if (banks.isEmpty()) yield null;
        String rb = txn.recipientBank() != null ? txn.recipientBank().toLowerCase() : "";
        boolean allowed = false;
        for (int i = 0; i < banks.size(); i++) {
          if (rb.contains(banks.getString(i).toLowerCase())) { allowed = true; break; }
        }
        yield allowed ? null
            : "Destination bank '" + txn.recipientBank() + "' is not on this customer's approved bank list";
      }
      case "blocked_channels" -> {
        io.vertx.core.json.JsonArray channels = rule.params().getJsonArray("channels", new io.vertx.core.json.JsonArray());
        String ch = txn.channel() != null ? txn.channel().toLowerCase() : "";
        boolean blocked = false;
        for (int i = 0; i < channels.size(); i++) {
          if (ch.contains(channels.getString(i).toLowerCase())) { blocked = true; break; }
        }
        yield blocked ? "Transaction channel '" + txn.channel() + "' is blocked for this customer" : null;
      }
      default -> null;
    };
  }

  private static String ruleTypeToFlag(String ruleType) {
    return switch (ruleType) {
      case "max_single_amount"               -> "CUSTOMER_RULE_MAX_AMOUNT";
      case "blocked_banks"                   -> "CUSTOMER_RULE_BLOCKED_BANK";
      case "allowed_banks_only"              -> "CUSTOMER_RULE_BANK_NOT_ALLOWED";
      case "blocked_channels"               -> "CUSTOMER_RULE_BLOCKED_CHANNEL";
      case "daily_amount_limit"              -> "CUSTOMER_RULE_DAILY_LIMIT";
      case "monthly_amount_limit"            -> "CUSTOMER_RULE_MONTHLY_LIMIT";
      case "transaction_velocity"            -> "CUSTOMER_RULE_VELOCITY";
      case "rapid_post_deposit_withdrawal"       -> "RAPID_POST_DEPOSIT_WITHDRAWAL";
      case "sudden_withdrawal_after_deposit"    -> "SUDDEN_WITHDRAWAL_AFTER_DEPOSIT";
      case "behavioral_pattern_deviation"       -> "BEHAVIORAL_PATTERN_DEVIATION";
      default                                -> "CUSTOMER_RULE_VIOLATION";
    };
  }

  private Future<AnalysisResult> handleCustomerBlock(long institutionId, Transaction txn, String reason, String ruleType) {
    log.warn("[CustomerRule] BLOCK txn={} customer={} rule={}: {}", txn.id(), txn.customerId(), ruleType, reason);
    java.util.List<String> flags   = java.util.List.of(ruleTypeToFlag(ruleType));
    java.util.List<String> reasons = java.util.List.of(reason);
    TransactionScorer.ScoringResult blockScore = new TransactionScorer.ScoringResult(100, new java.util.ArrayList<>(flags), reason);
    return updateTransactionRisk(institutionId, txn.id(), 100, reason, reasons)
        .compose(v -> caseService.createCaseFromTransaction(institutionId, txn, blockScore))
        .map(caseRecord -> new AnalysisResult(100, "critical", flags, caseRecord.id(), null, true, false, true, "DECLINE", reasons));
  }

  // ── Threshold-based scoring ───────────────────────────────────────────────
  private TransactionScorer.ScoringResult scoreWithThresholds(
      Transaction transaction,
      List<ThresholdRecord> thresholds,
      List<KycTierRecord> tierThresholds,
      long todayCount,
      long yesterdayCount,
      long customerTxnCount24h,
      boolean hasOtpAlert,
      boolean kycTierCheckEnabled,
      int customerKycTier,
      java.time.ZoneId zone,
      java.math.BigDecimal kycDailyChannelSum,
      int expectedDailyTxnCount,
      java.util.Optional<java.time.OffsetDateTime> lastTxnDate) {

    java.util.ArrayList<String> flags      = new java.util.ArrayList<>();
    java.util.ArrayList<Integer> ruleScores = new java.util.ArrayList<>();

    java.util.Map<String, ThresholdRecord> thresholdRuleMap = thresholds.stream()
        .filter(ThresholdRecord::isActive)
        .collect(java.util.stream.Collectors.toMap(ThresholdRecord::ruleId, r -> r));

    String txnDir = transaction.direction() != null ? transaction.direction() : "outward";
    boolean isOutward = "outward".equals(txnDir);

    // Rule 0: KYC-tier limits — enforced in two dimensions:
    //   a) single-transaction limit: flags if this txn alone exceeds the per-txn cap for the tier+channel
    //   b) daily cumulative limit: flags if today's spend + this txn would exceed the direction-aware daily cap
    if (kycTierCheckEnabled && !tierThresholds.isEmpty()) {
      KycTierRecord tierRule = tierThresholds.stream()
          .filter(t -> t.kycTier() == customerKycTier)
          .findFirst().orElse(null);

      if (tierRule != null) {
        long amount = transaction.amount().longValue();
        String channel = transaction.channel() != null ? transaction.channel().toLowerCase() : "";

        // a) Single-transaction limit
        long singleLimit;
        if      (channel.contains("wire"))   singleLimit = tierRule.singleTxnLimitWire();
        else if (channel.contains("mobile")) singleLimit = tierRule.singleTxnLimitMobile();
        else if (channel.contains("ussd"))   singleLimit = tierRule.singleTxnLimitUssd();
        else if (channel.contains("bdc"))    singleLimit = tierRule.singleTxnLimitBdc();
        else                                 singleLimit = tierRule.singleTxnLimitOther();

        if (amount > singleLimit) {
          flags.add("KYC_TIER_LIMIT_EXCEEDED");
          ruleScores.add(45 + tierRule.riskScoreBoost());
        }

        // b) Cumulative daily limit — prefer directional field, fall back to combined
        Long rawDirectional;
        if      (channel.contains("wire"))   rawDirectional = isOutward ? tierRule.dailyLimitWireOutward()   : tierRule.dailyLimitWireInward();
        else if (channel.contains("mobile")) rawDirectional = isOutward ? tierRule.dailyLimitMobileOutward() : tierRule.dailyLimitMobileInward();
        else if (channel.contains("ussd"))   rawDirectional = isOutward ? tierRule.dailyLimitUssdOutward()   : tierRule.dailyLimitUssdInward();
        else if (channel.contains("bdc"))    rawDirectional = isOutward ? tierRule.dailyLimitBdcOutward()    : tierRule.dailyLimitBdcInward();
        else                                 rawDirectional = isOutward ? tierRule.dailyLimitOtherOutward()  : tierRule.dailyLimitOtherInward();

        long dailyTierLimit;
        if (rawDirectional != null) {
          dailyTierLimit = rawDirectional;
        } else {
          if      (channel.contains("wire"))   dailyTierLimit = tierRule.dailyLimitWire();
          else if (channel.contains("mobile")) dailyTierLimit = tierRule.dailyLimitMobile();
          else if (channel.contains("ussd"))   dailyTierLimit = tierRule.dailyLimitUssd();
          else if (channel.contains("bdc"))    dailyTierLimit = tierRule.dailyLimitBdc();
          else                                 dailyTierLimit = tierRule.dailyLimitOther();
        }

        if (kycDailyChannelSum.add(transaction.amount()).longValue() > dailyTierLimit) {
          flags.add("KYC_TIER_DAILY_LIMIT_EXCEEDED");
          ruleScores.add(50 + tierRule.riskScoreBoost());
        }
      }
    }

    // Helpers: resolve effective per-direction threshold (null = rule disabled for this direction)
    // Rule 1: High-value transfer
    ThresholdRecord wireRule = thresholdRuleMap.get("high-value-wire");
    Long wireThreshold = wireRule == null ? null : (isOutward ? wireRule.thresholdOutward() : wireRule.thresholdInward());
    int wireScore = wireRule != null && wireRule.riskScore() != null ? wireRule.riskScore() : 35;
    if (wireThreshold != null && transaction.amount().longValue() > wireThreshold) {
      flags.add("high-value-wire");
      ruleScores.add(wireScore);
    }

    // Rule 2: Velocity clustering (direction-aware count threshold)
    ThresholdRecord velocityRule = thresholdRuleMap.get("velocity-cluster");
    Long velocityThreshold = velocityRule == null ? null : (isOutward ? velocityRule.thresholdOutward() : velocityRule.thresholdInward());
    int velocityScore = velocityRule != null && velocityRule.riskScore() != null ? velocityRule.riskScore() : 25;
    if (velocityThreshold != null && customerTxnCount24h > velocityThreshold) {
      flags.add("velocity-cluster");
      ruleScores.add(velocityScore);
    }

    // Rule 3: Late-night large transfer
    ThresholdRecord lateNightRule = thresholdRuleMap.get("late-night-large");
    Long lateNightThreshold = lateNightRule == null ? null : (isOutward ? lateNightRule.thresholdOutward() : lateNightRule.thresholdInward());
    int lateNightScore = lateNightRule != null && lateNightRule.riskScore() != null ? lateNightRule.riskScore() : 30;
    if (lateNightThreshold != null
        && isLateNight(transaction.occurredAt(), zone)
        && transaction.amount().longValue() > lateNightThreshold) {
      flags.add("late-night-large");
      ruleScores.add(lateNightScore);
    }

    // Rule 4: OTP attack (no direction filter — applies regardless)
    if (hasOtpAlert) {
      flags.add("OTP_ALERT");
      ruleScores.add(50);
    }

    // Rule 5: Institution-wide volume surge.
    // Compares today's transaction count against the institution's configured expected daily baseline.
    // Stored as an integer percentage (e.g. 130 = 1.30×, meaning 30% above the expected baseline).
    // The UI slider writes to thresholdOutward; fall back to thresholdValue for legacy rows.
    ThresholdRecord vsRule = thresholdRuleMap.get("velocity-spike");
    long spikeValue = vsRule != null
        ? (vsRule.thresholdOutward() != null ? vsRule.thresholdOutward() : vsRule.thresholdValue())
        : 130L;
    double spikeRatio  = spikeValue / 100.0;
    int    vsScore     = vsRule != null && vsRule.riskScore() != null ? vsRule.riskScore() : 20;
    long   expectedVol = expectedDailyTxnCount;
    if (expectedVol > 0 && todayCount > expectedVol * spikeRatio) {
      flags.add("VELOCITY_SPIKE");
      ruleScores.add(vsScore);
    }

    // Rule 6: Cross-border BDC
    ThresholdRecord bdcRule = thresholdRuleMap.get("cross-border-bdc");
    Long bdcThreshold = bdcRule == null ? null : (isOutward ? bdcRule.thresholdOutward() : bdcRule.thresholdInward());
    int bdcScore = bdcRule != null && bdcRule.riskScore() != null ? bdcRule.riskScore() : 30;
    if (bdcThreshold != null
        && "bdc".equalsIgnoreCase(transaction.channel())
        && transaction.amount().longValue() > bdcThreshold) {
      flags.add("cross-border-bdc");
      ruleScores.add(bdcScore);
    }

    // Rule 7: Dormant account reactivation
    // Fires when the account has been inactive for > 90 days AND the transaction amount
    // exceeds the configured direction-aware threshold.  New accounts (no prior transaction)
    // are NOT flagged — only accounts with a transaction history that went silent.
    ThresholdRecord dormantRule = thresholdRuleMap.get("dormant-reactivation");
    if (dormantRule != null && dormantRule.isActive() && lastTxnDate.isPresent()) {
      long dormantDays = java.time.temporal.ChronoUnit.DAYS.between(lastTxnDate.get(), java.time.OffsetDateTime.now());
      long dormantThreshold = isOutward
          ? (dormantRule.thresholdOutward() != null ? dormantRule.thresholdOutward() : dormantRule.thresholdValue())
          : (dormantRule.thresholdInward()  != null ? dormantRule.thresholdInward()  : dormantRule.thresholdValue());
      int dormantScore = dormantRule.riskScore() != null ? dormantRule.riskScore() : 25;
      if (dormantDays > 90 && transaction.amount().longValue() > dormantThreshold) {
        log.info("[DORMANT] customer={} inactive {}d, amount={} > threshold={} — flagged",
            transaction.customerId(), dormantDays, transaction.amount().longValue(), dormantThreshold);
        flags.add("DORMANT_REACTIVATION");
        ruleScores.add(dormantScore);
      }
    }

    return new TransactionScorer.ScoringResult(0, flags, "", ruleScores);
  }

  // ── Behavioral pattern scoring ────────────────────────────────────────────
  private TransactionScorer.ScoringResult scoreBehavioralPatterns(
      Transaction transaction,
      List<BehavioralRuleRecord> rules,
      CustomerBehavioralProfile profile,
      long todayCount,
      long yesterdayCount,
      long customerTxnCount24h,
      com.openiv.backend.aml.AmlSettings aml,
      List<String> alreadyFlagged) {

    java.util.ArrayList<String> flags      = new java.util.ArrayList<>();
    java.util.ArrayList<Integer> ruleScores = new java.util.ArrayList<>();

    // Platform-wide behavioral rules (existing)
    for (BehavioralRuleRecord rule : rules) {
      if (!rule.isActive()) continue;
      boolean triggered = false;
      if      ("pat-4".equals(rule.ruleId()) && yesterdayCount > 0 &&
               todayCount > yesterdayCount * rule.params().getDouble("spike_ratio", 1.5) &&
               !alreadyFlagged.contains("VELOCITY_SPIKE")) triggered = true;
      else if ("pat-5".equals(rule.ruleId()) &&
               customerTxnCount24h > rule.params().getInteger("max_daily_count", aml.dailyTxnLimit())) triggered = true;
      else if ("pat-2".equals(rule.ruleId()) &&
               transaction.amount().longValue() > rule.params().getLong("min_amount", 2_000_000L) &&
               "mobile".equalsIgnoreCase(transaction.channel()))                   triggered = true;

      if (triggered) {
        flags.add(rule.ruleId());
        int ruleScore = switch (rule.severity().toLowerCase()) {
          case "critical" -> 40; case "high" -> 30; case "medium" -> 15; default -> 10;
        };
        ruleScores.add(ruleScore);
      }
    }

    // Customer-level behavioral deviation — require at least 10 transactions for a stable statistical profile
    if (profile != null && profile.transactionCount() >= 10) {
      java.util.List<String> deviations = new java.util.ArrayList<>();

      // Amount deviation: > avg + 3 * stddev
      double avg    = profile.avgAmount().doubleValue();
      double stddev = profile.stddevAmount().doubleValue();
      double amount = transaction.amount().doubleValue();
      if (stddev > 0 && amount > avg + 3.0 * stddev) {
        deviations.add("transaction amount ₦" + String.format("%,.0f", amount) +
            " is significantly higher than this customer's usual amount of ₦" + String.format("%,.0f", avg));
      }

      // Channel deviation
      String ch = transaction.channel();
      if (ch != null && !ch.isBlank() && !profile.typicalChannels().isEmpty() &&
          profile.typicalChannels().stream().noneMatch(c -> c.equalsIgnoreCase(ch))) {
        deviations.add("transaction channel '" + ch + "' has not been used by this customer before");
      }

      // Hour-of-day deviation
      if (transaction.occurredAt() != null) {
        int hour = transaction.occurredAt().getHour();
        if (hour < profile.typicalHourMin() || hour > profile.typicalHourMax()) {
          deviations.add("transaction was initiated at " + String.format("%02d:00", hour) +
              ", outside this customer's usual activity window (" +
              String.format("%02d:00–%02d:00", profile.typicalHourMin(), profile.typicalHourMax()) + ")");
        }
      }

      // Recipient bank deviation
      String recipientBank = transaction.recipientBank();
      if (recipientBank != null && !recipientBank.isBlank() && !profile.typicalBanks().isEmpty() &&
          profile.typicalBanks().stream().noneMatch(b -> b.equalsIgnoreCase(recipientBank))) {
        deviations.add("funds are being sent to '" + recipientBank + "', a bank this customer has never used before");
      }

      // Category deviation — low weight: new category alone is weak signal
      String category = transaction.category();
      int categoryDeviations = 0;
      if (category != null && !category.isBlank() && !profile.typicalCategories().isEmpty() &&
          profile.typicalCategories().stream().noneMatch(c -> c.equalsIgnoreCase(category))) {
        deviations.add("transaction category '" + category + "' is outside this customer's normal spending pattern");
        categoryDeviations++;
      }

      if (!deviations.isEmpty()) {
        flags.add("BEHAVIORAL_PATTERN_DEVIATION");
        // Category deviations contribute only +3 each; structural deviations (amount, channel, time, bank) contribute +10 each
        int nonCatCount = deviations.size() - categoryDeviations;
        ruleScores.add(20 + nonCatCount * 10 + categoryDeviations * 3);
      }
    }

    return new TransactionScorer.ScoringResult(0, flags, "", ruleScores);
  }

  // ── DB helpers ────────────────────────────────────────────────────────────

  /** Returns the occurred_at of the most recent prior transaction for this customer. */
  private Future<java.util.Optional<java.time.OffsetDateTime>> findPreviousTransactionDate(
      long institutionId, String customerId, String excludeId) {
    return pool.preparedQuery(
            "SELECT occurred_at FROM transactions "
            + "WHERE institution_id = $1 AND customer_id = $2 AND id <> $3 "
            + "ORDER BY occurred_at DESC LIMIT 1")
        .execute(io.vertx.sqlclient.Tuple.of(institutionId, customerId, excludeId))
        .map(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) return java.util.Optional.<java.time.OffsetDateTime>empty();
          var odt = it.next().getOffsetDateTime("occurred_at");
          return odt != null
              ? java.util.Optional.of(odt)
              : java.util.Optional.<java.time.OffsetDateTime>empty();
        });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private boolean isLateNight(java.time.OffsetDateTime dt, java.time.ZoneId zone) {
    if (dt == null) return false;
    int hour = dt.atZoneSameInstant(zone).getHour();
    return hour >= 22 || hour < 6;
  }

  /** Returns one plain-English reason string per violated rule. */
  private java.util.List<String> buildFlagReasons(List<String> flags, int finalScore) {
    if (flags.isEmpty()) return java.util.List.of();
    java.util.List<String> reasons = new java.util.ArrayList<>();
    for (String flag : flags) {
      reasons.add(capitalize(translateFlag(flag)));
    }
    // Append risk guidance as the last bullet
    if (finalScore >= 75) {
      reasons.add("The overall risk score is " + finalScore + "/100 — in the critical range. " +
          "Place this transaction on hold immediately and open an investigation before releasing any funds.");
    } else if (finalScore >= 60) {
      reasons.add("The overall risk score is " + finalScore + "/100. " +
          "Review the transaction carefully and verify the details with the customer before releasing funds.");
    } else if (finalScore > 0) {
      reasons.add("The risk score of " + finalScore + "/100 warrants a closer look as part of your standard compliance process.");
    }
    return java.util.List.copyOf(reasons);
  }

  private static String capitalize(String s) {
    if (s == null || s.isEmpty()) return s;
    return Character.toUpperCase(s.charAt(0)) + s.substring(1);
  }

  private String translateFlag(String flag) {
    return switch (flag) {
      case "KYC_TIER_LIMIT_EXCEEDED" ->
          "the transaction amount exceeds the single-transaction limit permitted for this customer's current KYC verification tier";
      case "KYC_TIER_DAILY_LIMIT_EXCEEDED" ->
          "this transaction would push the customer's total spending today above the daily limit for their current KYC verification tier — a higher tier of identity verification is required to increase this limit";
      case "high-value-wire" ->
          "an unusually large wire transfer — amounts this high require additional scrutiny under AML policy";
      case "velocity-cluster" ->
          "multiple transactions were sent in rapid succession, which may indicate automated fraud or structuring";
      case "late-night-large" ->
          "a large transfer was initiated late at night outside normal banking hours, a pattern commonly linked to unauthorised account access";
      case "OTP_ALERT" ->
          "multiple failed authentication attempts were detected on this account shortly before the transaction, suggesting the account may have been compromised";
      case "VELOCITY_SPIKE" ->
          "an unusual surge in transaction volume was detected across the institution, which may signal a coordinated fraud event";
      case "cross-border-bdc" ->
          "this is a high-value cross-border foreign exchange transaction, which carries elevated AML and regulatory risk";
      case "pat-4" ->
          "a sudden spike in institution-wide transaction activity was detected, which may indicate a coordinated attack or system anomaly";
      case "pat-5" ->
          "this customer sent an unusually high number of transactions in a short period, which is outside their normal behaviour";
      case "pat-2" ->
          "an unusually high-value digital or mobile payment was detected that deviates significantly from this customer's transaction history";
      case "STALE_TIMESTAMP_ANOMALY" ->
          "the date and time recorded on this transaction is much older than when it arrived at our system — this may indicate a replay attack, a backdated entry, or a faulty source system clock";
      case "FUTURE_TIMESTAMP_ANOMALY" ->
          "the time recorded on this transaction is set in the future, which is not possible for a real transaction — this strongly indicates a forged or tampered timestamp";
      case "MICRO_TIMING_ANOMALY" ->
          "the transaction's recorded time matches the server clock with suspicious precision, suggesting it may have been generated by an automated script rather than a genuine customer action";
      case "TXN_IMPOSSIBLE_TRAVEL" ->
          "the customer's location changed faster than is physically possible between this and their previous transaction — the account may be compromised or accessed from multiple locations simultaneously";
      case "TXN_SUSPICIOUS_TRAVEL" ->
          "the implied travel speed between the customer's two most recent transaction locations is at the ceiling of commercial aviation, which is highly unusual";
      case "TXN_AIR_TRAVEL_REQUIRED" ->
          "reaching the location of this transaction from the customer's previous one would have required a flight, suggesting simultaneous access from multiple locations";
      case "TXN_HIGH_VELOCITY" ->
          "the customer's implied travel speed between transactions is abnormally high, which may indicate location spoofing";
      case "RAPID_POST_DEPOSIT_WITHDRAWAL" ->
          "this outward transfer is withdrawing a large portion of a deposit received by this customer very recently — a common pattern in money laundering and pass-through fraud";
      case "SUDDEN_WITHDRAWAL_AFTER_DEPOSIT" ->
          "an outward transfer was detected within minutes of a deposit landing on this account — a strong indicator of pass-through fraud, cash-out schemes, or mule account activity";
      case "BEHAVIORAL_PATTERN_DEVIATION" ->
          "this transaction deviates from the customer's established transaction patterns in one or more dimensions (amount, channel, time, or recipient)";
      case "CUSTOMER_RULE_MAX_AMOUNT"    -> "this transaction exceeds the maximum single-transaction amount configured for this customer";
      case "CUSTOMER_RULE_BLOCKED_BANK"  -> "this transaction involves a bank that has been specifically restricted for this customer";
      case "CUSTOMER_RULE_BANK_NOT_ALLOWED" -> "the destination bank is not on this customer's approved bank list";
      case "CUSTOMER_RULE_BLOCKED_CHANNEL"  -> "the transaction channel used is blocked for this customer";
      case "CUSTOMER_RULE_DAILY_LIMIT"   -> "this transaction would push the customer over their daily spending limit";
      case "CUSTOMER_RULE_MONTHLY_LIMIT" -> "this transaction would push the customer over their monthly spending limit";
      case "CUSTOMER_RULE_VELOCITY"      -> "this customer has exceeded the allowed number of transactions in the configured time window";
      case "CUSTOMER_RULE_VIOLATION"     -> "this transaction was flagged by a compliance rule configured for this customer";
      case "DORMANT_REACTIVATION" ->
          "this account was inactive for more than 90 days before this transaction — sudden reactivation with a large transfer is a common indicator of account takeover or identity fraud";
      default -> flag.toLowerCase().replace("_", " ");
    };
  }

  private Future<Void> sendCaseNotificationEmails(long institutionId, com.openiv.backend.cases.CaseRecord caseRecord) {
    return amlSettingsRepository.getByInstitution(institutionId)
        .compose(opt -> {
          if (opt.isEmpty() || opt.get().caseNotificationEmails() == null || opt.get().caseNotificationEmails().isEmpty())
            return Future.succeededFuture();
          List<Future<Void>> futures = new java.util.ArrayList<>();
          for (String email : opt.get().caseNotificationEmails()) {
            futures.add(emailSender.sendCaseNotification(email, caseRecord.id(), caseRecord.title(), caseRecord.priority(), caseRecord.brief()));
          }
          return Future.all(futures).<Void>mapEmpty();
        });
  }

  private Future<Void> updateTransactionRisk(long institutionId, String transactionId, int riskScore,
      String reason, java.util.List<String> flagReasons) {
    return updateTransactionRisk(institutionId, transactionId, riskScore, reason, flagReasons, null);
  }

  private Future<Void> updateTransactionRisk(long institutionId, String transactionId, int riskScore,
      String reason, java.util.List<String> flagReasons, String rulesSnapshotJson) {
    String flaggedStatus = riskScore > 0 ? "flagged" : null;
    JsonArray arr = new JsonArray();
    if (flagReasons != null) flagReasons.forEach(arr::add);
    return pool.preparedQuery(
        "UPDATE transactions SET risk_score = $1, flagged_status = $2, flag_reason = $3, " +
        "flag_reasons = $4::jsonb, rules_snapshot = $5::jsonb, updated_at = now() " +
        "WHERE id = $6 AND institution_id = $7")
        .execute(io.vertx.sqlclient.Tuple.of(riskScore, flaggedStatus, reason, arr.encode(),
            rulesSnapshotJson, transactionId, institutionId))
        .<Void>mapEmpty()
        .onFailure(e -> log.error("[HybridAnalysis] Failed to update risk for txn {}: {}", transactionId, e.getMessage()));
  }

  private static String buildRulesSnapshot(
      long institutionId,
      String transactionId,
      com.openiv.backend.aml.AmlSettings aml,
      List<ThresholdRecord> thresholds,
      List<BehavioralRuleRecord> behavioralRules,
      List<KycTierRecord> tierThresholds) {

    var amlJson = new io.vertx.core.json.JsonObject()
        .put("flagThreshold",       aml.riskScoreFlagThreshold())
        .put("caseThreshold",       aml.riskScoreCaseThreshold())
        .put("behFlagThreshold",    aml.behRiskScoreFlagThreshold())
        .put("behCaseThreshold",    aml.behRiskScoreCaseThreshold())
        .put("dailyTxnLimit",       aml.dailyTxnLimit())
        .put("beamWindowSeconds",   aml.beamWindowSeconds())
        .put("timezone",            aml.timezone());

    var threshArr = new JsonArray();
    for (ThresholdRecord t : thresholds) {
      threshArr.add(new io.vertx.core.json.JsonObject()
          .put("ruleId",           t.ruleId())
          .put("name",             t.name())
          .put("isActive",         t.isActive())
          .put("thresholdValue",   t.thresholdValue())
          .put("thresholdOutward", t.thresholdOutward())
          .put("thresholdInward",  t.thresholdInward())
          .put("unit",             t.unit())
          .put("riskScore",        t.riskScore()));
    }

    var behArr = new JsonArray();
    for (BehavioralRuleRecord b : behavioralRules) {
      behArr.add(new io.vertx.core.json.JsonObject()
          .put("ruleId",   b.ruleId())
          .put("name",     b.name())
          .put("isActive", b.isActive())
          .put("severity", b.severity())
          .put("params",   b.params()));
    }

    var tierArr = new JsonArray();
    for (KycTierRecord k : tierThresholds) {
      tierArr.add(new io.vertx.core.json.JsonObject()
          .put("tier",                   k.kycTier())
          .put("singleTxnLimitWire",     k.singleTxnLimitWire())
          .put("singleTxnLimitMobile",   k.singleTxnLimitMobile())
          .put("singleTxnLimitUssd",     k.singleTxnLimitUssd())
          .put("singleTxnLimitBdc",      k.singleTxnLimitBdc())
          .put("singleTxnLimitOther",    k.singleTxnLimitOther())
          .put("dailyLimitWireOutward",  k.dailyLimitWireOutward())
          .put("dailyLimitWireInward",   k.dailyLimitWireInward())
          .put("dailyLimitMobileOutward",k.dailyLimitMobileOutward())
          .put("dailyLimitMobileInward", k.dailyLimitMobileInward())
          .put("dailyLimitUssdOutward",  k.dailyLimitUssdOutward())
          .put("dailyLimitUssdInward",   k.dailyLimitUssdInward())
          .put("dailyLimitBdcOutward",   k.dailyLimitBdcOutward())
          .put("dailyLimitBdcInward",    k.dailyLimitBdcInward())
          .put("dailyLimitOtherOutward", k.dailyLimitOtherOutward())
          .put("dailyLimitOtherInward",  k.dailyLimitOtherInward())
          .put("riskScoreBoost",         k.riskScoreBoost()));
    }

    return new io.vertx.core.json.JsonObject()
        .put("capturedAt",          java.time.OffsetDateTime.now().toString())
        .put("institutionId",       institutionId)
        .put("transactionId",       transactionId)
        .put("amlSettings",         amlJson)
        .put("detectionThresholds", threshArr)
        .put("behavioralRules",     behArr)
        .put("kycTierThresholds",   tierArr)
        .encode();
  }

  @SuppressWarnings("unused")
  private static String notBlankOr(String first, String second, String fallback) {
    if (first != null && !first.isBlank()) return first;
    if (second != null && !second.isBlank()) return second;
    return fallback;
  }
}
