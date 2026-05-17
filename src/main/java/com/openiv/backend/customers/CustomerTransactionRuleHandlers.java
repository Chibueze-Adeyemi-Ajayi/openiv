package com.openiv.backend.customers;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class CustomerTransactionRuleHandlers {
  private final CustomerTransactionRuleService service;
  private final UserRepository users;

  public CustomerTransactionRuleHandlers(CustomerTransactionRuleService service, UserRepository users) {
    this.service = service;
    this.users = users;
  }

  // GET /customers/:id/rules
  public Handler<RoutingContext> listRules() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      String customerId = ctx.pathParam("id");
      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> new RuntimeException("session_invalid"));
            return service.listByExternalCustomerId(u.institutionId(), customerId);
          })
          .onSuccess(rules -> {
            JsonArray arr = new JsonArray();
            rules.forEach(r -> arr.add(toJson(r)));
            ctx.response().setStatusCode(200)
                .putHeader("Content-Type", "application/json")
                .end(new JsonObject().put("rules", arr).encode());
          })
          .onFailure(ctx::fail);
    };
  }

  // POST /customers/:id/rules
  public Handler<RoutingContext> createRule() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      String customerId = ctx.pathParam("id");
      JsonObject body = ctx.body().asJsonObject();
      if (body == null) { ctx.response().setStatusCode(400).end("{\"error\":\"invalid_body\"}"); return; }

      String ruleType    = body.getString("ruleType");
      JsonObject params  = body.getJsonObject("params", new JsonObject());
      String action      = body.getString("action", "block");
      String description = body.getString("description");
      String dirRaw      = body.getString("direction", "both");
      String direction   = java.util.Set.of("inward", "outward").contains(dirRaw) ? dirRaw : "both";

      if (ruleType == null || ruleType.isBlank()) {
        ctx.response().setStatusCode(400).end("{\"error\":\"rule_type_required\"}");
        return;
      }

      users.findById(session.userId())
          .<CustomerTransactionRule>compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> new RuntimeException("session_invalid"));
            return service.create(u.institutionId(), customerId, ruleType, params, action, description, u.id(), direction);
          })
          .onSuccess(rule -> ctx.response().setStatusCode(201)
              .putHeader("Content-Type", "application/json")
              .end(toJson(rule).encode()))
          .onFailure(ctx::fail);
    };
  }

  // PUT /customers/:id/rules/:ruleId
  public Handler<RoutingContext> updateRule() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      long ruleId;
      try { ruleId = Long.parseLong(ctx.pathParam("ruleId")); }
      catch (NumberFormatException e) { ctx.response().setStatusCode(400).end("{\"error\":\"invalid_rule_id\"}"); return; }

      JsonObject body = ctx.body().asJsonObject();
      if (body == null) { ctx.response().setStatusCode(400).end("{\"error\":\"invalid_body\"}"); return; }

      JsonObject params  = body.getJsonObject("params", new JsonObject());
      String action      = body.getString("action", "block");
      boolean isActive   = Boolean.TRUE.equals(body.getBoolean("isActive", true));
      String description = body.getString("description");
      String updDirRaw   = body.getString("direction", "both");
      String updDirection = java.util.Set.of("inward", "outward").contains(updDirRaw) ? updDirRaw : "both";

      final long finalRuleId = ruleId;
      users.findById(session.userId())
          .<CustomerTransactionRule>compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> new RuntimeException("session_invalid"));
            return service.update(u.institutionId(), finalRuleId, params, action, isActive, description, updDirection);
          })
          .onSuccess(rule -> ctx.response().setStatusCode(200)
              .putHeader("Content-Type", "application/json")
              .end(toJson(rule).encode()))
          .onFailure(e -> {
            if ("rule_not_found".equals(e.getMessage())) {
              ctx.response().setStatusCode(404).end("{\"error\":\"rule_not_found\"}");
            } else {
              ctx.fail(e);
            }
          });
    };
  }

  // DELETE /customers/:id/rules/:ruleId
  public Handler<RoutingContext> deleteRule() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      long ruleId;
      try { ruleId = Long.parseLong(ctx.pathParam("ruleId")); }
      catch (NumberFormatException e) { ctx.response().setStatusCode(400).end("{\"error\":\"invalid_rule_id\"}"); return; }

      final long finalRuleId = ruleId;
      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> new RuntimeException("session_invalid"));
            return service.delete(u.institutionId(), finalRuleId);
          })
          .onSuccess(v -> ctx.response().setStatusCode(204).end())
          .onFailure(ctx::fail);
    };
  }

  // PATCH /customers/:id/rules/:ruleId/toggle
  public Handler<RoutingContext> toggleRule() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      long ruleId;
      try { ruleId = Long.parseLong(ctx.pathParam("ruleId")); }
      catch (NumberFormatException e) { ctx.response().setStatusCode(400).end("{\"error\":\"invalid_rule_id\"}"); return; }

      JsonObject body = ctx.body().asJsonObject();
      boolean isActive = body != null && Boolean.TRUE.equals(body.getBoolean("isActive", false));

      final long finalRuleId = ruleId;
      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> new RuntimeException("session_invalid"));
            return service.toggleActive(u.institutionId(), finalRuleId, isActive);
          })
          .onSuccess(v -> ctx.response().setStatusCode(200)
              .putHeader("Content-Type", "application/json")
              .end("{\"ok\":true}"))
          .onFailure(ctx::fail);
    };
  }

  private JsonObject toJson(CustomerTransactionRule r) {
    JsonObject o = new JsonObject()
        .put("id", r.id())
        .put("institutionId", r.institutionId())
        .put("customerId", r.customerId())
        .put("ruleType", r.ruleType())
        .put("params", r.params())
        .put("action", r.action())
        .put("isActive", r.isActive())
        .put("description", r.description())
        .put("direction", r.direction())
        .put("createdAt", r.createdAt() != null ? r.createdAt().toString() : null)
        .put("updatedAt", r.updatedAt() != null ? r.updatedAt().toString() : null);
    if (r.createdBy() != null) o.put("createdBy", r.createdBy());
    return o;
  }
}
