package com.openiv.backend.behavioral;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class BehavioralRuleHandlers {

  private final BehavioralRuleService service;

  public BehavioralRuleHandlers(BehavioralRuleService service) {
    this.service = service;
  }

  // GET /behavioral-rules
  public Handler<RoutingContext> list() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.list(session)
          .onSuccess(rules -> {
            var arr = new JsonArray();
            rules.forEach(r -> arr.add(ruleJson(r)));
            ok(ctx, new JsonObject().put("rules", arr));
          })
          .onFailure(ctx::fail);
    };
  }

  // PATCH /behavioral-rules/:id
  public Handler<RoutingContext> update() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id;
      try { id = Long.parseLong(ctx.pathParam("id")); }
      catch (NumberFormatException e) { ctx.fail(400); return; }

      JsonObject body = body(ctx);
      if (body == null) return;

      JsonObject newParams       = body.containsKey("params")           ? body.getJsonObject("params") : null;
      Boolean    newActive       = body.containsKey("isActive")          ? body.getBoolean("isActive")  : null;
      String     newName         = body.containsKey("name")              ? body.getString("name")        : null;
      String     newDescription  = body.containsKey("description")       ? body.getString("description") : null;
      String     newPolicyStmt   = body.containsKey("policyStatement")   ? body.getString("policyStatement") : null;

      if (newParams == null && newActive == null && newName == null
          && newDescription == null && newPolicyStmt == null) {
        badRequest(ctx, "provide at least one of: params, isActive, name, description, policyStatement"); return;
      }

      service.update(session, id, newParams, newActive, newName, newDescription, newPolicyStmt)
          .onSuccess(opt -> {
            if (opt.isEmpty()) { ctx.fail(404); return; }
            ok(ctx, new JsonObject().put("ok", true).put("rule", ruleJson(opt.get())));
          })
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException) badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // POST /behavioral-rules
  public Handler<RoutingContext> create() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject b = body(ctx); if (b == null) return;
      String templateType = b.getString("templateType", "").trim();
      String name         = b.getString("name", "").trim();
      if (templateType.isEmpty()) { badRequest(ctx, "templateType is required"); return; }
      if (name.isEmpty())         { badRequest(ctx, "name is required");         return; }
      service.create(session,
              templateType, name,
              b.getString("category"),
              b.getString("severity"),
              b.getString("description"),
              b.getString("policyStatement"),
              b.getString("example"),
              b.getString("matchedTypology"),
              b.getJsonObject("params"),
              b.getJsonArray("recommendedActions"))
          .onSuccess(rule -> ok(ctx, new JsonObject().put("rule", ruleJson(rule))))
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException) badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // DELETE /behavioral-rules/:id
  public Handler<RoutingContext> delete() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id;
      try { id = Long.parseLong(ctx.pathParam("id")); }
      catch (NumberFormatException e) { ctx.fail(400); return; }
      service.delete(session, id)
          .onSuccess(deleted -> {
            if (!deleted) { badRequest(ctx, "Rule not found or default rules cannot be deleted"); return; }
            ok(ctx, new JsonObject().put("ok", true));
          })
          .onFailure(ctx::fail);
    };
  }

  // ── JSON serialisers ──────────────────────────────────────────────────────

  private static JsonObject ruleJson(BehavioralRuleRecord r) {
    return new JsonObject()
        .put("id",               r.id())
        .put("ruleId",           r.ruleId())
        .put("name",             r.name())
        .put("category",         r.category())
        .put("severity",         r.severity())
        .put("description",      r.description())
        .put("example",          r.example())
        .put("matchedTypology",  r.matchedTypology())
        .put("isActive",         r.isActive())
        .put("affected",         r.affected())
        .put("emergence",        r.emergence())
        .put("params",           r.params())
        .put("recommendedActions", r.recommendedActions())
        .put("templateType",     r.templateType())
        .put("policyStatement",  r.policyStatement())
        .put("createdAt",        r.createdAt().toString())
        .put("updatedAt",        r.updatedAt().toString());
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static void ok(RoutingContext ctx, JsonObject body) {
    ctx.response().setStatusCode(200)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }

  private static void badRequest(RoutingContext ctx, String msg) {
    ctx.response().setStatusCode(400)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(new JsonObject().put("error", msg).encode());
  }

  private static JsonObject body(RoutingContext ctx) {
    try {
      JsonObject b = ctx.body().asJsonObject();
      if (b == null) { ctx.fail(400); return null; }
      return b;
    } catch (Exception e) { ctx.fail(400); return null; }
  }
}
