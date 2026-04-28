package com.openiv.backend.nfiu;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.billing.BillingService;

import io.vertx.core.Future;

import java.time.LocalDate;
import java.util.List;
// import java.util.Optional;

public final class NfiuService {

  private final NfiuRepository repository;
  private final UserRepository users;
  private final BillingService billing;

  public NfiuService(NfiuRepository repository, UserRepository users, BillingService billing) {
    this.repository = repository;
    this.users = users;
    this.billing = billing;
  }

  // ── Metrics ───────────────────────────────────────────────────────────────

  public Future<NfiuMetrics> getMetrics(Session session) {
    return resolveUser(session).compose(u -> repository.getMetrics(u.institutionId()));
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  public Future<List<NfiuReport>> listReports(Session session, String type, String status) {
    return resolveUser(session).compose(u -> repository.listReports(u.institutionId(), type, status));
  }

  public Future<NfiuReport> getReport(Session session, long id) {
    return resolveUser(session).compose(u -> repository.findReport(u.institutionId(), id)
        .map(opt -> opt.orElseThrow(() -> new IllegalArgumentException("Report not found"))));
  }

  public Future<NfiuReport> createReport(Session session,
      String reportType, String title,
      LocalDate periodStart, LocalDate periodEnd, String priority,
      String subjectName, String subjectAccount, String subjectBvn, String subjectType,
      Double amountNgn, int transactionCount, String narrative) {

    if (reportType == null || reportType.isBlank())
      return Future.failedFuture(new IllegalArgumentException("reportType is required"));
    if (title == null || title.isBlank())
      return Future.failedFuture(new IllegalArgumentException("title is required"));
    if (periodStart == null || periodEnd == null)
      return Future.failedFuture(new IllegalArgumentException("periodStart and periodEnd are required"));
    if (!periodEnd.isAfter(periodStart) && !periodEnd.equals(periodStart))
      return Future.failedFuture(new IllegalArgumentException("periodEnd must be on or after periodStart"));

    return resolveUser(session).compose(u -> repository.createReport(
        u.institutionId(), reportType, title, periodStart, periodEnd,
        priority != null ? priority : "medium",
        subjectName, subjectAccount, subjectBvn, subjectType,
        amountNgn, transactionCount, narrative));
  }

  public Future<NfiuReport> updateReport(Session session, long id,
      String title, LocalDate periodStart, LocalDate periodEnd, String priority,
      String subjectName, String subjectAccount, String subjectBvn, String subjectType,
      Double amountNgn, int transactionCount, String narrative) {
    return resolveUser(session).compose(u -> repository.updateReport(
        u.institutionId(), id, title, periodStart, periodEnd, priority,
        subjectName, subjectAccount, subjectBvn, subjectType,
        amountNgn, transactionCount, narrative));
  }

  public Future<NfiuReport> fileReport(Session session, long id) {
    return resolveUser(session).compose(u -> repository.fileReport(u.institutionId(), id, u.id(), u.displayName())
        .onSuccess(r -> billing.chargeNfiuReturnAsync(session)));
  }

  public Future<Void> deleteReport(Session session, long id) {
    return resolveUser(session).compose(u -> repository.deleteReport(u.institutionId(), id));
  }

  // ── Schedules ─────────────────────────────────────────────────────────────

  public Future<List<NfiuSchedule>> listSchedules(Session session) {
    return resolveUser(session).compose(u -> repository.listSchedules(u.institutionId()));
  }

  public Future<NfiuSchedule> createSchedule(Session session,
      String reportType, String name, String frequency, LocalDate nextDue, boolean autoFile) {
    if (reportType == null || reportType.isBlank())
      return Future.failedFuture(new IllegalArgumentException("reportType is required"));
    if (name == null || name.isBlank())
      return Future.failedFuture(new IllegalArgumentException("name is required"));
    if (nextDue == null)
      return Future.failedFuture(new IllegalArgumentException("nextDue is required"));

    return resolveUser(session).compose(
        u -> repository.createSchedule(u.institutionId(), reportType, name, frequency, nextDue, autoFile, u.id()));
  }

  public Future<NfiuSchedule> updateSchedule(Session session, long id,
      String name, String frequency, LocalDate nextDue, Boolean isActive, Boolean autoFile) {
    return resolveUser(session)
        .compose(u -> repository.updateSchedule(u.institutionId(), id, name, frequency, nextDue, isActive, autoFile));
  }

  public Future<Void> deleteSchedule(Session session, long id) {
    return resolveUser(session).compose(u -> repository.deleteSchedule(u.institutionId(), id));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")));
  }
}
