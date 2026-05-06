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
      boolean shouldFlag) {
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
      boolean hasOtpAlert) {

    Future<List<ThresholdRecord>>  fThresholds    = thresholdRepository.list(institutionId);
    Future<List<KycTierRecord>>    fTierThresholds = thresholdRepository.listKycTierThresholds(institutionId);
    Future<Boolean>                fHasKycConfig  = kycService.hasConfigForInstitution(institutionId);
    Future<java.util.Optional<com.openiv.backend.aml.AmlSettings>> fAmlSettings = amlSettingsRepository.getByInstitution(institutionId);
    Future<List<BehavioralRuleRecord>> fBehavioralRules = behavioralRuleRepository.list(institutionId);

    return Future.all(fThresholds, fTierThresholds, fHasKycConfig, fAmlSettings, fBehavioralRules)
        .compose((io.vertx.core.CompositeFuture results) -> {
          List<ThresholdRecord> thresholds     = results.resultAt(0);
          List<KycTierRecord>   tierThresholds = results.resultAt(1);
          boolean               hasKycConfig   = Boolean.TRUE.equals((Boolean) results.resultAt(2));
          java.util.Optional<com.openiv.backend.aml.AmlSettings> optAmlSettings = results.resultAt(3);
          List<BehavioralRuleRecord> behavioralRules = results.resultAt(4);
          
          com.openiv.backend.aml.AmlSettings amlSettings = optAmlSettings.orElse(new com.openiv.backend.aml.AmlSettings(0, institutionId, false, null, 51, 81, 60, 85, 30, 30));

          TransactionScorer.ScoringResult txnResult = scoreWithThresholds(
              transaction, thresholds, tierThresholds,
              todayCount, yesterdayCount, customerTxnCount24h, hasOtpAlert, hasKycConfig);

          TransactionScorer.ScoringResult behResult = scoreBehavioralPatterns(
              transaction, behavioralRules, todayCount, yesterdayCount, customerTxnCount24h);

          int finalScore = Math.max(txnResult.score, behResult.score);
          java.util.List<String> combinedFlags = new java.util.ArrayList<>();
          combinedFlags.addAll(txnResult.flags);
          combinedFlags.addAll(behResult.flags);
          TransactionScorer.ScoringResult scoringResult = new TransactionScorer.ScoringResult(finalScore, combinedFlags, txnResult.reason + " | " + behResult.reason);

          // Legacy override to avoid breaking next block:

          if (scoringResult.score == 0) {
            scoringResult.flags.clear();
          }

          boolean shouldFlag = (txnResult.score >= amlSettings.riskScoreFlagThreshold()) || (behResult.score >= amlSettings.behRiskScoreFlagThreshold());
          boolean shouldCase = TransactionScorer.shouldCreateCase(txnResult.score, amlSettings.riskScoreCaseThreshold()) || TransactionScorer.shouldCreateCase(behResult.score, amlSettings.behRiskScoreCaseThreshold());

          log.info("[HybridAnalysis] txn={} risk={} rules={}",
              transaction.id(), scoringResult.score, scoringResult.flags);

          AnalysisResult result = new AnalysisResult(
              scoringResult.score,
              TransactionScorer.getPriority(scoringResult.score),
              scoringResult.flags,
              null, null,
              false, false, shouldFlag);

          if (!shouldCase) {
            return Future.succeededFuture(result);
          }

          return caseService.createCaseFromTransaction(institutionId, transaction, scoringResult)
              .compose(caseRecord -> {
                AnalysisResult caseResult = new AnalysisResult(
                    result.riskScore(), result.priority(), result.triggeredRules(),
                    caseRecord.id(), null, true, false, result.shouldFlag());

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
      boolean hasKycConfig) {

    java.util.ArrayList<String> flags = new java.util.ArrayList<>();
    int score = 20; // baseline

    java.util.Map<String, Long> thresholdMap = thresholds.stream()
        .collect(java.util.stream.Collectors.toMap(
            ThresholdRecord::ruleId, ThresholdRecord::thresholdValue));

    // Rule 0: KYC Tier-based limits — only when institution has a KYC database configured
    if (hasKycConfig && !tierThresholds.isEmpty()) {
      int customerTier = 0; // default to Tier 0 when KYC config exists but tier unknown
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
          String sender    = notBlankOr(transaction.customerName(), transaction.senderAccount(), "Unknown sender");
          String recipient = notBlankOr(transaction.recipientName(), transaction.counterparty(), "Unknown recipient");
          String date      = transaction.occurredAt() != null
              ? transaction.occurredAt().toLocalDate().toString() : "unknown date";
          String limitFmt  = String.format("₦%,d", channelLimit);
          String channelDisplay = transaction.channel();

          flags.add("Transaction made by " + sender + " to " + recipient + " on " + date
              + " was flagged due to exceeding KYC Tier " + customerTier
              + " limit for " + channelDisplay + " which is " + limitFmt);
          score += 25;
        }

        if (tierRule.riskScoreBoost() > 0) {
          score += tierRule.riskScoreBoost();
        }
      }
    }

    // Rule 1: High-value wire
    long wireThreshold = thresholdMap.getOrDefault("high-value-wire", 5_000_000L);
    if ("wire".equalsIgnoreCase(transaction.channel()) &&
        transaction.amount().longValue() > wireThreshold) {
      flags.add("High-value wire transfer (>" + wireThreshold + " NGN)");
      score += 20;
    }

    // Rule 2: Velocity clustering
    long velocityThreshold = thresholdMap.getOrDefault("velocity-cluster", 5L);
    if (customerTxnCount24h > velocityThreshold) {
      flags.add("High transaction velocity (>" + velocityThreshold + " in 24h)");
      score += 15;
    }

    // Rule 3: Late-night large transfer
    long lateNightThreshold = thresholdMap.getOrDefault("late-night-large", 1_000_000L);
    if (isLateNight(transaction.occurredAt()) &&
        transaction.amount().longValue() > lateNightThreshold) {
      flags.add("Late-night large transfer (>" + lateNightThreshold + " NGN, 23:00-05:00)");
      score += 18;
    }

    // Rule 4: OTP attack
    if (hasOtpAlert) {
      flags.add("OTP attack detected in time window (SIM swap signal)");
      score += 25;
    }

    // Rule 5: Volume spike
    if (todayCount > yesterdayCount * 1.3) {
      flags.add("Institution volume spike (>30% vs yesterday)");
      score += 12;
    }

    // Rule 6: Cross-border BDC
    long bdcThreshold = thresholdMap.getOrDefault("cross-border-bdc", 10_000_000L);
    if ("bdc".equalsIgnoreCase(transaction.channel()) &&
        transaction.amount().longValue() > bdcThreshold) {
      flags.add("Cross-border BDC exceeds threshold (>" + bdcThreshold + " NGN)");
      score += 15;
    }

    score = Math.min(score, 100);

    var reason = String.format(
        "Hybrid Score: %d/100. Institution thresholds: wire=%,d, velocity=%d, late-night=%,d. Triggered: %s",
        score, wireThreshold, velocityThreshold, lateNightThreshold, String.join(", ", flags));

    return new TransactionScorer.ScoringResult(score, flags, reason);
  }

  
  private TransactionScorer.ScoringResult scoreBehavioralPatterns(
      Transaction transaction,
      List<BehavioralRuleRecord> rules,
      long todayCount,
      long yesterdayCount,
      long customerTxnCount24h) {
      
    java.util.ArrayList<String> flags = new java.util.ArrayList<>();
    int score = 0;

    for (BehavioralRuleRecord rule : rules) {
      if (!rule.isActive()) continue;

      boolean triggered = false;

      // Mock heuristic evaluations based on rule IDs for the prototype
      if ("pat-4".equals(rule.ruleId())) {
        if (todayCount > yesterdayCount * 1.5) {
          triggered = true;
        }
      } else if ("pat-5".equals(rule.ruleId())) {
        if (customerTxnCount24h > 10) {
          triggered = true;
        }
      } else if ("pat-2".equals(rule.ruleId())) {
         // geographic
         if (transaction.amount().longValue() > 2_000_000L && "mobile".equalsIgnoreCase(transaction.channel())) {
            // simulated trigger
            triggered = true;
         }
      }

      if (triggered) {
        flags.add(rule.name() + " (" + rule.category() + ")");
        switch (rule.severity().toLowerCase()) {
          case "critical": score += 40; break;
          case "high":     score += 30; break;
          case "medium":   score += 15; break;
          default:         score += 10; break;
        }
      }
    }

    score = Math.min(score, 100);
    return new TransactionScorer.ScoringResult(score, flags, "Behavioral Score: " + score + ". Triggered: " + String.join(", ", flags));
  }

  private boolean isLateNight(java.time.OffsetDateTime dt) {
    int hour = dt.atZoneSameInstant(java.time.ZoneOffset.UTC).getHour();
    return hour >= 23 || hour < 5;
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

          return Future.all(emailFutures).mapEmpty();
        });
  }

  private static String notBlankOr(String first, String second, String fallback) {
    if (first != null && !first.isBlank()) return first;
    if (second != null && !second.isBlank()) return second;
    return fallback;
  }
}
