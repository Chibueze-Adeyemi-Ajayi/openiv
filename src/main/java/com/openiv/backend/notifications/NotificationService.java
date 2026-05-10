package com.openiv.backend.notifications;

import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

public class NotificationService {
  private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
  private final Pool  pool;
  private final Vertx vertx;

  public record Notification(long id, long institutionId, String type, String title,
      String body, String status, OffsetDateTime createdAt) {}

  public static String busAddress(long institutionId) {
    return "institution." + institutionId + ".notifications";
  }

  public NotificationService(Pool pool, Vertx vertx) {
    this.pool  = pool;
    this.vertx = vertx;
  }

  // ── Write methods (fraud pipeline) ─────────────────────────────────────────

  public Future<Notification> notifyTransactionFlagged(long instId, String txnId,
      String reason, int riskScore) {
    String type  = riskScore >= 75 ? "critical_flag" : riskScore >= 60 ? "high_flag" : "medium_flag";
    String title = "Transaction Flagged — Risk Score " + riskScore;
    // reason is already a full plain-English sentence (e.g. "Transaction made by X to Y on date was flagged due to...")
    String body  = reason;
    return registerNotification(instId, type, title, body);
  }

  public Future<Notification> notifyCaseCreated(long instId, String caseId,
      String caseTitle, String priority) {
    return registerNotification(instId, "case_" + priority, caseTitle,
        "Case " + caseId + " created: " + caseTitle);
  }

  public Future<Notification> notifyKycWebhookMissing(long institutionId) {
    return registerNotification(institutionId, "kyc_webhook_missing",
        "KYC Webhook Not Configured",
        "No KYC lookup URL is set. Configure one under KYC → Integration " +
        "to enable automatic customer verification during fraud investigations.");
  }

  public Future<Notification> notifyKycDataNotFound(long institutionId, String customerRef, String caseId) {
    return registerNotification(institutionId, "kyc_data_not_found",
        "KYC Record Not Found — Investigate",
        "Customer KYC data for ref " + customerRef + " was not found. " +
        "Case " + caseId + " has been escalated to HIGH priority.");
  }

  public Future<Notification> notifyCyberBreachTimestampAnomaly(long institutionId,
      String transactionId, long minutesDifference) {
    String timeDesc = minutesDifference >= 1440
        ? (minutesDifference / 1440) + " day(s)"
        : minutesDifference + " minute(s)";
    return registerNotification(institutionId, "cyber_breach_timestamp",
        "Suspicious Transaction Time Detected",
        "A transaction (ref: " + transactionId + ") arrived with a date and time that is " +
        timeDesc + " away from the expected time. This can happen when someone tries to " +
        "re-submit an old transaction or tamper with the transaction clock — both are common " +
        "signs of fraud. The transaction has been flagged and a case has been opened for your review.");
  }

  // ── Read methods (REST handlers + SSE init) ────────────────────────────────

  public Future<List<Notification>> listRecent(long institutionId, int limit) {
    return pool.preparedQuery(
        "SELECT id, institution_id, type, title, body, status, created_at " +
        "FROM notifications WHERE institution_id=$1 ORDER BY created_at DESC LIMIT $2")
        .execute(Tuple.of(institutionId, limit))
        .map(rs -> {
          var out = new ArrayList<Notification>();
          rs.forEach(r -> out.add(rowTo(r)));
          return out;
        });
  }

  public Future<Integer> markAllRead(long institutionId) {
    return pool.preparedQuery(
        "UPDATE notifications SET status='read' WHERE institution_id=$1 AND status='unread'")
        .execute(Tuple.of(institutionId))
        .map(rs -> rs.rowCount());
  }

  public Future<JsonObject> getUnreadCounts(long institutionId) {
    return pool.preparedQuery(
        "SELECT type, COUNT(*) as count FROM notifications " +
        "WHERE institution_id=$1 AND status='unread' GROUP BY type")
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          int flags = 0;
          int cases = 0;
          for (Row r : rs) {
            String type = r.getString("type");
            Long count = r.getLong("count");
            if (count == null) continue;
            
            if (type.contains("flag") || type.contains("cyber")) {
              flags += count.intValue();
            } else if (type.contains("case") || type.contains("kyc")) {
              cases += count.intValue();
            }
          }
          var counts = new JsonObject().put("flags", flags).put("cases", cases);
          log.info("[Notification] Unread counts for institution {}: {}", institutionId, counts.encode());
          return counts;
        });
  }

  public Future<Boolean> markRead(long id, long institutionId) {
    return pool.preparedQuery(
        "UPDATE notifications SET status='read' WHERE id=$1 AND institution_id=$2")
        .execute(Tuple.of(id, institutionId))
        .map(rs -> rs.rowCount() > 0);
  }

  public Future<Void> markAllReadByCategory(long institutionId, String category) {
    String sql = "UPDATE notifications SET status='read' WHERE institution_id=$1 AND status='unread'";
    if ("flags".equals(category)) {
      sql += " AND (type LIKE '%flag%' OR type LIKE '%cyber%')";
    } else if ("cases".equals(category)) {
      sql += " AND (type LIKE '%case%' OR type LIKE '%kyc%')";
    }
    
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId))
        .mapEmpty();
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private Future<Notification> registerNotification(long instId, String type,
      String title, String body) {
    return pool.preparedQuery(
        "INSERT INTO notifications (institution_id, type, title, body, status) " +
        "VALUES ($1, $2, $3, $4, 'unread') " +
        "RETURNING id, institution_id, type, title, body, status, created_at")
        .execute(Tuple.of(instId, type, title, body))
        .map(rs -> rowTo(rs.iterator().next()))
        .onSuccess(n -> {
          log.info("[Notification] {} for institution {}", type, instId);
          if (vertx != null) {
            vertx.eventBus().publish(busAddress(instId), toJson(n));
          }
        })
        .onFailure(e -> log.error("[Notification] Failed to register", e));
  }

  private static Notification rowTo(Row r) {
    return new Notification(r.getLong("id"), r.getLong("institution_id"),
        r.getString("type"), r.getString("title"), r.getString("body"),
        r.getString("status"), r.getOffsetDateTime("created_at"));
  }

  public static JsonObject toJson(Notification n) {
    return new JsonObject()
        .put("id",            n.id())
        .put("institutionId", n.institutionId())
        .put("type",          n.type())
        .put("title",         n.title())
        .put("body",          n.body())
        .put("status",        n.status())
        .put("createdAt",     n.createdAt().toString());
  }
}
