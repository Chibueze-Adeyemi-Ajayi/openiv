package com.openiv.backend.cases;

import com.openiv.backend.aml.AmlSettings;
import com.openiv.backend.aml.AmlSettingsRepository;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.cases.CaseRepository.CasePage;
import com.openiv.backend.notifications.NotificationService;
import io.vertx.core.Future;

import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public final class CaseService {

  private final CaseRepository repository;
  private final UserRepository users;
  private final AmlSettingsRepository amlSettingsRepository;
  private final NotificationService notifications;

  public CaseService(CaseRepository repository, UserRepository users,
      AmlSettingsRepository amlSettingsRepository, NotificationService notifications) {
    this.repository = repository;
    this.users = users;
    this.amlSettingsRepository = amlSettingsRepository;
    this.notifications = notifications;
  }

  public Future<CaseMetrics> metrics(Session session) {
    return resolveUser(session).compose(u -> repository.metrics(u.institutionId()));
  }

  public Future<CasePage> list(Session session, String status, String priority,
      String q, int page, int pageSize, String sort, String range,
      Integer minRisk, Integer maxRisk, Boolean assignedToMe, Long assignedToUser, Boolean hasInterest) {
    return resolveUser(session)
        .compose(u -> repository.list(u.institutionId(), status, priority, q, page, pageSize,
            sort, range, minRisk, maxRisk, u.id(), u.role(), assignedToMe, assignedToUser, hasInterest));
  }

  public Future<CasePage> listUnavailable(Session session, String status, String priority,
      String q, int page, int pageSize, String sort, String range,
      Integer minRisk, Integer maxRisk) {
    return resolveUser(session)
        .compose(u -> repository.listUnavailable(u.institutionId(), status, priority, q, page, pageSize,
            sort, range, minRisk, maxRisk, u.id()));
  }

  public Future<CaseRecord> create(Session session, String title, String typology,
      String priority, int riskScore, Long assignedTo, String notes, String transactionId,
      String reason, Long documentId, String customerId, String customerName) {
    return resolveUser(session).compose(u -> {
      OffsetDateTime sla = computeSla(priority);
      return repository.nextSeq().compose(seq -> {
        String id = "CASE-"
            + YearMonth.now().format(DateTimeFormatter.ofPattern("yyyyMM"))
            + "-" + String.format("%06d", seq);
        return repository.create(id, u.institutionId(), title, title, typology,
                priority, riskScore, assignedTo, notes, sla, u.id(), reason, documentId,
                customerId, customerName)
            .compose(cas -> {
              Future<Void> linkFuture = (transactionId != null && !transactionId.isBlank())
                  ? repository.linkTransaction(cas.id(), transactionId, u.institutionId()).mapEmpty()
                  : Future.succeededFuture();
              String actDetail = (transactionId != null && !transactionId.isBlank())
                  ? "Case opened from transaction " + transactionId
                  : "Case opened";
              Future<Void> actFuture = repository.addActivity(cas.id(), u.id(), "opened", actDetail);
              return Future.all(linkFuture, actFuture).map(cas);
            });
      });
    });
  }

  public Future<Optional<CaseDetail>> detail(Session session, String id) {
    return resolveUser(session).compose(u -> {
      // Mark as seen when opened
      repository.markSeen(id, u.institutionId(), u.id()).onFailure(e -> {});
      return repository.detail(id, u.institutionId(), u.id());
    });
  }

  public Future<Boolean> updateStatus(Session session, String id,
      String newStatus, String resolution, String reason, Long documentId) {
    return resolveUser(session).compose(u ->
        repository.findById(id, u.institutionId(), u.id()).compose(opt -> {
          if (opt.isEmpty()) return Future.succeededFuture(false);
          CaseRecord cas = opt.get();
          String current = cas.status();
          if (!isValidTransition(current, newStatus)) {
            return Future.failedFuture(new IllegalArgumentException(
                "Invalid transition: " + current + " → " + newStatus));
          }
          if ("pending_review".equals(current) && !isL2Role(u.role())) {
            return Future.failedFuture(AuthException.security("insufficient_role_for_pending_review"));
          }
          // Can only close a case if it is assigned to the current user (or elevated role)
          if ("closed".equals(newStatus) && cas.assignedTo() != null
              && !cas.assignedTo().equals(u.id()) && !isL2Role(u.role())) {
            return Future.failedFuture(AuthException.security("must_be_assigned_to_close"));
          }
          return repository.updateStatus(id, u.institutionId(), newStatus, resolution)
              .compose(updated -> {
                if (!updated) return Future.succeededFuture(false);
                String detail = reason
                    + "\nStatus changed from " + current + " to " + newStatus
                    + (resolution != null ? " · resolution: " + resolution : "");
                String action = "closed".equals(newStatus) ? "closed"
                    : "pending_review".equals(newStatus) ? "submitted_for_review"
                    : "status_changed";
                Future<Void> actFuture = documentId != null
                    ? repository.addActivity(id, u.id(), action, detail, documentId)
                    : repository.addActivity(id, u.id(), action, detail);
                // Auto-assign to current user when starting investigation
                Future<Void> assignFuture = "investigating".equals(newStatus)
                    ? repository.assignCase(id, u.institutionId(), u.id())
                    : Future.succeededFuture();
                // Notifications
                Future<Void> notifyFuture = switch (newStatus) {
                  case "investigating" -> notifications
                      .notifyCaseInvestigationStarted(u.institutionId(), id, u.displayName())
                      .mapEmpty();
                  case "closed" -> notifications
                      .notifyCaseClosed(u.institutionId(), id, resolution, u.displayName())
                      .mapEmpty();
                  case "escalated" -> notifications
                      .notifyCaseEscalated(u.institutionId(), id, u.displayName())
                      .mapEmpty();
                  default -> Future.succeededFuture();
                };
                return Future.all(actFuture, assignFuture, notifyFuture).map(v -> true);
              });
        }));
  }

  public Future<Void> assignCase(Session session, String caseId, Long toUserId) {
    return resolveUser(session).compose(u -> {
      long targetId = toUserId != null ? toUserId : u.id();
      if (!isL2Role(u.role()) && targetId != u.id()) {
        return Future.failedFuture(AuthException.security("insufficient_role_to_assign_others"));
      }
      // If the case already has an assignee, only super-admin roles may override it
      return repository.findById(caseId, u.institutionId(), u.id()).compose(caseOpt -> {
        if (caseOpt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("case_not_found"));
        CaseRecord cas = caseOpt.get();
        if (cas.assignedTo() != null && !isL2Role(u.role())) {
          return Future.failedFuture(AuthException.security("only_privileged_role_can_reassign"));
        }
        return users.findById(targetId).compose(targetOpt -> {
          String targetName = targetOpt.map(User::displayName).orElse("User #" + targetId);
          return repository.assignCase(caseId, u.institutionId(), targetId)
              .compose(v -> repository.addActivity(caseId, u.id(), "assigned",
                  "Case assigned to " + targetName + " by " + u.displayName()))
              .compose(v -> notifications
                  .notifyCaseAssigned(u.institutionId(), caseId, targetId, u.displayName())
                  .mapEmpty());
        });
      });
    });
  }

  public Future<Void> linkNfiuReport(Session session, String caseId, long nfiuReportId) {
    return resolveUser(session).compose(u ->
        repository.linkNfiuReport(caseId, u.institutionId(), nfiuReportId)
            .compose(v -> repository.addActivity(caseId, u.id(), "nfiu_report_linked",
                "NFIU report #" + nfiuReportId + " linked to case")));
  }

  public Future<Boolean> linkTransaction(Session session, String caseId, String transactionId) {
    return resolveUser(session).compose(u ->
        repository.linkTransaction(caseId, transactionId, u.institutionId())
            .compose(linked -> {
              if (!linked) return Future.succeededFuture(false);
              return repository.addActivity(caseId, u.id(), "transaction_linked",
                  "Transaction " + transactionId + " added to case").map(v -> true);
            }));
  }

  public Future<Optional<CaseRecord>> findByTransactionId(Session session, String transactionId) {
    return resolveUser(session)
        .compose(u -> repository.findCaseByTransaction(u.institutionId(), transactionId, u.id()));
  }

  public Future<Void> markSeen(Session session, String caseId) {
    return resolveUser(session)
        .compose(u -> repository.markSeen(caseId, u.institutionId(), u.id()));
  }

  public Future<Long> unassignedCount(Session session) {
    return resolveUser(session)
        .compose(u -> repository.unassignedCount(u.institutionId()));
  }

  public Future<Long> unseenCount(Session session) {
    return resolveUser(session)
        .compose(u -> repository.unseenCount(u.institutionId(), u.id()));
  }

  public Future<CaseEvidence> addEvidence(Session session, String caseId,
      String category, String title, String detail, String refId) {
    return resolveUser(session).compose(u ->
        repository.findById(caseId, u.institutionId(), u.id()).compose(opt -> {
          if (opt.isEmpty())
            return Future.failedFuture(new IllegalArgumentException("Case not found"));
          return repository.addEvidence(caseId, u.id(), category, title, detail, refId)
              .compose(ev -> {
                String actDetail = "[" + category.toUpperCase() + "] " + title;
                return repository.addActivity(caseId, u.id(), "evidence_added", actDetail)
                    .map(v -> ev);
              });
        }));
  }

  public Future<Void> addNote(Session session, String caseId, String note) {
    return resolveUser(session).compose(u ->
        repository.findById(caseId, u.institutionId(), u.id()).compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("Case not found"));
          return repository.addActivity(caseId, u.id(), "note_added", note);
        }));
  }

  public Future<Void> addSystemActivity(String caseId, long institutionId,
      String action, String detail) {
    return repository.findById(caseId, institutionId, 0L).compose(opt -> {
      if (opt.isEmpty()) return Future.succeededFuture();
      return repository.addActivity(caseId, 0L, action, detail);
    });
  }

  public Future<Void> escalatePriorityBySystem(String caseId, long institutionId, String priority) {
    return repository.updatePriority(caseId, priority).mapEmpty();
  }

  public Future<Optional<AmlSettings>> getAmlSettings(Session session) {
    return resolveUser(session).compose(u -> amlSettingsRepository.getByInstitution(u.institutionId()));
  }

  public Future<AmlSettings> updateAmlSettings(Session session, boolean autoOpenCase, Integer flagThreshold, Integer caseThreshold, Integer behFlagThreshold, Integer behCaseThreshold, Integer normalThreshold, Integer behNormalThreshold, Integer kycNormalThreshold, Integer kycCaseThreshold) {
    return resolveUser(session).compose(u ->
        amlSettingsRepository.upsert(u.institutionId(), autoOpenCase, flagThreshold, caseThreshold, behFlagThreshold, behCaseThreshold, normalThreshold, behNormalThreshold, kycNormalThreshold, kycCaseThreshold));
  }

  public Future<AmlSettings> updateDailyTxnLimit(Session session, int dailyTxnLimit) {
    return resolveUser(session).compose(u ->
        amlSettingsRepository.updateDailyTxnLimit(u.institutionId(), dailyTxnLimit));
  }

  public Future<AmlSettings> updateExpectedDailyTxnCount(Session session, int expectedDailyTxnCount) {
    return resolveUser(session).compose(u ->
        amlSettingsRepository.updateExpectedDailyTxnCount(u.institutionId(), expectedDailyTxnCount));
  }

  public Future<AmlSettings> updateBeamWindow(Session session, int beamWindowSeconds) {
    return resolveUser(session).compose(u ->
        amlSettingsRepository.updateBeamWindow(u.institutionId(), beamWindowSeconds));
  }

  public Future<AmlSettings> updateTimezone(Session session, String timezone) {
    return resolveUser(session).compose(u ->
        amlSettingsRepository.updateTimezone(u.institutionId(), timezone));
  }

  public Future<AmlSettings> addCaseNotificationEmail(Session session, String email) {
    return resolveUser(session).compose(u ->
        amlSettingsRepository.getByInstitution(u.institutionId())
            .compose(opt -> {
              if (opt.isEmpty()) {
                return amlSettingsRepository.upsert(u.institutionId(), true, null, null, null, null, null, null, null, null)
                    .compose(settings -> amlSettingsRepository.addNotificationEmail(settings.id(), email)
                        .map(v -> settings));
              }
              AmlSettings settings = opt.get();
              return amlSettingsRepository.addNotificationEmail(settings.id(), email)
                  .compose(v -> amlSettingsRepository.getByInstitution(u.institutionId()))
                  .map(newOpt -> newOpt.orElse(settings));
            }));
  }

  public Future<AmlSettings> removeCaseNotificationEmail(Session session, String email) {
    return resolveUser(session).compose(u ->
        amlSettingsRepository.getByInstitution(u.institutionId())
            .compose(opt -> {
              if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("AML settings not found"));
              AmlSettings settings = opt.get();
              return amlSettingsRepository.removeNotificationEmail(settings.id(), email)
                  .compose(v -> amlSettingsRepository.getByInstitution(u.institutionId()))
                  .map(newOpt -> newOpt.orElse(settings));
            }));
  }

  public Future<io.vertx.core.json.JsonObject> analytics(Session session, String range) {
    return resolveUser(session).compose(u -> repository.analytics(u.institutionId(), range));
  }

  // ── Case interests ────────────────────────────────────────────────────────

  public Future<Boolean> expressInterest(Session session, String caseId) {
    return resolveUser(session).compose(u ->
        repository.findById(caseId, u.institutionId(), u.id()).compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("case_not_found"));
          return repository.expressInterest(caseId, u.institutionId(), u.id(), u.displayName())
              .compose(expressed -> {
                if (expressed) {
                  notifications.notifyInterestExpressed(u.institutionId(), caseId, u.displayName())
                      .onFailure(e -> {});
                }
                return Future.succeededFuture(expressed);
              });
        }));
  }

  public Future<List<CaseInterest>> listInterests(Session session, String caseId) {
    return resolveUser(session).compose(u ->
        repository.listInterests(caseId, u.institutionId()));
  }

  public Future<Void> acceptInterest(Session session, String caseId, long userId) {
    return resolveUser(session).compose(u -> {
      if (!isL2Role(u.role())) {
        return Future.failedFuture(AuthException.security("insufficient_role_to_accept_interest"));
      }
      return repository.acceptInterest(caseId, u.institutionId(), userId).compose(accepted -> {
        if (!accepted) return Future.failedFuture(new IllegalArgumentException("interest_not_found"));
        return users.findById(userId).compose(targetOpt -> {
          String targetName = targetOpt.map(User::displayName).orElse("User #" + userId);
          return repository.assignCase(caseId, u.institutionId(), userId)
              .compose(v -> repository.addActivity(caseId, u.id(), "assigned",
                  "Case assigned to " + targetName + " (interest accepted) by " + u.displayName()))
              .compose(v -> notifications
                  .notifyInterestAccepted(u.institutionId(), caseId, userId, u.displayName())
                  .mapEmpty());
        });
      });
    });
  }

  public Future<Optional<CaseInterest>> myInterest(Session session, String caseId) {
    return resolveUser(session).compose(u ->
        repository.myInterest(caseId, u.institutionId(), u.id()));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId()).map(opt ->
        opt.orElseThrow(() -> AuthException.invalid("session")));
  }

  private static OffsetDateTime computeSla(String priority) {
    int hours = switch (priority != null ? priority : "medium") {
      case "critical" ->   4;
      case "high"     ->  24;
      case "low"      -> 168;
      default         ->  72;
    };
    return OffsetDateTime.now().plusHours(hours);
  }

  private static boolean isValidTransition(String from, String to) {
    return switch (from) {
      case "open"           -> Set.of("investigating", "escalated", "pending_review", "closed").contains(to);
      case "investigating"  -> Set.of("escalated", "pending_review", "closed").contains(to);
      case "escalated"      -> Set.of("pending_review", "closed").contains(to);
      case "pending_review" -> Set.of("investigating", "closed").contains(to);
      default               -> false;
    };
  }

  private static boolean isL2Role(String role) {
    return role != null && Set.of("admin", "cco").contains(role);
  }
}
