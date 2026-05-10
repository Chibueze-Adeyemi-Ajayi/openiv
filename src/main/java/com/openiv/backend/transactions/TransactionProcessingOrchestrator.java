package com.openiv.backend.transactions;

import com.openiv.backend.billing.FraudDetectionBillingService;
import com.openiv.backend.notifications.NotificationService;
import io.vertx.core.Future;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.time.OffsetDateTime;

public class TransactionProcessingOrchestrator {
  private static final Logger log = LoggerFactory.getLogger(TransactionProcessingOrchestrator.class);

  private final HybridTransactionAnalysisService analysisService;
  private final FraudDetectionBillingService billingService;
  private final NotificationService notificationService;

  public record ProcessingResult(String transactionId, int riskScore, String priority,
      String caseId, String billingReference, String notificationId, long processingTimeMs,
      java.util.List<String> triggeredRules, String recommendedAction) {}

  public TransactionProcessingOrchestrator(HybridTransactionAnalysisService analysisService,
      FraudDetectionBillingService billingService, NotificationService notificationService) {
    this.analysisService = analysisService;
    this.billingService = billingService;
    this.notificationService = notificationService;
  }

  public Future<ProcessingResult> processTransaction(long institutionId, Transaction transaction,
      long todayCount, long yesterdayCount, long customerTxnCount24h, boolean hasOtpAlert, boolean skipKyc) {
    long startTime = System.currentTimeMillis();

    return analysisService.analyzeTransaction(institutionId, transaction, todayCount,
        yesterdayCount, customerTxnCount24h, hasOtpAlert, skipKyc)
        .compose(analysisResult -> {
          Future<com.openiv.backend.notifications.NotificationService.Notification> notifFuture;
          if (analysisResult.shouldFlag() && !analysisResult.triggeredRules().isEmpty()) {
            StringBuilder reasonBuilder = new StringBuilder();
            reasonBuilder.append("We've spotted some unusual activity on this transaction that requires your attention: ");
            
            java.util.List<String> plainDescriptions = analysisResult.triggeredRules().stream()
                .map(TransactionProcessingOrchestrator::ruleToPlainEnglish)
                .distinct()
                .toList();
                
            for (int i = 0; i < plainDescriptions.size(); i++) {
              reasonBuilder.append(plainDescriptions.get(i));
              if (i < plainDescriptions.size() - 1) {
                reasonBuilder.append(" Additionally, ");
              }
            }
            
            reasonBuilder.append(" Based on these factors, we recommend reviewing this transaction immediately.");

            notifFuture = notificationService.notifyTransactionFlagged(
                institutionId, transaction.id(),
                reasonBuilder.toString(),
                analysisResult.riskScore());
          } else {
            notifFuture = Future.succeededFuture(new com.openiv.backend.notifications.NotificationService.Notification(0L, institutionId, "system", "info", "Flag skipped", "read", OffsetDateTime.now()));
          }

          if (analysisResult.caseCreated() && analysisResult.caseid() != null) {
            notifFuture = notifFuture.compose(n -> notificationService.notifyCaseCreated(
                institutionId,
                analysisResult.caseid(),
                "New " + analysisResult.priority().toUpperCase() + " Priority Case: " + analysisResult.caseid(),
                analysisResult.priority()
            ));
          }

          return notifFuture.map(notification -> {
                long time = System.currentTimeMillis() - startTime;

                // Charge async (non-blocking) — don't wait for billing to complete
                billingService.chargeForTransaction(
                    institutionId, transaction.id(),
                    analysisResult.caseCreated(), analysisResult.aiAnalyzed())
                    .onSuccess(billingRecord ->
                        log.info("[Orchestrator] Charged txn={} ref={}", transaction.id(), billingRecord.reference()))
                    .onFailure(e ->
                        log.warn("[Orchestrator] Billing failed for txn={}: {}", transaction.id(), e.getMessage()));

                log.info("[Orchestrator] txn={} risk={} case={} time={}ms",
                    transaction.id(), analysisResult.riskScore(), analysisResult.caseid(), time);
                return new ProcessingResult(transaction.id(), analysisResult.riskScore(),
                    analysisResult.priority(), analysisResult.caseid(),
                    "pending", String.valueOf(notification.id()), time,
                    analysisResult.triggeredRules(), analysisResult.recommendedAction());
              });
        })
        .onFailure(e -> log.error("[Orchestrator] Failed: {}", e.getMessage()));
  }

  private static String ruleToPlainEnglish(String rule) {
    if (rule == null) return "the transaction was flagged for review.";
    return switch (rule) {
      case "STALE_TIMESTAMP_ANOMALY" ->
          "the transaction date is more than 24 hours old, which is very unusual and could suggest a duplicate or delayed submission.";
      case "FUTURE_TIMESTAMP_ANOMALY" ->
          "the transaction is dated in the future, which is technically impossible and suggests the time details might have been tampered with.";
      case "MICRO_TIMING_ANOMALY" ->
          "the transaction was submitted with robotic precision, matching our system clock exactly, which often points to an automated script rather than a human user.";
      case "HIGH_AMOUNT", "high-value-wire" ->
          "the transfer amount is significantly higher than your institution's typical transaction range.";
      case "HIGH_FREQUENCY", "velocity-cluster" ->
          "there have been multiple transactions from this account in a very short window, which is a common pattern for unauthorized activity.";
      case "VELOCITY_SPIKE", "pat-4" ->
          "there is a sudden, sharp increase in transaction volume for this account compared to its normal history.";
      case "OTP_ALERT" ->
          "a security alert was triggered for the one-time password (OTP), which might mean someone else is trying to access the account.";
      case "late-night-large" ->
          "this large transfer happened late at night, which is outside of the customer's usual spending hours.";
      case "cross-border-bdc" ->
          "this is an unusually large cross-border Bureau De Change (BDC) transaction that exceeds safety limits.";
      case "KYC_TIER_LIMIT_EXCEEDED" ->
          "the transaction amount exceeds the maximum limit allowed for the customer's current verification level (KYC tier).";
      default ->
          "our automated security checks identified a suspicious pattern (identified as: " + rule + ").";
    };
  }
}
