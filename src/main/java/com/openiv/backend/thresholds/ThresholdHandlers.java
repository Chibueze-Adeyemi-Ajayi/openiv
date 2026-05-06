package com.openiv.backend.thresholds;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class ThresholdHandlers {

  private final ThresholdService service;

  public ThresholdHandlers(ThresholdService service) {
    this.service = service;
  }

  // GET /thresholds
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

  // GET /thresholds/metrics
  public Handler<RoutingContext> metrics() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.metrics(session)
          .onSuccess(m -> ok(ctx, new JsonObject()
              .put("activeCount", m.activeCount())
              .put("pausedCount", m.pausedCount())
              .put("totalFired",  m.totalFired())))
          .onFailure(ctx::fail);
    };
  }

  // PATCH /thresholds/:id
  public Handler<RoutingContext> update() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id;
      try { id = Long.parseLong(ctx.pathParam("id")); }
      catch (NumberFormatException e) { ctx.fail(400); return; }

      JsonObject body = body(ctx);
      if (body == null) return;

      Long    newThreshold = body.containsKey("threshold") ? body.getLong("threshold") : null;
      Boolean newActive    = body.containsKey("isActive")  ? body.getBoolean("isActive") : null;

      if (newThreshold == null && newActive == null) {
        badRequest(ctx, "provide 'threshold' or 'isActive'"); return;
      }

      service.update(session, id, newThreshold, newActive)
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

  // GET /thresholds/:id/history
  public Handler<RoutingContext> history() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id;
      try { id = Long.parseLong(ctx.pathParam("id")); }
      catch (NumberFormatException e) { ctx.fail(400); return; }

      service.history(session, id)
          .onSuccess(changes -> {
            var arr = new JsonArray();
            changes.forEach(c -> arr.add(changeJson(c)));
            ok(ctx, new JsonObject().put("changes", arr));
          })
          .onFailure(ctx::fail);
    };
  }

  // GET /thresholds/kyc-status
  public Handler<RoutingContext> kycStatus() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.getKycStatus(session)
          .onSuccess(status -> ok(ctx, status))
          .onFailure(ctx::fail);
    };
  }

  // POST /thresholds/kyc-suppress
  public Handler<RoutingContext> suppressKyc() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.suppressKycWarning(session)
          .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
          .onFailure(ctx::fail);
    };
  }

  // GET /thresholds/kyc-tiers
  public Handler<RoutingContext> listKycTiers() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.listKycTierThresholds(session)
          .onSuccess(tiers -> {
            var arr = new JsonArray();
            tiers.forEach(t -> arr.add(tierJson(t)));
            ok(ctx, new JsonObject().put("tiers", arr));
          })
          .onFailure(ctx::fail);
    };
  }

  // PATCH /thresholds/kyc-tiers/:tier
  public Handler<RoutingContext> updateKycTier() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      int tier;
      try { tier = Integer.parseInt(ctx.pathParam("tier")); }
      catch (NumberFormatException e) { ctx.fail(400); return; }

      JsonObject body = body(ctx);
      if (body == null) return;

      String field = body.getString("field");
      Long value   = body.getLong("value");

      if (field == null || value == null) {
        badRequest(ctx, "provide 'field' and 'value'"); return;
      }

      service.updateKycTierThreshold(session, tier, field, value)
          .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException) badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // ── JSON serialisers ──────────────────────────────────────────────────────

  private static JsonObject ruleJson(ThresholdRecord r) {
    return new JsonObject()
        .put("id",             r.id())
        .put("ruleId",         r.ruleId())
        .put("name",           r.name())
        .put("description",    r.description())
        .put("tag",            r.tag())
        .put("thresholdValue", r.thresholdValue())
        .put("unit",           r.unit())
        .put("minValue",       r.minValue())
        .put("maxValue",       r.maxValue())
        .put("stepValue",      r.stepValue())
        .put("isActive",       r.isActive())
        .put("firedCount",     r.firedCount())
        .put("createdAt",      r.createdAt().toString())
        .put("updatedAt",      r.updatedAt().toString());
  }

  private static JsonObject changeJson(ThresholdChange c) {
    return new JsonObject()
        .put("id",            c.id())
        .put("thresholdId",   c.thresholdId())
        .put("changedBy",     c.changedBy())
        .put("changedByName", c.changedByName())
        .put("field",         c.field())
        .put("oldValue",      c.oldValue())
        .put("newValue",      c.newValue())
        .put("createdAt",     c.createdAt().toString());
  }

  private static JsonObject tierJson(KycTierRecord t) {
    return new JsonObject()
        .put("id",                                 t.id())
        .put("kycTier",                            t.kycTier())
        .put("dailyLimitWire",                     t.dailyLimitWire())
        .put("dailyLimitMobile",                   t.dailyLimitMobile())
        .put("dailyLimitUssd",                     t.dailyLimitUssd())
        .put("dailyLimitBdc",                      t.dailyLimitBdc())
        .put("dailyLimitOther",                    t.dailyLimitOther())
        .put("singleTxnLimitWire",                 t.singleTxnLimitWire())
        .put("singleTxnLimitMobile",               t.singleTxnLimitMobile())
        .put("singleTxnLimitUssd",                 t.singleTxnLimitUssd())
        .put("singleTxnLimitBdc",                  t.singleTxnLimitBdc())
        .put("singleTxnLimitOther",                t.singleTxnLimitOther())
        .put("maxTxnsPerHour",                     t.maxTxnsPerHour())
        .put("maxTxnsPerDay",                      t.maxTxnsPerDay())
        .put("riskScoreBoost",                     t.riskScoreBoost())
        .put("requiresAdditionalVerification",     t.requiresAdditionalVerification())
        .put("createdAt",                          t.createdAt().toString())
        .put("updatedAt",                          t.updatedAt().toString());
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
