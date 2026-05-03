package com.openiv.backend.cases;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.cases.CaseRepository.CasePage;
import io.vertx.core.Future;

import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.Set;

public final class CaseService {

  private final CaseRepository repository;
  private final UserRepository users;

  public CaseService(CaseRepository repository, UserRepository users) {
    this.repository = repository;
    this.users = users;
  }

  public Future<CaseMetrics> metrics(Session session) {
    return resolveUser(session).compose(u -> repository.metrics(u.institutionId()));
  }

  public Future<CasePage> list(Session session, String status, String priority,
      String q, int page, int pageSize) {
    return resolveUser(session)
        .compose(u -> repository.list(u.institutionId(), status, priority, q, page, pageSize));
  }

  public Future<CaseRecord> create(Session session, String title, String typology,
      String priority, int riskScore, Long assignedTo, String notes, String transactionId,
      String reason, Long documentId) {
    return resolveUser(session).compose(u -> {
      OffsetDateTime sla = computeSla(priority);
      return repository.nextSeq().compose(seq -> {
        String id = "CASE-"
            + YearMonth.now().format(DateTimeFormatter.ofPattern("yyyyMM"))
            + "-" + String.format("%06d", seq);
        return repository.create(id, u.institutionId(), title, typology,
                priority, riskScore, assignedTo, notes, sla, u.id(), reason, documentId)
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
    return resolveUser(session).compose(u -> repository.detail(id, u.institutionId()));
  }

  public Future<Boolean> updateStatus(Session session, String id,
      String newStatus, String resolution, String reason, Long documentId) {
    return resolveUser(session).compose(u ->
        repository.findById(id, u.institutionId()).compose(opt -> {
          if (opt.isEmpty()) return Future.succeededFuture(false);
          String current = opt.get().status();
          if (!isValidTransition(current, newStatus)) {
            return Future.failedFuture(new IllegalArgumentException(
                "Invalid transition: " + current + " → " + newStatus));
          }
          return repository.updateStatus(id, u.institutionId(), newStatus, resolution)
              .compose(updated -> {
                if (!updated) return Future.succeededFuture(false);
                String detail = reason
                    + "\nStatus changed from " + current + " to " + newStatus
                    + (resolution != null ? " · resolution: " + resolution : "");
                String action = "closed".equals(newStatus) ? "closed" : "status_changed";
                return repository.addActivity(id, u.id(), action, detail, documentId).map(v -> true);
              });
        }));
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
        .compose(u -> repository.findCaseByTransaction(u.institutionId(), transactionId));
  }

  public Future<CaseEvidence> addEvidence(Session session, String caseId,
      String category, String title, String detail, String refId) {
    return resolveUser(session).compose(u ->
        repository.findById(caseId, u.institutionId()).compose(opt -> {
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
        repository.findById(caseId, u.institutionId()).compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("Case not found"));
          return repository.addActivity(caseId, u.id(), "note_added", note);
        }));
  }

  public Future<Void> addSystemActivity(String caseId, long institutionId,
      String action, String detail) {
    return repository.findById(caseId, institutionId).compose(opt -> {
      if (opt.isEmpty()) return Future.succeededFuture();
      return repository.addActivity(caseId, 0L, action, detail);
    });
  }

  public Future<Void> escalatePriorityBySystem(String caseId, long institutionId, String priority) {
    return repository.updatePriority(caseId, priority).mapEmpty();
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
      case "open"          -> Set.of("investigating", "closed").contains(to);
      case "investigating" -> Set.of("escalated", "closed").contains(to);
      case "escalated"     -> "closed".equals(to);
      default              -> false;
    };
  }
}
