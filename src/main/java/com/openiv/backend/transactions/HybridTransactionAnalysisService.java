package com.openiv.backend.transactions;

import com.openiv.backend.aml.AmlSettingsRepository;
import com.openiv.backend.behavioral.BehavioralRuleRepository;
import com.openiv.backend.behavioral.BehavioralRuleRecord;
import com.openiv.backend.cases.AutoCaseCreationService;
import com.openiv.backend.auth.service.EmailSender;
import com.openiv.backend.kyc.KycService;
import com.openiv.backend.thresholds.ThresholdRepository;
import com.openiv.backend.thresholds.KycTierRecord;
import com.openiv.backend.thresholds.ThresholdRecord;
import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;

/**
 * Rule-based fraud detection for transactions.
 * Applies institution-configured thresholds to score and create cases.
 */
public class HybridTransactionAnalysisService {
  private static final Logger log = LoggerFactory.getLogger(HybridTransactionAnalysisService.class);

  private final TransactionScorer scorer;
  private final AutoCaseCreationService caseService;
  private final ThresholdRepository thresholdRepository;
  private final Pool pool;
  private final KycService kycService;
  private final AmlSettingsRepository amlSettingsRepository;
  private final EmailSender emailSender;
  private final BehavioralRuleRepository behavioralRuleRepository;

  public record AnalysisResult(
      int riskScore,
      String priority,
      List<String> triggeredRules,
      String caseid,
      String aiAnalysis,
      boolean caseCreated,
      boolean aiAnalyzed,
      boolean shouldFlag,
      String recommendedAction) {
  }

  public HybridTransactionAnalysisService(
      TransactionScorer scorer,
      AutoCaseCreationService caseService,
      ThresholdRepository thresholdRepository,
      Pool pool,
      KycService kycService,
      AmlSettingsRepository amlSettingsRepository,
      EmailSender emailSender,
      BehavioralRuleRepository behavioralRuleRepository) {
    this.scorer = scorer;
    this.caseService = caseService;
    this.thresholdRepository = thresholdRepository;
    this.pool = pool;
    this.kycService = kycService;
    this.amlSettingsRepository = amlSettingsRepository;
    this.emailSender = emailSender;
    this.behavioralRuleRepository = behavioralRuleRepository;
  }

  /**
   * Analyze transaction with rule-based scoring:
   * 1. Load institution's risk thresholds
   * 2. Score with rules
   * 3. Auto-create case if needed
   * 4. Verify KYC data if available
   * 5. Return analysis result
   */
  public Future<AnalysisResult> analyzeTransaction(
      long institutionId,
      Transaction transaction,
      long todayCount,
      long yesterdayCount,
      long customerTxnCount24h,
      boolean hasOtpAlert,
      boolean skipKyc,
      Optional<Transaction> previousTransactionWithLocation) {

    Future<List<ThresholdRecord>>  fThresholds    = thresholdRepository.list(institutionId);
    Future<List<KycTierRecord>>    fTierThresholds = thresholdRepository.listKycTierThresholds(institutionId);
    Future<Boolean>                fHasKycConfig  = kycService.hasConfigForInstitution(institutionId);
    Future<java.util.Optional<com.openiv.backend.aml.AmlSettings>> fAmlSettings = amlSettingsRepository.getByInstitution(institutionId);
    Future<List<BehavioralRuleRecord>> fBehavioralRules = behavioralRuleRepository.list(institutionId);
    Future<Boolean>                fKycSuppressed = thresholdRepository.getKycSuppressed(institutionId);

    return Future.all(fThresholds, fTierThresholds, fHasKycConfig, fAmlSettings, fBehavioralRules, fKycSuppressed)
        .compose(results -> {
          List<ThresholdRecord> thresholds     = results.resultAt(0);
          List<KycTierRecord>   tierThresholds = results.resultAt(1);
          boolean               hasKycConfig   = Boolean.TRUE.equals((Boolean) results.resultAt(2));
          java.util.Optional<com.openiv.backend.aml.AmlSettings> optAmlSettings = results.resultAt(3);
          List<BehavioralRuleRecord> behavioralRules = results.resultAt(4);
          boolean               kycSuppressed  = Boolean.TRUE.equals((Boolean) results.resultAt(5));

          // Bypass KYC tier check when KYC warning is suppressed, no KYC data source is configured, or explicitly skipped (e.g. for Beams)
          boolean kycTierCheckEnabled = hasKycConfig && !kycSuppressed && !skipKyc;
          if (kycSuppressed && !hasKycConfig) {
            log.info("[HybridAnalysis] KYC tier check bypassed for txn={} (suppressed, no data source)", transaction.id());
          }
          
          com.openiv.backend.aml.AmlSettings amlSettings = optAmlSettings.orElse(new com.openiv.backend.aml.AmlSettings(0, institutionId, false, null, 51, 81, 60, 85, 30, 30, 180, "Africa/Lagos"));
          java.time.ZoneId zone = java.time.ZoneId.of(amlSettings.timezone());
          int beamWindowSeconds = amlSettings.beamWindowSeconds();

          // ─────────────────────────────────────────────────────────────────
          // MICRO TIMING ANOMALY CHECK (Critical Security Rule)
          // If transaction occurred within ±5 seconds of system time,
          // it's likely an injection attack or API manipulation.
          // Score 96% and auto-create case immediately.
          // ─────────────────────────────────────────────────────────────────
          java.time.OffsetDateTime now = java.time.OffsetDateTime.now(zone);
          java.time.OffsetDateTime txnTime = transaction.occurredAt();
          if (txnTime != null) {
            long signedDiff = java.time.temporal.ChronoUnit.SECONDS.between(txnTime, now);
            long secondsDiff = Math.abs(signedDiff);
            if (secondsDiff <= 5) {
              log.warn("[CRITICAL] Micro-Timing Anomaly detected on txn={} (occurred {} seconds ago). Risk=96%, auto-creating case.",
                  transaction.id(), secondsDiff);
              java.util.List<String> anomalyFlags = java.util.List.of("MICRO_TIMING_ANOMALY");
              AnalysisResult anomalyResult = new AnalysisResult(
                  96,
                  TransactionScorer.getPriority(96),
                  anomalyFlags,
                  null, null,
                  false, false, true, "DECLINE");
              // Auto-create case for this critical anomaly
              return caseService.createCaseFromTransaction(institutionId, transaction,
                  new TransactionScorer.ScoringResult(96, anomalyFlags, "Micro-timing anomaly detected"))
                  .compose(caseRecord -> {
                    AnalysisResult caseResult = new AnalysisResult(
                        anomalyResult.riskScore(),
                        anomalyResult.priority(),
                        anomalyResult.triggeredRules(),
                        caseRecord.id(),
                        null,
                        true,
                        false,
                        anomalyResult.shouldFlag(),
                        anomalyResult.recommendedAction());
                    sendCaseNotificationEmails(institutionId, caseRecord)
                        .onFailure(e -> log.warn("[Case Notifications] Failed to send emails for micro-timing case {}: {}",
                            caseRecord.id(), e.getMessage()));
                    return Future.succeededFuture(caseResult);
                  });
            }

            // ─────────────────────────────────────────────────────────────
            // STALE / FUTURE TIMESTAMP ANOMALY (Critical Security Rule)
            // occurred_at >24h old → likely replay or batched-import abuse.
            // occurred_at >5min in the future → likely clock tamper.
            // Score 95% and auto-create case immediately.
            // ─────────────────────────────────────────────────────────────
            String anomalyKind = null;
            String anomalyDetail = null;
            String friendlyReason = null;
            if (signedDiff < -beamWindowSeconds) {
              anomalyKind = "FUTURE_TIMESTAMP_ANOMALY";
              long secondsAhead = Math.abs(signedDiff);
              long minutesAhead = Math.max(1, secondsAhead / 60);
              anomalyDetail = String.format("occurred_at is %d seconds ahead of server time", secondsAhead);
              friendlyReason = "The time recorded for this transaction is " + minutesAhead +
                  " minute" + (minutesAhead == 1 ? "" : "s") +
                  " ahead of our system clock. A real transaction can never happen in the future, so this " +
                  "usually means the source system's clock has been tampered with or someone is forging " +
                  "timestamps. This is a strong signal of a possible cyber attack and should be investigated " +
                  "right away.";
            } else if (signedDiff > beamWindowSeconds) {
              long hoursOld = signedDiff >= 3600 ? signedDiff / 3600 : 0;
              long minutesOld = (signedDiff % 3600) / 60;
              String ageDesc = hoursOld > 0
                  ? hoursOld + " hour" + (hoursOld == 1 ? "" : "s")
                  : minutesOld + " minute" + (minutesOld == 1 ? "" : "s");
              anomalyKind = "STALE_TIMESTAMP_ANOMALY";
              anomalyDetail = String.format("occurred_at is %s old", ageDesc);
              friendlyReason = "The time recorded for this transaction is " + ageDesc +
                  " older than the time it actually reached our system. When the transaction time " +
                  "and the arrival time are this far apart, it usually means one of three things: the source " +
                  "system's clock is out of sync, the request was replayed by an attacker, or someone is " +
                  "trying to backdate activity. Any of these is a possible sign of a cyber attack and should " +
                  "be looked into.";
            }
            if (anomalyKind != null) {
              log.warn("[CRITICAL] {} detected on txn={} ({}). Risk=95%, auto-creating case.",
                  anomalyKind, transaction.id(), anomalyDetail);
              final String ruleName = anomalyKind;
              final String reason = friendlyReason;
              java.util.List<String> anomalyFlags = java.util.List.of(ruleName);
              
              // Ensure the transaction record in DB gets the 95% risk score
              return updateTransactionRisk(institutionId, transaction.id(), 95)
                .compose(v -> caseService.createCaseFromTransaction(institutionId, transaction,
                    new TransactionScorer.ScoringResult(95, anomalyFlags, reason)))
                .compose(caseRecord -> {
                  AnalysisResult caseResult = new AnalysisResult(
                      95,
                      TransactionScorer.getPriority(95),
                      anomalyFlags,
                      caseRecord.id(),
                      null,
                      true,
                      false,
                      true,
                      "DECLINE");
                  sendCaseNotificationEmails(institutionId, caseRecord)
                      .onFailure(e -> log.warn("[Case Notifications] Failed to send emails for {} case {}: {}",
                          ruleName, caseRecord.id(), e.getMessage()));
                  return Future.succeededFuture(caseResult);
                });
            }
          }

          // ─────────────────────────────────────────────────────────────────
          // GEO-VELOCITY CHECK
          // Compare this transaction's coordinates with the customer's most
          // recent prior transaction.  Impossible travel (> 1,050 km/h, the
          // absolute ceiling for any commercial aircraft) short-circuits with
          // a hard score of 93 and an auto-created case, matching the same
          // pattern used by the timestamp anomaly rules above.
          // Lower-severity tiers (air-travel-required, high-velocity) are
          // folded into the normal weighted-average scoring below.
          // ─────────────────────────────────────────────────────────────────
          GeoVelocityChecker.GeoVelocityResult geoResult =
              GeoVelocityChecker.check(transaction, previousTransactionWithLocation);

          if (geoResult.triggered() && "TXN_IMPOSSIBLE_TRAVEL".equals(geoResult.ruleId())) {
            log.warn("[CRITICAL] TXN_IMPOSSIBLE_TRAVEL on txn={}: dist={}km speed={}km/h elapsed={}min",
                transaction.id(),
                String.format("%.1f", geoResult.distanceKm()),
                geoResult.impliedSpeedKmh() == Double.MAX_VALUE ? "∞" : String.format("%.0f", geoResult.impliedSpeedKmh()),
                String.format("%.1f", geoResult.elapsedMinutes()));
            java.util.List<String> geoFlags = java.util.List.of("TXN_IMPOSSIBLE_TRAVEL");
            return updateTransactionRisk(institutionId, transaction.id(), 93)
                .compose(v -> caseService.createCaseFromTransaction(institutionId, transaction,
                    new TransactionScorer.ScoringResult(93, geoFlags, geoResult.reason())))
                .compose(caseRecord -> {
                  AnalysisResult caseResult = new AnalysisResult(
                      93, TransactionScorer.getPriority(93), geoFlags,
                      caseRecord.id(), null, true, false, true, "DECLINE");
                  sendCaseNotificationEmails(institutionId, caseRecord)
                      .onFailure(e -> log.warn("[Case Notifications] Failed for geo-velocity case {}: {}",
                          caseRecord.id(), e.getMessage()));
                  return Future.succeededFuture(caseResult);
                });
          }

          TransactionScorer.ScoringResult txnResult = scoreWithThresholds(
              transaction, thresholds, tierThresholds,
              todayCount, yesterdayCount, customerTxnCount24h, hasOtpAlert, kycTierCheckEnabled, zone);

          TransactionScorer.ScoringResult behResult = scoreBehavioralPatterns(
              transaction, behavioralRules, todayCount, yesterdayCount, customerTxnCount24h);

          java.util.List<Integer> allRuleScores = new java.util.ArrayList<>();
          allRuleScores.addAll(txnResult.ruleScores);
          allRuleScores.addAll(behResult.ruleScores);

          // Fold non-critical geo-velocity flags into the weighted average
          if (geoResult.triggered()) {
            allRuleScores.add(geoResult.scoreContribution());
          }

          int finalScore = 0;
          if (!allRuleScores.isEmpty()) {
            double sum = 0;
            for (int s : allRuleScores) sum += s;
            // Average all triggered rules across both categories, then add a single 20-point baseline
            finalScore = (int) Math.min(100, Math.round(sum / allRuleScores.size()) + 20);
          }
          
          java.util.List<String> combinedFlags = new java.util.ArrayList<>();
          combinedFlags.addAll(txnResult.flags);
          combinedFlags.addAll(behResult.flags);
          if (geoResult.triggered()) {
            combinedFlags.add(geoResult.ruleId());
          }

          String finalReason = buildHumanReadableReason(combinedFlags, finalScore);
          TransactionScorer.ScoringResult scoringResult = new TransactionScorer.ScoringResult(
              finalScore, combinedFlags, finalReason, allRuleScores);

          // Legacy override to avoid breaking next block:

          if (scoringResult.score == 0) {
            scoringResult.flags.clear();
          }

          boolean shouldCase = finalScore >= amlSettings.riskScoreCaseThreshold();
          boolean shouldFlag = finalScore >= amlSettings.riskScoreFlagThreshold();
          
          String recommendedAction = "ALLOW";
          if (shouldCase) recommendedAction = "DECLINE";
          else if (shouldFlag) recommendedAction = "HOLD";

          log.info("[HybridAnalysis] txn={} risk={} rules={}",
              transaction.id(), scoringResult.score, scoringResult.flags);

          AnalysisResult result = new AnalysisResult(
              scoringResult.score,
              TransactionScorer.getPriority(scoringResult.score),
              scoringResult.flags,
              null, null,
              false, false, shouldFlag, recommendedAction);

          // Crucial: Update the transaction record in the database with the calculated score 
          // BEFORE returning or sending notifications. This fixes dashboard inconsistency.
          return updateTransactionRisk(institutionId, transaction.id(), scoringResult.score)
              .<AnalysisResult>compose(v -> {
                if (!shouldCase) {
                  return Future.succeededFuture(result);
                }

                return caseService.createCaseFromTransaction(institutionId, transaction, scoringResult)
                    .compose(caseRecord -> {
                      AnalysisResult caseResult = new AnalysisResult(
                          result.riskScore(), result.priority(), result.triggeredRules(),
                          caseRecord.id(), null, true, false, result.shouldFlag(), result.recommendedAction());
                      thresholdRepository.getKycSuppressed(institutionId)
                          .onSuccess(suppressed -> {
                            if (!suppressed) {
                              kycService.lookupForPipeline(institutionId, transaction.customerId(), caseRecord.id())
                                  .onFailure(e -> log.warn("[KYC Pipeline] lookup failed for txn {}: {}",
                                      transaction.id(), e.getMessage()));
                            } else {
                              log.info("[KYC Pipeline] lookup skipped for txn {} (suppressed)", transaction.id());
                            }
                          });

                      sendCaseNotificationEmails(institutionId, caseRecord)
                          .onFailure(e -> log.warn("[Case Notifications] Failed to send emails for case {}: {}",
                              caseRecord.id(), e.getMessage()));

                      return Future.<AnalysisResult>succeededFuture(caseResult);
                    });
              });
        })
        .onFailure(e -> log.error("[HybridAnalysis] Analysis failed for txn {}",
            transaction.id(), e));
  }

  /**
   * Score transaction using institution's custom thresholds.
   */
  private TransactionScorer.ScoringResult scoreWithThresholds(
      Transaction transaction,
      List<ThresholdRecord> thresholds,
      List<KycTierRecord> tierThresholds,
      long todayCount,
      long yesterdayCount,
      long customerTxnCount24h,
      boolean hasOtpAlert,
      boolean kycTierCheckEnabled,
      java.time.ZoneId zone) {

    java.util.ArrayList<String> flags = new java.util.ArrayList<>();
    java.util.ArrayList<Integer> ruleScores = new java.util.ArrayList<>();

    java.util.Map<String, Long> thresholdMap = thresholds.stream()
        .filter(ThresholdRecord::isActive)
        .collect(java.util.stream.Collectors.toMap(
            ThresholdRecord::ruleId, ThresholdRecord::thresholdValue));

    log.info("[HybridAnalysis] Evaluating txn={} amount={} channel={} active_rules={}",
        transaction.id(), transaction.amount(), transaction.channel(), thresholdMap.keySet());

    // Rule 0: KYC Tier-based limits
    if (kycTierCheckEnabled && !tierThresholds.isEmpty()) {
      int customerTier = 0; 
      KycTierRecord tierRule = tierThresholds.stream()
          .filter(t -> t.kycTier() == customerTier)
          .findFirst()
          .orElse(null);

      if (tierRule != null) {
        long amount   = transaction.amount().longValue();
        String channel = transaction.channel().toLowerCase();
        long channelLimit;
        if (channel.contains("wire"))        channelLimit = tierRule.dailyLimitWire();
        else if (channel.contains("mobile")) channelLimit = tierRule.dailyLimitMobile();
        else if (channel.contains("ussd"))   channelLimit = tierRule.dailyLimitUssd();
        else if (channel.contains("bdc"))    channelLimit = tierRule.dailyLimitBdc();
        else if (channel.contains("pos"))    channelLimit = tierRule.dailyLimitOther();
        else                                 channelLimit = tierRule.dailyLimitOther();

        if (amount > channelLimit) {
          flags.add("KYC_TIER_LIMIT_EXCEEDED");
          ruleScores.add(45 + tierRule.riskScoreBoost());
        }
      }
    }

    // Rule 1: High-value transfer (formerly High-value wire)
    long wireThreshold = thresholdMap.getOrDefault("high-value-wire", 5_000_000L);
    if (transaction.amount().longValue() > wireThreshold) {
      log.info("[HybridAnalysis] Rule triggered: high-value-wire ({} > {})", transaction.amount(), wireThreshold);
      flags.add("high-value-wire");
      ruleScores.add(35);
    }

    // Rule 2: Velocity clustering
    long velocityThreshold = thresholdMap.getOrDefault("velocity-cluster", 5L);
    if (customerTxnCount24h > velocityThreshold) {
      flags.add("velocity-cluster");
      ruleScores.add(25);
    }

    // Rule 3: Late-night large transfer
    long lateNightThreshold = thresholdMap.getOrDefault("late-night-large", 1_000_000L);
    if (isLateNight(transaction.occurredAt(), zone) &&
        transaction.amount().longValue() > lateNightThreshold) {
      log.info("[HybridAnalysis] Rule triggered: late-night-large ({} > {})", transaction.amount(), lateNightThreshold);
      flags.add("late-night-large");
      ruleScores.add(30);
    }

    // Rule 4: OTP attack
    if (hasOtpAlert) {
      flags.add("OTP_ALERT");
      ruleScores.add(50);
    }

    // Rule 5: Volume spike
    if (todayCount > yesterdayCount * 1.3) {
      flags.add("VELOCITY_SPIKE");
      ruleScores.add(20);
    }

    // Rule 6: Cross-border BDC
    long bdcThreshold = thresholdMap.getOrDefault("cross-border-bdc", 10_000_000L);
    if ("bdc".equalsIgnoreCase(transaction.channel()) &&
        transaction.amount().longValue() > bdcThreshold) {
      flags.add("cross-border-bdc");
      ruleScores.add(30);
    }

    int scoreVal = 0; if (!ruleScores.isEmpty()) { double sum = 0; for (int s : ruleScores) sum += s; scoreVal = (int) Math.min(100, Math.round(sum / ruleScores.size())); } return new TransactionScorer.ScoringResult(scoreVal, flags, "", ruleScores);
  }

  
  private TransactionScorer.ScoringResult scoreBehavioralPatterns(
      Transaction transaction,
      List<BehavioralRuleRecord> rules,
      long todayCount,
      long yesterdayCount,
      long customerTxnCount24h) {
      
    java.util.ArrayList<String> flags = new java.util.ArrayList<>();
    java.util.ArrayList<Integer> ruleScores = new java.util.ArrayList<>();

    for (BehavioralRuleRecord rule : rules) {
      if (!rule.isActive()) continue;
      boolean triggered = false;

      if ("pat-4".equals(rule.ruleId())) {
        if (todayCount > yesterdayCount * 1.5) triggered = true;
      } else if ("pat-5".equals(rule.ruleId())) {
        if (customerTxnCount24h > 10) triggered = true;
      } else if ("pat-2".equals(rule.ruleId())) {
         if (transaction.amount().longValue() > 2_000_000L && "mobile".equalsIgnoreCase(transaction.channel())) triggered = true;
      }

      if (triggered) {
        flags.add(rule.ruleId());
        int ruleScore = switch (rule.severity().toLowerCase()) {
          case "critical" -> 40;
          case "high"     -> 30;
          case "medium"   -> 15;
          default         -> 10;
        };
        ruleScores.add(ruleScore);
      }
    }

    int scoreVal = 0; if (!ruleScores.isEmpty()) { double sum = 0; for (int s : ruleScores) sum += s; scoreVal = (int) Math.min(100, Math.round(sum / ruleScores.size())); } return new TransactionScorer.ScoringResult(scoreVal, flags, "", ruleScores);
  }

  private boolean isLateNight(java.time.OffsetDateTime dt, java.time.ZoneId zone) {
    if (dt == null) return false;
    int hour = dt.atZoneSameInstant(zone).getHour();
    return hour >= 22 || hour < 6;
  }

  private Future<Void> sendCaseNotificationEmails(long institutionId,
      com.openiv.backend.cases.CaseRecord caseRecord) {
    return amlSettingsRepository.getByInstitution(institutionId)
        .compose(opt -> {
          if (opt.isEmpty() || opt.get().caseNotificationEmails() == null
              || opt.get().caseNotificationEmails().isEmpty()) {
            return Future.succeededFuture();
          }

          List<String> emails = opt.get().caseNotificationEmails();
          List<Future<Void>> emailFutures = new java.util.ArrayList<>();

          for (String email : emails) {
            Future<Void> emailFuture = emailSender.sendCaseNotification(
                email,
                caseRecord.id(),
                caseRecord.title(),
                caseRecord.priority(),
                caseRecord.brief());
            emailFutures.add(emailFuture);
          }

          return Future.all(emailFutures).<Void>mapEmpty();
        });
  }

  private Future<Void> updateTransactionRisk(long institutionId, String transactionId, int riskScore) {
    String flaggedStatus = riskScore > 0 ? "flagged" : "normal";
    return pool.preparedQuery(
            "UPDATE transactions SET risk_score = $1, flagged_status = $2, updated_at = now() " +
            "WHERE id = $3 AND institution_id = $4")
        .execute(io.vertx.sqlclient.Tuple.of(riskScore, flaggedStatus, transactionId, institutionId))
        .<Void>mapEmpty()
        .onFailure(e -> log.error("[HybridAnalysis] Failed to update risk for txn {}: {}", transactionId, e.getMessage()));
  }

  private String buildHumanReadableReason(List<String> flags, int finalScore) {
    if (flags.isEmpty()) return "No suspicious patterns detected.";
    
    StringBuilder sb = new StringBuilder();
    sb.append("This transaction was flagged with a risk score of ").append(finalScore).append("/100. ");
    sb.append("Our system detected the following patterns: ");
    
    for (int i = 0; i < flags.size(); i++) {
      String flag = flags.get(i);
      String plain = translateFlag(flag);
      sb.append(plain);
      if (i < flags.size() - 1) sb.append(", ");
      else sb.append(".");
    }
    
    return sb.toString();
  }

  private String translateFlag(String flag) {
    return switch (flag) {
      case "KYC_TIER_LIMIT_EXCEEDED" -> "transaction exceeds the customer's KYC tier limits";
      case "high-value-wire" -> "unusually high-value transfer amount";
      case "velocity-cluster" -> "multiple transactions occurring in a short time cluster";
      case "late-night-large" -> "large transfer initiated during late-night hours";
      case "OTP_ALERT" -> "recent failed security attempts on this account";
      case "VELOCITY_SPIKE" -> "sudden spike in institutional transaction volume";
      case "cross-border-bdc" -> "high-value cross-border BDC transaction";
      case "pat-4" -> "suspicious institution-wide volume spike";
      case "pat-5" -> "unusual transaction frequency for this customer";
      case "pat-2" -> "high-value mobile transaction";
      case "STALE_TIMESTAMP_ANOMALY" -> "suspiciously old transaction timestamp (possible replay)";
      case "FUTURE_TIMESTAMP_ANOMALY" -> "transaction timestamp set in the future (possible clock tampering)";
      case "MICRO_TIMING_ANOMALY" -> "transaction timing is suspiciously precise (possible automated injection)";
      case "TXN_IMPOSSIBLE_TRAVEL" -> "geo-velocity impossible — transaction locations are too far apart for the time elapsed (no civil aircraft can travel that fast)";
      case "TXN_SUSPICIOUS_TRAVEL" -> "geo-velocity borderline — implied speed is at the absolute limit of commercial aviation";
      case "TXN_AIR_TRAVEL_REQUIRED" -> "geo-velocity anomaly — reaching the second transaction location required air travel";
      case "TXN_HIGH_VELOCITY" -> "geo-velocity elevated — implied ground speed is unusually high";
      default -> flag.toLowerCase().replace("_", " ");
    };
  }

  private static String notBlankOr(String first, String second, String fallback) {
    if (first != null && !first.isBlank()) return first;
    if (second != null && !second.isBlank()) return second;
    return fallback;
  }
}
