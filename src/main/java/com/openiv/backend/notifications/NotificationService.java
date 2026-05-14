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

  // ── Case action notifications ──────────────────────────────────────────────

  public Future<Notification> notifyCaseInvestigationStarted(long instId, String caseId, String actorName) {
    return registerNotification(instId, "case_investigation_started",
        "Investigation Started — " + caseId,
        actorName + " has begun investigating case " + caseId +
        ". The case has been auto-assigned to them and SLA tracking is active.");
  }

  public Future<Notification> notifyCaseAssigned(long instId, String caseId, long toUserId, String actorName) {
    return registerNotification(instId, "case_assigned",
        "Case Assigned — " + caseId,
        actorName + " assigned case " + caseId + " to user #" + toUserId + ".");
  }

  public Future<Notification> notifyCaseClosed(long instId, String caseId, String resolution, String actorName) {
    String res = resolution != null ? resolution.replace("_", " ") : "unspecified";
    return registerNotification(instId, "case_closed",
        "Case Closed — " + caseId,
        actorName + " closed case " + caseId + " with resolution: " + res +
        ". An immutable audit entry has been created.");
  }

  public Future<Notification> notifyCaseEscalated(long instId, String caseId, String actorName) {
    return registerNotification(instId, "case_escalated",
        "Case Escalated — " + caseId,
        actorName + " escalated case " + caseId +
        ". This case requires senior AML or compliance review.");
  }

  public Future<Notification> notifySarFiled(long instId, String caseId, long reportId, String actorName) {
    return registerNotification(instId, "case_sar_filed",
        "SAR/STR Filed — " + caseId,
        actorName + " filed a Suspicious Activity Report (report #" + reportId +
        ") linked to case " + caseId + ". This is a statutory filing under CBN AML guidelines.");
  }

  public Future<Notification> notifyFreezeRequested(long instId, String caseId, String actorName) {
    return registerNotification(instId, "case_freeze_requested",
        "Account Freeze Requested — " + caseId,
        actorName + " has requested an account freeze for case " + caseId +
        ". Route immediately to the Compliance desk for action.");
  }

  public Future<Notification> notifyBehavioralAlert(
      long institutionId, com.openiv.backend.beam.BehavioralAlert alert) {

    String type = alert.riskScore() >= 85 ? "behavioral_critical"
        : alert.riskScore() >= 70 ? "behavioral_high" : "behavioral_flag";

    String title = buildBehavioralTitle(alert);
    String body  = buildBehavioralBody(alert);
    return registerNotification(institutionId, type, title, body);
  }

  private static String buildBehavioralTitle(com.openiv.backend.beam.BehavioralAlert a) {
    return switch (a.rule()) {
      case "LOGIN_IMPOSSIBLE_TRAVEL"      -> "Impossible Travel Login Detected";
      case "LOGIN_TIME_ANOMALY"           -> "Off-Hours Login Alert";
      case "LOGIN_VELOCITY"               -> "Login Velocity Spike";
      case "LOGIN_NEW_COUNTRY"            -> "Login from New Country";
      case "LOGIN_MICRO_TIMING"           -> "Suspicious Login Timestamp";
      case "LOGIN_TIMESTAMP_STALE"        -> "Stale Login Event — Possible Replay";
      case "LOGIN_TIMESTAMP_FUTURE"       -> "Future Login Timestamp — Clock Tampering";
      case "ACTIVITY_TIME_ANOMALY"        -> "Off-Hours Activity Detected";
      case "ACTIVITY_BURST"               -> "Abnormal Activity Burst";
      case "ACTIVITY_SESSION_ANOMALY"     -> "Session Hijacking Signal";
      case "ACTIVITY_MICRO_TIMING"        -> "Suspicious Activity Timestamp";
      case "ACTIVITY_TIMESTAMP_STALE"     -> "Stale Activity Event — Possible Replay";
      case "ACTIVITY_TIMESTAMP_FUTURE"    -> "Future Activity Timestamp";
      case "LOCATION_IMPOSSIBLE_TRAVEL"   -> "Impossible GPS Travel Detected";
      case "LOCATION_HIGH_RISK_REGION"    -> "Customer in High-Risk Jurisdiction";
      case "LOCATION_RAPID_CHANGE"        -> "Rapid GPS Ping Flood — Possible Spoofing";
      case "LOCATION_COUNTRY_CHANGE"      -> "Customer Location Changed Country";
      case "LOCATION_MICRO_TIMING"        -> "Suspicious Location Timestamp";
      case "LOCATION_TIMESTAMP_STALE"     -> "Stale Location Event — Possible Replay";
      case "LOCATION_TIMESTAMP_FUTURE"    -> "Future Location Timestamp";
      case "DEVICE_SHARED_ACCOUNTS"       -> "Device Shared Across Multiple Accounts";
      case "DEVICE_JAILBREAK_ROOT"        -> "Jailbroken/Rooted Device Detected";
      case "DEVICE_EMULATOR"              -> "Emulator Detected — Possible Bot Attack";
      case "DEVICE_RAPID_SWAP"            -> "Rapid Device Change — SIM-Swap Precursor";
      case "DEVICE_CLONED"                -> "Cloned Device Detected";
      case "DEVICE_MICRO_TIMING"          -> "Suspicious Device Event Timestamp";
      case "DEVICE_TIMESTAMP_STALE"       -> "Stale Device Event — Possible Replay";
      case "DEVICE_TIMESTAMP_FUTURE"      -> "Future Device Timestamp";
      case "OTP_MICRO_TIMING"             -> "Suspicious OTP Event Timestamp";
      case "OTP_TIMESTAMP_STALE"          -> "Stale OTP Event — Possible Replay";
      case "OTP_TIMESTAMP_FUTURE"         -> "Future OTP Timestamp";
      default -> "Behavioral Alert — Risk Score " + a.riskScore();
    };
  }

  private static String buildBehavioralBody(com.openiv.backend.beam.BehavioralAlert a) {
    var sb = new StringBuilder();
    sb.append(a.detail());
    if (a.reasons() != null && a.reasons().length > 0) {
      sb.append(" Signals: ");
      sb.append(String.join("; ", a.reasons()));
      sb.append(".");
    }
    sb.append(" Risk score: ").append(a.riskScore()).append("/100.");
    if (a.customerId() != null) sb.append(" Customer: ").append(a.customerId()).append(".");
    if (a.deviceId()   != null) sb.append(" Device: ").append(a.deviceId()).append(".");
    return sb.toString();
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
