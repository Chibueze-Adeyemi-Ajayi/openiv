package com.openiv.backend.notifications;

import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
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

  // Role tiers — which roles receive which notification categories
  private static final String[] ROLES_COMPLIANCE_UP =
      { "admin", "cco" };
  private static final String[] ROLES_ANALYST_UP =
      { "admin", "cco", "analyst" };

  public record Notification(
      long id, long institutionId, String type, String title,
      String body, String status, OffsetDateTime createdAt,
      String entityType, String entityId,
      Long recipientId, List<String> targetRoles) {}

  public static String busAddress(long institutionId) {
    return "institution." + institutionId + ".notifications";
  }

  public NotificationService(Pool pool, Vertx vertx) {
    this.pool  = pool;
    this.vertx = vertx;
  }

  // ── Write methods ──────────────────────────────────────────────────────────

  public Future<Notification> notifyTransactionFlagged(long instId, String txnId,
      String reason, int riskScore) {
    String type  = riskScore >= 75 ? "critical_flag" : riskScore >= 60 ? "high_flag" : "medium_flag";
    String title = "Transaction Flagged — Risk Score " + riskScore;
    // Critical/high flags visible to analysts and above; medium to compliance and above
    String[] roles = riskScore >= 60 ? ROLES_ANALYST_UP : ROLES_COMPLIANCE_UP;
    return registerNotification(instId, type, title, reason, "transaction", txnId, null, roles);
  }

  public Future<Notification> notifyCaseCreated(long instId, String caseId,
      String caseTitle, String priority) {
    String riskLabel = riskLabel(priority);
    String body = "Our fraud monitoring system has automatically opened a new investigation case (" + caseId + "). "
        + "Risk level: " + riskLabel + ". "
        + "Please open the AML & Cases section, review the details, and take action — "
        + "either begin an investigation, contact the customer, or close the case if no concern is found.";
    return registerNotification(instId, "case_" + priority,
        "New case opened — " + riskLabel + " risk", body, "case", caseId,
        null, ROLES_COMPLIANCE_UP);
  }

  public Future<Notification> notifyCaseCreated(long instId, String caseId,
      String priority, String customerName, String amount, String currency, String channel) {
    String riskLabel = riskLabel(priority);
    String body = "Our fraud monitoring system flagged a suspicious transaction from "
        + customerName + " — " + formatAmount(amount, currency) + " sent via " + channel + ". "
        + "A new investigation case (" + caseId + ") has been opened automatically. "
        + "Risk level: " + riskLabel + ". "
        + "Please review the case in the AML & Cases section and take action — "
        + "investigate further, reach out to the customer, or close it if no issue is found.";
    return registerNotification(instId, "case_" + priority,
        "New " + riskLabel + " risk case — " + customerName, body, "case", caseId,
        null, ROLES_COMPLIANCE_UP);
  }

  // ── Case action notifications ──────────────────────────────────────────────

  public Future<Notification> notifyCaseInvestigationStarted(long instId, String caseId, String actorName) {
    return registerNotification(instId, "case_investigation_started",
        "Investigation Started — " + caseId,
        actorName + " has begun investigating case " + caseId +
        ". The case has been auto-assigned to them and SLA tracking is active.",
        "case", caseId, null, ROLES_COMPLIANCE_UP);
  }

  /** Case assignment is user-specific — only the assignee receives this notification. */
  public Future<Notification> notifyCaseAssigned(long instId, String caseId, long toUserId, String actorName) {
    String body = actorName + " assigned case " + caseId + " to you. "
        + "Please open the case in the AML & Cases section and take the appropriate action.";
    return registerNotification(instId, "case_assigned",
        "Case Assigned to You — " + caseId, body,
        "case", caseId, toUserId, null);
  }

  public Future<Notification> notifyCaseClosed(long instId, String caseId, String resolution, String actorName) {
    String res = resolution != null ? resolution.replace("_", " ") : "unspecified";
    return registerNotification(instId, "case_closed",
        "Case Closed — " + caseId,
        actorName + " closed case " + caseId + " with resolution: " + res +
        ". An immutable audit entry has been created.",
        "case", caseId, null, ROLES_COMPLIANCE_UP);
  }

  public Future<Notification> notifyCaseEscalated(long instId, String caseId, String actorName) {
    return registerNotification(instId, "case_escalated",
        "Case Escalated — " + caseId,
        actorName + " escalated case " + caseId +
        ". This case requires senior AML or compliance review.",
        "case", caseId, null, ROLES_COMPLIANCE_UP);
  }

  public Future<Notification> notifySarFiled(long instId, String caseId, long reportId, String actorName) {
    return registerNotification(instId, "case_sar_filed",
        "SAR/STR Filed — " + caseId,
        actorName + " filed a Suspicious Activity Report (report #" + reportId +
        ") linked to case " + caseId + ". This is a statutory filing under CBN AML guidelines.",
        "case", caseId, null, ROLES_COMPLIANCE_UP);
  }

  public Future<Notification> notifyFreezeRequested(long instId, String caseId, String actorName) {
    return registerNotification(instId, "case_freeze_requested",
        "Account Freeze Requested — " + caseId,
        actorName + " has requested an account freeze for case " + caseId +
        ". Route immediately to the Compliance desk for action.",
        "case", caseId, null, ROLES_COMPLIANCE_UP);
  }

  public Future<Notification> notifyBehavioralAlert(
      long institutionId, com.openiv.backend.beam.BehavioralAlert alert) {
    String type = alert.riskScore() >= 85 ? "behavioral_critical"
        : alert.riskScore() >= 70 ? "behavioral_high" : "behavioral_flag";
    String[] roles = alert.riskScore() >= 70 ? ROLES_COMPLIANCE_UP : ROLES_ANALYST_UP;
    return registerNotification(institutionId, type,
        buildBehavioralTitle(alert), buildBehavioralBody(alert),
        null, null, null, roles);
  }

  public Future<Notification> notifyRiskReport(long instId, int highRiskCount, int highestScore, String topCustomerName) {
    if (highRiskCount == 0) return Future.succeededFuture(null);

    String title = "Daily Risk Alert — " + highRiskCount + " customer" + (highRiskCount == 1 ? "" : "s") + " need your attention";
    String body = "Your overnight fraud monitoring has completed. We found " + highRiskCount
        + " customer" + (highRiskCount == 1 ? "" : "s") + " with an overall risk score above 75 — "
        + "the level at which the risk of financial crime is considered significant. "
        + "The highest-risk customer scored " + highestScore + " out of 100"
        + (topCustomerName != null ? " (" + topCustomerName + ")" : "") + ". "
        + "What you should do: open the High-Risk Customers section, review each profile, "
        + "and either open a formal investigation case or file a Suspicious Activity Report (SAR) with the NFIU.";
    return registerNotification(instId, "risk_report_daily", title, body,
        null, null, null, ROLES_COMPLIANCE_UP);
  }

  /** Notifies privileged roles when a team member expresses interest in a case. */
  public Future<Notification> notifyInterestExpressed(long instId, String caseId, String userName) {
    String body = userName + " has raised their hand to investigate case " + caseId + ". "
        + "Open the case to review their request and accept or ignore it.";
    return registerNotification(instId, "case_interest_expressed",
        "Interest in Case — " + caseId, body,
        "case", caseId, null, ROLES_COMPLIANCE_UP);
  }

  /** Notifies a specific user that their interest in a case was accepted and they are now assigned. */
  public Future<Notification> notifyInterestAccepted(long instId, String caseId,
      long toUserId, String actorName) {
    String body = actorName + " accepted your interest in case " + caseId
        + ". The case has been assigned to you — please open it and begin your investigation.";
    return registerNotification(instId, "case_interest_accepted",
        "Case Assigned to You — " + caseId, body,
        "case", caseId, toUserId, null);
  }

  // ── Workflow notifications ─────────────────────────────────────────────────

  public Future<Notification> notifyWorkflowSubmitted(long instId, long workflowId,
      String workflowName, String submitterName) {
    String body = submitterName + " submitted the CDD workflow \"" + workflowName + "\" (#" + workflowId + ") "
        + "for approval. Open Workflows to review the block sequence and approve or reject it. "
        + "Maker-checker rule: you must be a different officer than the submitter to approve.";
    return registerNotification(instId, "workflow_pending_approval",
        "Workflow Awaiting Approval — " + workflowName, body,
        "workflow", String.valueOf(workflowId), null, ROLES_COMPLIANCE_UP);
  }

  public Future<Notification> notifyWorkflowApproved(long instId, long workflowId,
      String workflowName, String approverName) {
    String body = approverName + " approved and activated \"" + workflowName + "\" (#" + workflowId + "). "
        + "The workflow is now live and will begin scheduling CDD re-screenings.";
    return registerNotification(instId, "workflow_approved",
        "Workflow Activated — " + workflowName, body,
        "workflow", String.valueOf(workflowId), null, ROLES_COMPLIANCE_UP);
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
        "signs of fraud. The transaction has been flagged and a case has been opened for your review.",
        "transaction", transactionId, null, ROLES_COMPLIANCE_UP);
  }

  // ── Read methods ───────────────────────────────────────────────────────────

  /**
   * Returns notifications visible to this user:
   * - admin/cco see everything
   * - others see notifications addressed to them (recipient_id) or their role (target_roles)
   */
  public Future<List<Notification>> listRecent(long institutionId, long userId,
      String userRole, int limit) {
    boolean isAdmin = "admin".equals(userRole) || "cco".equals(userRole);
    String sql = isAdmin
        ? "SELECT n.id, n.institution_id, n.type, n.title, n.body, " +
          "  CASE WHEN nr.user_id IS NOT NULL THEN 'read' ELSE 'unread' END AS status, " +
          "  n.created_at, n.entity_type, n.entity_id, n.recipient_id, n.target_roles " +
          "FROM notifications n " +
          "LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $2 " +
          "WHERE n.institution_id = $1 " +
          "ORDER BY n.created_at DESC LIMIT $3"
        : "SELECT n.id, n.institution_id, n.type, n.title, n.body, " +
          "  CASE WHEN nr.user_id IS NOT NULL THEN 'read' ELSE 'unread' END AS status, " +
          "  n.created_at, n.entity_type, n.entity_id, n.recipient_id, n.target_roles " +
          "FROM notifications n " +
          "LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $2 " +
          "WHERE n.institution_id = $1 " +
          "  AND (n.recipient_id = $2 OR n.target_roles @> ARRAY[$3]::text[]) " +
          "ORDER BY n.created_at DESC LIMIT $4";

    Tuple params = isAdmin
        ? Tuple.of(institutionId, userId, limit)
        : Tuple.of(institutionId, userId, userRole, limit);

    return pool.preparedQuery(sql)
        .execute(params)
        .map(rs -> {
          var out = new ArrayList<Notification>();
          rs.forEach(r -> out.add(rowTo(r)));
          return out;
        });
  }

  public Future<Integer> markAllRead(long institutionId, long userId, String userRole) {
    boolean isAdmin = "admin".equals(userRole) || "cco".equals(userRole);
    String sql = isAdmin
        ? "INSERT INTO notification_reads(notification_id, user_id) " +
          "SELECT n.id, $2 FROM notifications n " +
          "WHERE n.institution_id = $1 " +
          "ON CONFLICT DO NOTHING"
        : "INSERT INTO notification_reads(notification_id, user_id) " +
          "SELECT n.id, $2 FROM notifications n " +
          "WHERE n.institution_id = $1 " +
          "  AND (n.recipient_id = $2 OR n.target_roles @> ARRAY[$3]::text[]) " +
          "ON CONFLICT DO NOTHING";

    Tuple params = isAdmin
        ? Tuple.of(institutionId, userId)
        : Tuple.of(institutionId, userId, userRole);

    return pool.preparedQuery(sql)
        .execute(params)
        .map(rs -> rs.rowCount());
  }

  public Future<JsonObject> getUnreadCounts(long institutionId, long userId, String userRole) {
    boolean isAdmin = "admin".equals(userRole) || "cco".equals(userRole);
    String sql = isAdmin
        ? "SELECT n.type, COUNT(*) as count FROM notifications n " +
          "WHERE n.institution_id = $1 " +
          "  AND NOT EXISTS (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = n.id AND nr.user_id = $2) " +
          "GROUP BY n.type"
        : "SELECT n.type, COUNT(*) as count FROM notifications n " +
          "WHERE n.institution_id = $1 " +
          "  AND (n.recipient_id = $2 OR n.target_roles @> ARRAY[$3]::text[]) " +
          "  AND NOT EXISTS (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = n.id AND nr.user_id = $2) " +
          "GROUP BY n.type";

    Tuple params = isAdmin
        ? Tuple.of(institutionId, userId)
        : Tuple.of(institutionId, userId, userRole);

    return pool.preparedQuery(sql)
        .execute(params)
        .map(rs -> {
          int flags = 0, cases = 0;
          for (Row r : rs) {
            String type  = r.getString("type");
            Long   count = r.getLong("count");
            if (count == null) continue;
            if (type.contains("flag") || type.contains("cyber") || type.contains("behavioral"))
              flags += count.intValue();
            else if (type.contains("case") || type.contains("kyc") || type.contains("risk_report"))
              cases += count.intValue();
          }
          return new JsonObject().put("flags", flags).put("cases", cases);
        });
  }

  public Future<Boolean> markRead(long id, long institutionId, long userId) {
    return pool.preparedQuery(
        "INSERT INTO notification_reads(notification_id, user_id) " +
        "SELECT $1, $2 " +
        "WHERE EXISTS (SELECT 1 FROM notifications WHERE id=$1 AND institution_id=$3) " +
        "ON CONFLICT DO NOTHING")
        .execute(Tuple.of(id, userId, institutionId))
        .map(rs -> rs.rowCount() > 0);
  }

  public Future<Void> markAllReadByCategory(long institutionId, long userId,
      String userRole, String category) {
    boolean isAdmin = "admin".equals(userRole) || "cco".equals(userRole);
    String typeFilter = "";
    if ("flags".equals(category))
      typeFilter = " AND (n.type LIKE '%flag%' OR n.type LIKE '%cyber%' OR n.type LIKE '%behavioral%')";
    else if ("cases".equals(category))
      typeFilter = " AND (n.type LIKE '%case%' OR n.type LIKE '%kyc%' OR n.type LIKE '%risk_report%')";

    String sql = isAdmin
        ? "INSERT INTO notification_reads(notification_id, user_id) " +
          "SELECT n.id, $2 FROM notifications n " +
          "WHERE n.institution_id = $1" + typeFilter + " ON CONFLICT DO NOTHING"
        : "INSERT INTO notification_reads(notification_id, user_id) " +
          "SELECT n.id, $2 FROM notifications n " +
          "WHERE n.institution_id = $1 " +
          "  AND (n.recipient_id = $2 OR n.target_roles @> ARRAY[$3]::text[])" +
          typeFilter + " ON CONFLICT DO NOTHING";

    Tuple params = isAdmin
        ? Tuple.of(institutionId, userId)
        : Tuple.of(institutionId, userId, userRole);

    return pool.preparedQuery(sql)
        .execute(params)
        .mapEmpty();
  }

  // ── SSE visibility check ───────────────────────────────────────────────────

  /** Returns true if this notification should be pushed to a user with the given role/id. */
  public static boolean isVisibleToUser(JsonObject notif, long userId, String userRole) {
    if (userRole == null) return false;
    if ("admin".equals(userRole) || "cco".equals(userRole)) return true;
    Long recipientId = notif.getLong("recipientId");
    if (recipientId != null && recipientId == userId) return true;
    JsonArray targetRoles = notif.getJsonArray("targetRoles");
    if (targetRoles != null) {
      for (int i = 0; i < targetRoles.size(); i++) {
        if (userRole.equals(targetRoles.getString(i))) return true;
      }
    }
    return false;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private Future<Notification> registerNotification(long instId, String type,
      String title, String body, String entityType, String entityId,
      Long recipientId, String[] targetRoles) {
    return pool.preparedQuery(
        "INSERT INTO notifications " +
        "(institution_id, type, title, body, status, entity_type, entity_id, recipient_id, target_roles) " +
        "VALUES ($1, $2, $3, $4, 'unread', $5, $6, $7, $8) " +
        "RETURNING id, institution_id, type, title, body, status, created_at, " +
        "entity_type, entity_id, recipient_id, target_roles")
        .execute(Tuple.of(instId, type, title, body, entityType, entityId, recipientId, targetRoles))
        .map(rs -> rowTo(rs.iterator().next()))
        .onSuccess(n -> {
          log.info("[Notification] type={} inst={} recipient={} roles={}",
              type, instId, recipientId, targetRoles != null ? String.join(",", targetRoles) : "null");
          if (vertx != null) vertx.eventBus().publish(busAddress(instId), toJson(n));
        })
        .onFailure(e -> log.error("[Notification] Failed to register type={}", type, e));
  }

  private static Notification rowTo(Row r) {
    Long recipientId = (Long) r.getValue("recipient_id");
    Object rolesObj  = r.getValue("target_roles");
    List<String> targetRoles = null;
    if (rolesObj instanceof String[] arr) targetRoles = List.of(arr);
    return new Notification(
        r.getLong("id"), r.getLong("institution_id"),
        r.getString("type"), r.getString("title"), r.getString("body"),
        r.getString("status"), r.getOffsetDateTime("created_at"),
        r.getString("entity_type"), r.getString("entity_id"),
        recipientId, targetRoles);
  }

  public static JsonObject toJson(Notification n) {
    var obj = new JsonObject()
        .put("id",            n.id())
        .put("institutionId", n.institutionId())
        .put("type",          n.type())
        .put("title",         n.title())
        .put("body",          n.body())
        .put("status",        n.status())
        .put("createdAt",     n.createdAt().toString());
    if (n.entityType()   != null) obj.put("entityType",   n.entityType());
    if (n.entityId()     != null) obj.put("entityId",     n.entityId());
    if (n.recipientId()  != null) obj.put("recipientId",  n.recipientId());
    if (n.targetRoles()  != null && !n.targetRoles().isEmpty())
      obj.put("targetRoles", new JsonArray(n.targetRoles()));
    return obj;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private static String riskLabel(String priority) {
    return switch (priority) {
      case "critical" -> "CRITICAL";
      case "high"     -> "HIGH";
      case "medium"   -> "MEDIUM";
      default         -> "LOW";
    };
  }

  private static String formatAmount(String amount, String currency) {
    try {
      long val = new java.math.BigDecimal(amount).longValue();
      return String.format("%s %,d", currency != null ? currency : "NGN", val);
    } catch (Exception e) {
      return (currency != null ? currency : "NGN") + " " + amount;
    }
  }

  private static String buildBehavioralTitle(com.openiv.backend.beam.BehavioralAlert a) {
    return switch (a.rule()) {
      case "LOGIN_IMPOSSIBLE_TRAVEL"   -> "Impossible Travel Login Detected";
      case "LOGIN_TIME_ANOMALY"        -> "Off-Hours Login Alert";
      case "LOGIN_VELOCITY"            -> "Login Velocity Spike";
      case "LOGIN_NEW_COUNTRY"         -> "Login from New Country";
      case "LOGIN_MICRO_TIMING"        -> "Suspicious Login Timestamp";
      case "LOGIN_TIMESTAMP_STALE"     -> "Stale Login Event — Possible Replay";
      case "LOGIN_TIMESTAMP_FUTURE"    -> "Future Login Timestamp — Clock Tampering";
      case "ACTIVITY_TIME_ANOMALY"     -> "Off-Hours Activity Detected";
      case "ACTIVITY_BURST"            -> "Abnormal Activity Burst";
      case "ACTIVITY_SESSION_ANOMALY"  -> "Session Hijacking Signal";
      case "ACTIVITY_MICRO_TIMING"     -> "Suspicious Activity Timestamp";
      case "ACTIVITY_TIMESTAMP_STALE"  -> "Stale Activity Event — Possible Replay";
      case "ACTIVITY_TIMESTAMP_FUTURE" -> "Future Activity Timestamp";
      case "LOCATION_IMPOSSIBLE_TRAVEL"-> "Impossible GPS Travel Detected";
      case "LOCATION_HIGH_RISK_REGION" -> "Customer in High-Risk Jurisdiction";
      case "LOCATION_RAPID_CHANGE"     -> "Rapid GPS Ping Flood — Possible Spoofing";
      case "LOCATION_COUNTRY_CHANGE"   -> "Customer Location Changed Country";
      case "LOCATION_MICRO_TIMING"     -> "Suspicious Location Timestamp";
      case "LOCATION_TIMESTAMP_STALE"  -> "Stale Location Event — Possible Replay";
      case "LOCATION_TIMESTAMP_FUTURE" -> "Future Location Timestamp";
      case "DEVICE_SHARED_ACCOUNTS"    -> "Device Shared Across Multiple Accounts";
      case "DEVICE_JAILBREAK_ROOT"     -> "Jailbroken/Rooted Device Detected";
      case "DEVICE_EMULATOR"           -> "Emulator Detected — Possible Bot Attack";
      case "DEVICE_RAPID_SWAP"         -> "Rapid Device Change — SIM-Swap Precursor";
      case "DEVICE_CLONED"             -> "Cloned Device Detected";
      case "DEVICE_MICRO_TIMING"       -> "Suspicious Device Event Timestamp";
      case "DEVICE_TIMESTAMP_STALE"    -> "Stale Device Event — Possible Replay";
      case "DEVICE_TIMESTAMP_FUTURE"   -> "Future Device Timestamp";
      case "OTP_MICRO_TIMING"          -> "Suspicious OTP Event Timestamp";
      case "OTP_TIMESTAMP_STALE"       -> "Stale OTP Event — Possible Replay";
      case "OTP_TIMESTAMP_FUTURE"      -> "Future OTP Timestamp";
      default -> "Behavioral Alert — Risk Score " + a.riskScore();
    };
  }

  private static String buildBehavioralBody(com.openiv.backend.beam.BehavioralAlert a) {
    var sb = new StringBuilder();
    sb.append(a.detail());
    if (a.reasons() != null && a.reasons().length > 0) {
      sb.append(" Signals: ").append(String.join("; ", a.reasons())).append(".");
    }
    sb.append(" Risk score: ").append(a.riskScore()).append("/100.");
    if (a.customerId() != null) sb.append(" Customer: ").append(a.customerId()).append(".");
    if (a.deviceId()   != null) sb.append(" Device: ").append(a.deviceId()).append(".");
    return sb.toString();
  }
}
