package com.openiv.backend.notifications;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Tuple;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.OffsetDateTime;

public class NotificationService {
  private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
  private final Pool pool;

  public record Notification(long id, long institutionId, String type, String title,
      String body, String status, OffsetDateTime createdAt) {}

  public NotificationService(Pool pool) { this.pool = pool; }

  public Future<Notification> notifyTransactionFlagged(long instId, String txnId,
      String reason, int riskScore) {
    String type = riskScore >= 75 ? "critical_flag" : riskScore >= 60 ? "high_flag" : "medium_flag";
    String title = "Transaction Flagged: Risk Score " + riskScore;
    String body = "Transaction " + txnId + " flagged. Reason: " + reason;
    return registerNotification(instId, type, title, body);
  }

  public Future<Notification> notifyCaseCreated(long instId, String caseId,
      String caseTitle, String priority) {
    String type = "case_" + priority;
    String body = "Case " + caseId + " created: " + caseTitle;
    return registerNotification(instId, type, caseTitle, body);
  }

  public Future<Notification> notifyKycWebhookMissing(long institutionId) {
    return registerNotification(institutionId, "kyc_webhook_missing",
        "KYC Webhook Not Configured",
        "No KYC lookup URL is set for this institution. Configure one under KYC → Integration " +
        "to enable automatic customer verification during fraud investigations.");
  }

  public Future<Notification> notifyKycDataNotFound(long institutionId, String customerRef, String caseId) {
    return registerNotification(institutionId, "kyc_data_not_found",
        "KYC Record Not Found — Investigate",
        "Customer KYC data for ref " + customerRef + " was not found on your KYC system. " +
        "Case " + caseId + " has been escalated to HIGH priority. Investigate immediately.");
  }

  private Future<Notification> registerNotification(long instId, String type,
      String title, String body) {
    return pool.preparedQuery(
        "INSERT INTO notifications (institution_id, type, title, body, status) " +
        "VALUES ($1, $2, $3, $4, 'unread') RETURNING id, institution_id, type, title, body, status, created_at")
        .execute(Tuple.of(instId, type, title, body))
        .map(rs -> {
          var r = rs.iterator().next();
          return new Notification(r.getLong("id"), r.getLong("institution_id"),
              r.getString("type"), r.getString("title"), r.getString("body"),
              r.getString("status"), r.getOffsetDateTime("created_at"));
        })
        .onSuccess(n -> log.info("[Notification] Registered {} for institution {}", type, instId))
        .onFailure(e -> log.error("[Notification] Failed to register", e));
  }
}
