package com.openiv.backend.behavioral;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import io.vertx.core.Future;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

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
      Session session, long id, JsonObject newParams, Boolean newActive,
      String newName, String newDescription, String newPolicyStatement) {
    return resolveUser(session).compose(u ->
        repository.findById(id, u.institutionId()).compose(opt -> {
          if (opt.isEmpty()) return Future.succeededFuture(Optional.empty());

          Future<Void> paramsFuture  = Future.succeededFuture();
          Future<Void> activeFuture  = Future.succeededFuture();
          Future<Void> fieldsFuture  = Future.succeededFuture();

          if (newParams != null) {
            paramsFuture = repository.updateParams(id, u.institutionId(), newParams).mapEmpty();
          }
          if (newActive != null) {
            activeFuture = repository.updateActive(id, u.institutionId(), newActive).mapEmpty();
          }
          if (newName != null || newDescription != null || newPolicyStatement != null) {
            fieldsFuture = repository.updateFields(id, u.institutionId(),
                newName, newDescription, newPolicyStatement).mapEmpty();
          }

          return Future.all(paramsFuture, activeFuture, fieldsFuture)
              .compose(v -> repository.findById(id, u.institutionId()));
        }));
  }

  public Future<BehavioralRuleRecord> create(Session session,
      String templateType, String name, String category, String severity,
      String description, String policyStatement, String example, String matchedTypology,
      JsonObject params, JsonArray recommendedActions) {
    return resolveUser(session).compose(u -> {
      if (templateType == null || templateType.isBlank())
        return Future.failedFuture(new IllegalArgumentException("templateType is required"));
      if (name == null || name.isBlank())
        return Future.failedFuture(new IllegalArgumentException("name is required"));
      String ruleId = "custom-" + UUID.randomUUID().toString().substring(0, 8);
      return repository.create(u.institutionId(), ruleId, templateType, name,
          category != null ? category : "Custom",
          severity != null ? severity : "medium",
          description != null ? description : "",
          policyStatement,
          example != null ? example : "",
          matchedTypology != null ? matchedTypology : "",
          params != null ? params : new JsonObject(),
          recommendedActions != null ? recommendedActions : new JsonArray());
    });
  }

  public Future<Boolean> delete(Session session, long id) {
    return resolveUser(session).compose(u -> repository.delete(id, u.institutionId()));
  }

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")));
  }
}
