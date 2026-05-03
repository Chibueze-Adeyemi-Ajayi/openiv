package com.openiv.backend.transactions;

import com.openiv.backend.cases.AutoCaseCreationService;
import com.openiv.backend.kyc.KycService;
import com.openiv.backend.thresholds.ThresholdRepository;
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

  public record AnalysisResult(
      int riskScore,
      String priority,
      List<String> triggeredRules,
      String caseid,
      String aiAnalysis,
      boolean caseCreated,
      boolean aiAnalyzed
  ) {}

  public HybridTransactionAnalysisService(
      TransactionScorer scorer,
      AutoCaseCreationService caseService,
      ThresholdRepository thresholdRepository,
      Pool pool,
      KycService kycService) {
    this.scorer = scorer;
    this.caseService = caseService;
    this.thresholdRepository = thresholdRepository;
    this.pool = pool;
    this.kycService = kycService;
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

    return thresholdRepository.list(institutionId)
        .compose(thresholds -> {
          // Score transaction with institution's thresholds
          var scoringResult = scoreWithThresholds(
              transaction, thresholds,
              todayCount, yesterdayCount, customerTxnCount24h, hasOtpAlert);

          log.info("[HybridAnalysis] txn={} risk={} rules={}",
              transaction.id(), scoringResult.score, scoringResult.flags);

          var result = new AnalysisResult(
              scoringResult.score,
              TransactionScorer.getPriority(scoringResult.score),
              scoringResult.flags,
              null, null,
              false, false
          );

          // Check if should create case
          if (!TransactionScorer.shouldCreateCase(scoringResult.score)) {
            return Future.succeededFuture(result);
          }

          // Create case from rules
          return caseService.createCaseFromTransaction(institutionId, transaction, scoringResult)
              .compose(caseRecord -> {
                var caseResult = new AnalysisResult(
                    result.riskScore, result.priority, result.triggeredRules,
                    caseRecord.id(), null, true, false
                );

                // Lookup KYC for the customer async (don't wait for result)
                kycService.lookupForPipeline(institutionId, transaction.customerId(), caseRecord.id())
                    .onFailure(e -> log.warn("[KYC Pipeline] lookup failed for txn {}: {}",
                        transaction.id(), e.getMessage()));

                return Future.succeededFuture(caseResult);
              })
              .onFailure(e -> log.error("[HybridAnalysis] Case creation failed for txn {}",
                  transaction.id(), e));
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
      long todayCount,
      long yesterdayCount,
      long customerTxnCount24h,
      boolean hasOtpAlert) {

    var flags = new java.util.ArrayList<String>();
    int score = 20; // baseline

    // Get institution thresholds (or use defaults)
    var thresholdMap = thresholds.stream()
        .collect(java.util.stream.Collectors.toMap(t -> t.ruleId(), t -> t.thresholdValue()));

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

  private boolean isLateNight(java.time.OffsetDateTime dt) {
    int hour = dt.atZoneSameInstant(java.time.ZoneOffset.UTC).getHour();
    return hour >= 23 || hour < 5;
  }
}
