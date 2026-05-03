package com.openiv.backend.transactions;

import com.openiv.backend.billing.FraudDetectionBillingService;
import com.openiv.backend.notifications.NotificationService;
import io.vertx.core.Future;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class TransactionProcessingOrchestrator {
  private static final Logger log = LoggerFactory.getLogger(TransactionProcessingOrchestrator.class);

  private final HybridTransactionAnalysisService analysisService;
  private final FraudDetectionBillingService billingService;
  private final NotificationService notificationService;

  public record ProcessingResult(String transactionId, int riskScore, String priority,
      String caseId, String billingReference, String notificationId, long processingTimeMs) {}

  public TransactionProcessingOrchestrator(HybridTransactionAnalysisService analysisService,
      FraudDetectionBillingService billingService, NotificationService notificationService) {
    this.analysisService = analysisService;
    this.billingService = billingService;
    this.notificationService = notificationService;
  }

  public Future<ProcessingResult> processTransaction(long institutionId, Transaction transaction,
      long todayCount, long yesterdayCount, long customerTxnCount24h, boolean hasOtpAlert) {
    long startTime = System.currentTimeMillis();

    return analysisService.analyzeTransaction(institutionId, transaction, todayCount,
        yesterdayCount, customerTxnCount24h, hasOtpAlert)
        .compose(analysisResult -> billingService.chargeForTransaction(
            institutionId, transaction.id(),
            analysisResult.caseCreated(), analysisResult.aiAnalyzed())
            .compose(billingRecord -> notificationService.notifyTransactionFlagged(
                institutionId, transaction.id(),
                analysisResult.triggeredRules().toString(),
                analysisResult.riskScore())
                .map(notification -> {
                  long time = System.currentTimeMillis() - startTime;
                  log.info("[Orchestrator] txn={} risk={} case={} time={}ms",
                      transaction.id(), analysisResult.riskScore(), analysisResult.caseid(), time);
                  return new ProcessingResult(transaction.id(), analysisResult.riskScore(),
                      analysisResult.priority(), analysisResult.caseid(),
                      billingRecord.reference(), String.valueOf(notification.id()), time);
                })))
        .onFailure(e -> log.error("[Orchestrator] Failed: {}", e.getMessage()));
  }
}
