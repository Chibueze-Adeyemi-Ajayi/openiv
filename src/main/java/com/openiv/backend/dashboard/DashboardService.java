package com.openiv.backend.dashboard;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.beam.OtpAlert;
import io.vertx.core.Future;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public final class DashboardService {

  private final DashboardRepository repository;
  private final UserRepository      users;

  public DashboardService(DashboardRepository repository, UserRepository users) {
    this.repository = repository;
    this.users      = users;
  }

  public Future<DashboardStats> stats(Session session) {
    return resolveUser(session).compose(u -> repository.stats(u.institutionId()));
  }

  public Future<List<HourlyBucket>> hourlyFlow(Session session) {
    return resolveUser(session).compose(u -> repository.hourlyFlow(u.institutionId()));
  }

  public Future<List<RiskPoint>> riskMapPoints(Session session,
                                                OffsetDateTime from, OffsetDateTime to) {
    return resolveUser(session).compose(u ->
        repository.riskMapPoints(u.institutionId(), from, to));
  }

  public Future<List<ActivityEvent>> recentActivity(Session session) {
    return resolveUser(session).compose(u -> repository.recentActivity(u.institutionId()));
  }

  public Future<List<ActivityEvent>> activitySince(Session session, long lastId) {
    return resolveUser(session).compose(u -> repository.activitySince(u.institutionId(), lastId));
  }

  /** Resolves institution ID for use in handler-level long-lived SSE connections. */
  public Future<Long> resolveInstitutionId(Session session) {
    return resolveUser(session).map(User::institutionId);
  }

  public Future<String> exportCsv(Session session, OffsetDateTime from, OffsetDateTime to) {
    return resolveUser(session).compose(u ->
        repository.exportCsv(u.institutionId(), from, to));
  }

  public Future<NfiuReturn> fileNfiuReturn(Session session, LocalDate from, LocalDate to) {
    return resolveUser(session).compose(u ->
        repository.fileNfiuReturn(u.institutionId(), u.id(), from, to));
  }

  public Future<List<OtpAlert>> recentOtpAlerts(Session session) {
    return resolveUser(session).compose(u -> repository.recentOtpAlerts(u.institutionId()));
  }

  public Future<List<OtpAlert>> otpAlertsSince(Session session, long lastId) {
    return resolveUser(session).compose(u -> repository.otpAlertsSince(u.institutionId(), lastId));
  }

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")));
  }
}
