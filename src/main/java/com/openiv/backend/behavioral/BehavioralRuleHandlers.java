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

      JsonObject newParams = body.containsKey("params") ? body.getJsonObject("params") : null;
      Boolean newActive    = body.containsKey("isActive") ? body.getBoolean("isActive") : null;

      if (newParams == null && newActive == null) {
        badRequest(ctx, "provide 'params' or 'isActive'"); return;
      }

      service.update(session, id, newParams, newActive)
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

  // ── JSON serialisers ──────────────────────────────────────────────────────

  private static JsonObject ruleJson(BehavioralRuleRecord r) {
    return new JsonObject()
        .put("id", r.id())
        .put("ruleId", r.ruleId())
        .put("name", r.name())
        .put("category", r.category())
        .put("severity", r.severity())
        .put("description", r.description())
        .put("example", r.example())
        .put("matchedTypology", r.matchedTypology())
        .put("isActive", r.isActive())
        .put("affected", r.affected())
        .put("emergence", r.emergence())
        .put("params", r.params())
        .put("recommendedActions", r.recommendedActions())
        .put("createdAt", r.createdAt().toString())
        .put("updatedAt", r.updatedAt().toString());
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
