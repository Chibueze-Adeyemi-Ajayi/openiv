package com.openiv.backend.behavioral;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;

import java.util.List;
import java.util.Optional;

public final class BehavioralRuleService {

  private final BehavioralRuleRepository repository;
  private final UserRepository users;

  public BehavioralRuleService(BehavioralRuleRepository repository, UserRepository users) {
    this.repository = repository;
    this.users = users;
  }

  public Future<List<BehavioralRuleRecord>> list(Session session) {
    return resolveUser(session).compose(u ->
        repository.seedIfEmpty(u.institutionId())
            .compose(v -> repository.list(u.institutionId())));
  }

  public Future<Optional<BehavioralRuleRecord>> update(
      Session session, long id, JsonObject newParams, Boolean newActive) {
    return resolveUser(session).compose(u ->
        repository.findById(id, u.institutionId()).compose(opt -> {
          if (opt.isEmpty()) return Future.succeededFuture(Optional.empty());

          Future<Void> paramsFuture = Future.succeededFuture();
          Future<Void> activeFuture = Future.succeededFuture();

          if (newParams != null) {
            paramsFuture = repository.updateParams(id, u.institutionId(), newParams).mapEmpty();
          }
          if (newActive != null) {
            activeFuture = repository.updateActive(id, u.institutionId(), newActive).mapEmpty();
          }

          return Future.all(paramsFuture, activeFuture)
              .compose(v -> repository.findById(id, u.institutionId()));
        }));
  }

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")));
  }
}
