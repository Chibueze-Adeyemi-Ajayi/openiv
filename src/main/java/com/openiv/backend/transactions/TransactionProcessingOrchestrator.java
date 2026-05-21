package com.openiv.backend.transactions;

import com.openiv.backend.billing.FraudDetectionBillingService;
import com.openiv.backend.notifications.NotificationService;
import io.vertx.core.Future;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.time.OffsetDateTime;
import java.util.Optional;

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
      long todayCount, long yesterdayCount, long customerTxnCount24h, boolean hasOtpAlert,
      boolean skipKyc, Optional<Transaction> previousTransactionWithLocation) {
    long startTime = System.currentTimeMillis();

    return analysisService.analyzeTransaction(institutionId, transaction, todayCount,
        yesterdayCount, customerTxnCount24h, hasOtpAlert, skipKyc, previousTransactionWithLocation)
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
            notifFuture = Future.succeededFuture(new com.openiv.backend.notifications.NotificationService.Notification(0L, institutionId, "system", "info", "Flag skipped", "read", OffsetDateTime.now(), null, null));
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
      case "TXN_IMPOSSIBLE_TRAVEL" ->
          "the customer's previous and current transaction locations are so far apart that no commercial aircraft could have covered the distance in the time available — a strong indicator of card cloning, account takeover, or simultaneous session hijacking.";
      case "TXN_SUSPICIOUS_TRAVEL" ->
          "the implied travel speed between this and the customer's previous transaction is at the very limit of commercial aviation — the customer would need to have been on the fastest possible flight with no delays.";
      case "TXN_AIR_TRAVEL_REQUIRED" ->
          "the distance between this and the customer's previous transaction location means air travel was required — worth verifying whether the customer was genuinely in transit.";
      case "TXN_HIGH_VELOCITY" ->
          "the customer's transaction locations changed at an unusually high speed, faster than normal road transport.";
      case "HIGH_AMOUNT", "high-value-wire" ->
          "the transfer amount is significantly higher than your institution's typical transaction range.";
      case "HIGH_FREQUENCY", "velocity-cluster" ->
          "there have been multiple transactions from this account in a very short window, which is a common pattern for unauthorized activity.";
      case "VELOCITY_SPIKE" ->
          "there is a sudden, institution-wide surge in transaction volume — the total number of transactions processed today is significantly higher than yesterday, which may indicate a coordinated fraud event or system anomaly.";
      case "pat-4" ->
          "an unusual burst of activity has been detected across the institution, where total transaction volume has spiked well above the established daily baseline.";
      case "OTP_ALERT" ->
          "a security alert was triggered for the one-time password (OTP), which might mean someone else is trying to access the account.";
      case "late-night-large" ->
          "this large transfer happened late at night, which is outside of the customer's usual spending hours.";
      case "cross-border-bdc" ->
          "this is an unusually large cross-border Bureau De Change (BDC) transaction that exceeds safety limits.";
      case "KYC_TIER_LIMIT_EXCEEDED" ->
          "the transaction amount exceeds the single-transaction limit allowed for the customer's current identity verification level (KYC tier). The customer must complete a higher tier of verification to send larger individual transfers.";
      case "KYC_TIER_DAILY_LIMIT_EXCEEDED" ->
          "this transaction would push the customer's total spending today above the daily limit for their current identity verification level (KYC tier). To increase this limit, the customer must complete a higher tier of identity verification.";
      case "RAPID_POST_DEPOSIT_WITHDRAWAL" ->
          "this outward transfer withdraws a large share of a deposit received very recently — a common pattern in money laundering and pass-through fraud.";
      case "SUDDEN_WITHDRAWAL_AFTER_DEPOSIT" ->
          "a withdrawal was sent within minutes of a deposit arriving on this account — a strong signal of pass-through fraud or mule account activity, where funds are moved in and immediately forwarded to a third party.";
      case "CUSTOMER_RULE_MAX_AMOUNT", "CUSTOMER_RULE_BLOCKED_BANK", "CUSTOMER_RULE_BANK_NOT_ALLOWED",
           "CUSTOMER_RULE_BLOCKED_CHANNEL", "CUSTOMER_RULE_DAILY_LIMIT", "CUSTOMER_RULE_MONTHLY_LIMIT",
           "CUSTOMER_RULE_VELOCITY", "CUSTOMER_RULE_VIOLATION" ->
          "this transaction was restricted by a compliance rule configured specifically for this customer by your compliance team.";
      default ->
          "our automated security checks identified a suspicious pattern (identified as: " + rule + ").";
    };
  }
}
