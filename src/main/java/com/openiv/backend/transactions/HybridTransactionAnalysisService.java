package com.openiv.backend.transactions;

import com.openiv.backend.aml.AmlSettingsRepository;
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
      CustomerRepository customerRepo) {
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

    return customerRuleRepo.listActiveByExternalCustomerId(institutionId, transaction.customerId())
        .<AnalysisResult>compose(customerRules -> {
          // ── Immediate (no-DB) customer rule checks ──────────────────────────
          java.util.List<String> custFlags = new java.util.ArrayList<>();
          java.util.List<Integer> custScores = new java.util.ArrayList<>();
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

          // ── Determine which aggregate queries are needed ──────────────────
          boolean needsDaily    = customerRules.stream().anyMatch(r -> r.isActive() && "daily_amount_limit".equals(r.ruleType()));
          boolean needsMonthly  = customerRules.stream().anyMatch(r -> r.isActive() && "monthly_amount_limit".equals(r.ruleType()));
          boolean needsVelocity = customerRules.stream().anyMatch(r -> r.isActive() && "transaction_velocity".equals(r.ruleType()));
          boolean needsRapidWd  = customerRules.stream().anyMatch(r -> r.isActive() && "rapid_post_deposit_withdrawal".equals(r.ruleType()));
          int vHours = customerRules.stream()
              .filter(r -> r.isActive() && "transaction_velocity".equals(r.ruleType()))
              .mapToInt(r -> r.params().getInteger("window_hours", 24)).max().orElse(24);
          int wdHours = customerRules.stream()
              .filter(r -> r.isActive() && "rapid_post_deposit_withdrawal".equals(r.ruleType()))
              .mapToInt(r -> r.params().getInteger("window_hours", 6)).max().orElse(6);

          Future<java.math.BigDecimal> fTodaySum   = needsDaily
              ? customerRuleRepo.sumTodayAmount(institutionId, transaction.customerId())
              : Future.succeededFuture(java.math.BigDecimal.ZERO);
          Future<java.math.BigDecimal> fMonthSum   = needsMonthly
              ? customerRuleRepo.sumMonthAmount(institutionId, transaction.customerId())
              : Future.succeededFuture(java.math.BigDecimal.ZERO);
          Future<Long> fVelocityCount = needsVelocity
              ? customerRuleRepo.countInVelocityWindow(institutionId, transaction.customerId(), vHours)
              : Future.succeededFuture(0L);
          Future<java.math.BigDecimal> fRecentDeposit = needsRapidWd
              ? customerRuleRepo.sumInwardAmountInWindow(institutionId, transaction.customerId(), wdHours)
              : Future.succeededFuture(java.math.BigDecimal.ZERO);

          return Future.all(fTodaySum, fMonthSum, fVelocityCount, fRecentDeposit)
              .<AnalysisResult>compose(aggRes -> {
                java.math.BigDecimal todaySum     = aggRes.resultAt(0);
                java.math.BigDecimal monthSum     = aggRes.resultAt(1);
                long velocityCount                = ((Long) aggRes.resultAt(2));
                java.math.BigDecimal recentDeposit = aggRes.resultAt(3);

                // ── Aggregate customer rule checks ────────────────────────────
                for (CustomerTransactionRule rule : customerRules) {
                  if (!rule.isActive()) continue;
                  if (!directionMatches(rule.direction(), transaction.direction())) continue;
                  switch (rule.ruleType()) {
                    case "daily_amount_limit" -> {
                      long maxD = rule.params().getLong("max_amount", Long.MAX_VALUE);
                      if (todaySum.add(transaction.amount()).longValue() > maxD) {
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
                      if (monthSum.add(transaction.amount()).longValue() > maxM) {
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
                      // Only fires on outward transactions that follow a recent deposit
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
                    default -> { }
                  }
                }

                Future<List<ThresholdRecord>> fThresholds         = thresholdRepository.list(institutionId);
                Future<List<KycTierRecord>>   fTierThresholds     = thresholdRepository.listKycTierThresholds(institutionId);
                Future<java.util.Optional<com.openiv.backend.aml.AmlSettings>> fAmlSettings =
                    amlSettingsRepository.getByInstitution(institutionId);
                Future<List<BehavioralRuleRecord>> fBehavioralRules = behavioralRuleRepository.list(institutionId);
                Future<Boolean>               fKycSuppressed      = thresholdRepository.getKycSuppressed(institutionId);
                Future<Integer>               fOverallRisk        = customerRepo.getOverallRiskScore(institutionId, transaction.customerId());
                Future<java.util.Optional<com.openiv.backend.kyc.KycPipelineResult>> fKyc =
                    kycService.getCustomerKycByInstitution(institutionId, transaction.customerId());
                Future<java.util.Optional<CustomerBehavioralProfile>> fProfile =
                    profileRepo.getProfile(institutionId, transaction.customerId());

                java.util.List<Future<?>> allFutures = java.util.List.of(
                    fThresholds, fTierThresholds, fAmlSettings,
                    fBehavioralRules, fKycSuppressed, fOverallRisk, fKyc, fProfile);

                return Future.all(new java.util.ArrayList<>(allFutures))
                    .<AnalysisResult>compose(results -> {
                      List<ThresholdRecord> thresholds                                  = results.resultAt(0);
                      List<KycTierRecord>   tierThresholds                              = results.resultAt(1);
                      java.util.Optional<com.openiv.backend.aml.AmlSettings> optAml    = results.resultAt(2);
                      List<BehavioralRuleRecord> behavioralRules                        = results.resultAt(3);
                      boolean kycSuppressed = Boolean.TRUE.equals((Boolean) results.resultAt(4));
                      int customerOverallRisk                                            = (Integer) results.resultAt(5);
                      java.util.Optional<com.openiv.backend.kyc.KycPipelineResult> optKyc = results.resultAt(6);
                      java.util.Optional<CustomerBehavioralProfile> optProfile          = results.resultAt(7);

                      boolean kycTierCheckEnabled = !kycSuppressed && !skipKyc;
                      int customerKycTier = optKyc.map(k -> k.kycTier()).orElse(0);

                      com.openiv.backend.aml.AmlSettings aml = optAml.orElse(
                          new com.openiv.backend.aml.AmlSettings(0, institutionId, false, null, 51, 81, 60, 85, 30, 30, 180, "Africa/Lagos", 40, 75));
                      java.time.ZoneId zone         = java.time.ZoneId.of(aml.timezone());
                      int beamWindowSeconds         = aml.beamWindowSeconds();

                      // ── MICRO TIMING ANOMALY (Critical) ────────────────────
                      java.time.OffsetDateTime now     = java.time.OffsetDateTime.now(zone);
                      java.time.OffsetDateTime txnTime = transaction.occurredAt();
                      if (txnTime != null) {
                        long signedDiff  = java.time.temporal.ChronoUnit.SECONDS.between(txnTime, now);
                        long secondsDiff = Math.abs(signedDiff);
                        if (secondsDiff <= 5) {
                          log.warn("[CRITICAL] Micro-Timing Anomaly on txn={} ({}s ago). Risk=96%", transaction.id(), secondsDiff);
                          java.util.List<String> anomalyFlags = java.util.List.of("MICRO_TIMING_ANOMALY");
                          java.util.List<String> reasons = buildFlagReasons(anomalyFlags, 96);
                          return caseService.createCaseFromTransaction(institutionId, transaction,
                              new TransactionScorer.ScoringResult(96, anomalyFlags, reasons.isEmpty() ? "" : reasons.get(0)))
                              .compose(caseRecord -> {
                                sendCaseNotificationEmails(institutionId, caseRecord)
                                    .onFailure(e -> log.warn("[Case Notifications] micro-timing case {}: {}", caseRecord.id(), e.getMessage()));
                                return Future.succeededFuture(new AnalysisResult(96, TransactionScorer.getPriority(96),
                                    anomalyFlags, caseRecord.id(), null, true, false, true, "DECLINE", reasons));
                              });
                        }

                        // ── STALE / FUTURE TIMESTAMP (Critical) ──────────────
                        String anomalyKind   = null;
                        String friendlyReason = null;
                        if (signedDiff < -beamWindowSeconds) {
                          anomalyKind = "FUTURE_TIMESTAMP_ANOMALY";
                          long minutesAhead = Math.max(1, Math.abs(signedDiff) / 60);
                          friendlyReason = "The time recorded for this transaction is " + minutesAhead +
                              " minute" + (minutesAhead == 1 ? "" : "s") +
                              " ahead of our system clock. A real transaction can never happen in the future — " +
                              "this is a strong sign of a tampered timestamp or a possible cyber attack.";
                        } else if (signedDiff > beamWindowSeconds) {
                          long hoursOld  = signedDiff >= 3600 ? signedDiff / 3600 : 0;
                          long minutesOld = (signedDiff % 3600) / 60;
                          String ageDesc  = hoursOld > 0 ? hoursOld + " hour" + (hoursOld == 1 ? "" : "s")
                                                          : minutesOld + " minute" + (minutesOld == 1 ? "" : "s");
                          anomalyKind = "STALE_TIMESTAMP_ANOMALY";
                          friendlyReason = "The time recorded on this transaction is " + ageDesc +
                              " older than when it arrived at our system. This may indicate a replay attack, " +
                              "backdated entry, or a faulty source system clock.";
                        }
                        if (anomalyKind != null) {
                          log.warn("[CRITICAL] {} on txn={}. Risk=95%", anomalyKind, transaction.id());
                          final String ruleName = anomalyKind;
                          final String reason   = friendlyReason;
                          java.util.List<String> anomalyFlags = java.util.List.of(ruleName);
                          java.util.List<String> reasons = java.util.List.of(reason);
                          return updateTransactionRisk(institutionId, transaction.id(), 95, reason, reasons)
                              .compose(v -> caseService.createCaseFromTransaction(institutionId, transaction,
                                  new TransactionScorer.ScoringResult(95, anomalyFlags, reason)))
                              .compose(caseRecord -> {
                                sendCaseNotificationEmails(institutionId, caseRecord)
                                    .onFailure(e -> log.warn("[Case Notifications] {} case {}: {}", ruleName, caseRecord.id(), e.getMessage()));
                                return Future.succeededFuture(new AnalysisResult(95, TransactionScorer.getPriority(95),
                                    anomalyFlags, caseRecord.id(), null, true, false, true, "DECLINE", reasons));
                              });
                        }
                      }

                      // ── GEO-VELOCITY CHECK ──────────────────────────────────
                      GeoVelocityChecker.GeoVelocityResult geoResult =
                          GeoVelocityChecker.check(transaction, previousTransactionWithLocation);

                      if (geoResult.triggered() && "TXN_IMPOSSIBLE_TRAVEL".equals(geoResult.ruleId())) {
                        log.warn("[CRITICAL] TXN_IMPOSSIBLE_TRAVEL on txn={}: {}km/h", transaction.id(),
                            geoResult.impliedSpeedKmh() == Double.MAX_VALUE ? "∞" : String.format("%.0f", geoResult.impliedSpeedKmh()));
                        java.util.List<String> geoFlags = java.util.List.of("TXN_IMPOSSIBLE_TRAVEL");
                        java.util.List<String> geoReasons = java.util.List.of(geoResult.reason());
                        return updateTransactionRisk(institutionId, transaction.id(), 93, geoResult.reason(), geoReasons)
                            .compose(v -> caseService.createCaseFromTransaction(institutionId, transaction,
                                new TransactionScorer.ScoringResult(93, geoFlags, geoResult.reason())))
                            .compose(caseRecord -> {
                              sendCaseNotificationEmails(institutionId, caseRecord)
                                  .onFailure(e -> log.warn("[Case Notifications] geo-velocity case {}: {}", caseRecord.id(), e.getMessage()));
                              return Future.succeededFuture(new AnalysisResult(93, TransactionScorer.getPriority(93),
                                  geoFlags, caseRecord.id(), null, true, false, true, "DECLINE", geoReasons));
                            });
                      }

                      // ── RULE SCORING ────────────────────────────────────────
                      TransactionScorer.ScoringResult txnResult = scoreWithThresholds(
                          transaction, thresholds, tierThresholds,
                          todayCount, yesterdayCount, customerTxnCount24h,
                          hasOtpAlert, kycTierCheckEnabled, customerKycTier, zone);

                      TransactionScorer.ScoringResult behResult = scoreBehavioralPatterns(
                          transaction, behavioralRules, optProfile.orElse(null),
                          todayCount, yesterdayCount, customerTxnCount24h);

                      java.util.List<Integer> allRuleScores = new java.util.ArrayList<>();
                      allRuleScores.addAll(txnResult.ruleScores);
                      allRuleScores.addAll(behResult.ruleScores);
                      if (geoResult.triggered()) allRuleScores.add(geoResult.scoreContribution());
                      allRuleScores.addAll(custScores);

                      java.util.List<String> combinedFlags = new java.util.ArrayList<>();
                      combinedFlags.addAll(txnResult.flags);
                      combinedFlags.addAll(behResult.flags);
                      if (geoResult.triggered()) combinedFlags.add(geoResult.ruleId());
                      combinedFlags.addAll(custFlags);

                      // ── NEW SCORING FORMULA ──────────────────────────────────
                      // score = min(100, maxRuleScore + (violations−1)×7 + 20 + customerPremium)
                      int customerPremium = customerOverallRisk >= 70 ? 15 : customerOverallRisk >= 40 ? 8 : 0;
                      int computedScore = 0;
                      if (!allRuleScores.isEmpty() && !combinedFlags.isEmpty()) {
                        int maxScore = allRuleScores.stream().mapToInt(Integer::intValue).max().orElse(0);
                        int violations = allRuleScores.size();
                        computedScore = Math.min(100, maxScore + (violations - 1) * 7 + 20 + customerPremium);
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

                      return updateTransactionRisk(institutionId, transaction.id(), finalScore, legacyReason, flagReasons)
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
      case "rapid_post_deposit_withdrawal"   -> "RAPID_POST_DEPOSIT_WITHDRAWAL";
      case "behavioral_pattern_deviation"    -> "BEHAVIORAL_PATTERN_DEVIATION";
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
      java.time.ZoneId zone) {

    java.util.ArrayList<String> flags      = new java.util.ArrayList<>();
    java.util.ArrayList<Integer> ruleScores = new java.util.ArrayList<>();

    java.util.Map<String, ThresholdRecord> thresholdRuleMap = thresholds.stream()
        .filter(ThresholdRecord::isActive)
        .collect(java.util.stream.Collectors.toMap(ThresholdRecord::ruleId, r -> r));

    String txnDir = transaction.direction() != null ? transaction.direction() : "outward";
    boolean isOutward = "outward".equals(txnDir);

    // Rule 0: KYC Tier limits (uses actual customer tier from KYC pipeline result)
    if (kycTierCheckEnabled && !tierThresholds.isEmpty()) {
      KycTierRecord tierRule = tierThresholds.stream()
          .filter(t -> t.kycTier() == customerKycTier)
          .findFirst().orElse(null);

      if (tierRule != null) {
        long amount = transaction.amount().longValue();
        String channel = transaction.channel() != null ? transaction.channel().toLowerCase() : "";
        long channelLimit;
        if      (channel.contains("wire"))   channelLimit = tierRule.dailyLimitWire();
        else if (channel.contains("mobile")) channelLimit = tierRule.dailyLimitMobile();
        else if (channel.contains("ussd"))   channelLimit = tierRule.dailyLimitUssd();
        else if (channel.contains("bdc"))    channelLimit = tierRule.dailyLimitBdc();
        else                                 channelLimit = tierRule.dailyLimitOther();

        if (amount > channelLimit) {
          flags.add("KYC_TIER_LIMIT_EXCEEDED");
          ruleScores.add(45 + tierRule.riskScoreBoost());
        }
      }
    }

    // Helpers: resolve effective per-direction threshold (null = rule disabled for this direction)
    // Rule 1: High-value transfer
    ThresholdRecord wireRule = thresholdRuleMap.get("high-value-wire");
    Long wireThreshold = wireRule == null ? null : (isOutward ? wireRule.thresholdOutward() : wireRule.thresholdInward());
    if (wireThreshold != null && transaction.amount().longValue() > wireThreshold) {
      flags.add("high-value-wire");
      ruleScores.add(35);
    }

    // Rule 2: Velocity clustering (direction-aware count threshold)
    ThresholdRecord velocityRule = thresholdRuleMap.get("velocity-cluster");
    Long velocityThreshold = velocityRule == null ? null : (isOutward ? velocityRule.thresholdOutward() : velocityRule.thresholdInward());
    if (velocityThreshold != null && customerTxnCount24h > velocityThreshold) {
      flags.add("velocity-cluster");
      ruleScores.add(25);
    }

    // Rule 3: Late-night large transfer
    ThresholdRecord lateNightRule = thresholdRuleMap.get("late-night-large");
    Long lateNightThreshold = lateNightRule == null ? null : (isOutward ? lateNightRule.thresholdOutward() : lateNightRule.thresholdInward());
    if (lateNightThreshold != null
        && isLateNight(transaction.occurredAt(), zone)
        && transaction.amount().longValue() > lateNightThreshold) {
      flags.add("late-night-large");
      ruleScores.add(30);
    }

    // Rule 4: OTP attack (no direction filter — applies regardless)
    if (hasOtpAlert) {
      flags.add("OTP_ALERT");
      ruleScores.add(50);
    }

    // Rule 5: Volume spike (institution-level, no direction filter)
    if (todayCount > yesterdayCount * 1.3) {
      flags.add("VELOCITY_SPIKE");
      ruleScores.add(20);
    }

    // Rule 6: Cross-border BDC
    ThresholdRecord bdcRule = thresholdRuleMap.get("cross-border-bdc");
    Long bdcThreshold = bdcRule == null ? null : (isOutward ? bdcRule.thresholdOutward() : bdcRule.thresholdInward());
    if (bdcThreshold != null
        && "bdc".equalsIgnoreCase(transaction.channel())
        && transaction.amount().longValue() > bdcThreshold) {
      flags.add("cross-border-bdc");
      ruleScores.add(30);
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
      long customerTxnCount24h) {

    java.util.ArrayList<String> flags      = new java.util.ArrayList<>();
    java.util.ArrayList<Integer> ruleScores = new java.util.ArrayList<>();

    // Platform-wide behavioral rules (existing)
    for (BehavioralRuleRecord rule : rules) {
      if (!rule.isActive()) continue;
      boolean triggered = false;
      if      ("pat-4".equals(rule.ruleId()) && todayCount > yesterdayCount * 1.5) triggered = true;
      else if ("pat-5".equals(rule.ruleId()) && customerTxnCount24h > 10)          triggered = true;
      else if ("pat-2".equals(rule.ruleId()) &&
               transaction.amount().longValue() > 2_000_000L &&
               "mobile".equalsIgnoreCase(transaction.channel()))                   triggered = true;

      if (triggered) {
        flags.add(rule.ruleId());
        int ruleScore = switch (rule.severity().toLowerCase()) {
          case "critical" -> 40; case "high" -> 30; case "medium" -> 15; default -> 10;
        };
        ruleScores.add(ruleScore);
      }
    }

    // Customer-level behavioral deviation (requires an existing profile)
    if (profile != null && profile.transactionCount() >= 5) {
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

      // Category deviation
      String category = transaction.category();
      if (category != null && !category.isBlank() && !profile.typicalCategories().isEmpty() &&
          profile.typicalCategories().stream().noneMatch(c -> c.equalsIgnoreCase(category))) {
        deviations.add("transaction category '" + category + "' is outside this customer's normal spending pattern");
      }

      if (!deviations.isEmpty()) {
        flags.add("BEHAVIORAL_PATTERN_DEVIATION");
        // Severity scales with number of deviating dimensions
        ruleScores.add(20 + deviations.size() * 10);
      }
    }

    return new TransactionScorer.ScoringResult(0, flags, "", ruleScores);
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
          "the transaction amount exceeds the limit permitted for this customer's current KYC verification tier";
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
    String flaggedStatus = riskScore > 0 ? "flagged" : "normal";
    // Encode flagReasons as a JSONB-compatible JSON array string
    JsonArray arr = new JsonArray();
    if (flagReasons != null) flagReasons.forEach(arr::add);
    return pool.preparedQuery(
        "UPDATE transactions SET risk_score = $1, flagged_status = $2, flag_reason = $3, " +
        "flag_reasons = $4::jsonb, updated_at = now() " +
        "WHERE id = $5 AND institution_id = $6")
        .execute(io.vertx.sqlclient.Tuple.of(riskScore, flaggedStatus, reason, arr.encode(), transactionId, institutionId))
        .<Void>mapEmpty()
        .onFailure(e -> log.error("[HybridAnalysis] Failed to update risk for txn {}: {}", transactionId, e.getMessage()));
  }

  @SuppressWarnings("unused")
  private static String notBlankOr(String first, String second, String fallback) {
    if (first != null && !first.isBlank()) return first;
    if (second != null && !second.isBlank()) return second;
    return fallback;
  }
}
