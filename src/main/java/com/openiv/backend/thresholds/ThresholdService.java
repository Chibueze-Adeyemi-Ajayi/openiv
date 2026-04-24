package com.openiv.backend.thresholds;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import io.vertx.core.Future;

import java.util.List;
import java.util.Optional;

public final class ThresholdService {

  private final ThresholdRepository repository;
  private final UserRepository       users;

  public ThresholdService(ThresholdRepository repository, UserRepository users) {
    this.repository = repository;
    this.users      = users;
  }

  public Future<List<ThresholdRecord>> list(Session session) {
    return resolveUser(session).compose(u ->
        repository.seedIfEmpty(u.institutionId())
            .compose(v -> repository.list(u.institutionId())));
  }

  public Future<ThresholdMetrics> metrics(Session session) {
    return resolveUser(session).compose(u ->
        repository.seedIfEmpty(u.institutionId())
            .compose(v -> repository.metrics(u.institutionId())));
  }

  public Future<Optional<ThresholdRecord>> update(
      Session session, long id, Long newThreshold, Boolean newActive) {
    return resolveUser(session).compose(u ->
        repository.findById(id, u.institutionId()).compose(opt -> {
          if (opt.isEmpty()) return Future.succeededFuture(Optional.empty());
          ThresholdRecord rule = opt.get();

          if (newThreshold != null
              && (newThreshold < rule.minValue() || newThreshold > rule.maxValue())) {
            return Future.failedFuture(new IllegalArgumentException(
                "Threshold must be between " + rule.minValue() + " and " + rule.maxValue()));
          }

          Future<Void> thresholdFuture = Future.succeededFuture();
          Future<Void> activeFuture    = Future.succeededFuture();

          if (newThreshold != null && newThreshold != rule.thresholdValue()) {
            thresholdFuture = repository.updateValue(id, u.institutionId(), newThreshold)
                .compose(ok -> repository.addChange(
                    id, u.institutionId(), u.id(),
                    "threshold",
                    String.valueOf(rule.thresholdValue()),
                    String.valueOf(newThreshold)));
          }
          if (newActive != null && newActive != rule.isActive()) {
            activeFuture = repository.updateActive(id, u.institutionId(), newActive)
                .compose(ok -> repository.addChange(
                    id, u.institutionId(), u.id(),
                    "is_active",
                    String.valueOf(rule.isActive()),
                    String.valueOf(newActive)));
          }

          return Future.all(thresholdFuture, activeFuture)
              .compose(v -> repository.findById(id, u.institutionId()));
        }));
  }

  public Future<List<ThresholdChange>> history(Session session, long id) {
    return resolveUser(session).compose(u ->
        repository.history(id, u.institutionId()));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")));
  }
}
