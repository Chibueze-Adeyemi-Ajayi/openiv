package com.openiv.backend.kyc;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.billing.BillingService;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class KycHandlers {

  private final KycService     service;
  private final BillingService billing;

  public KycHandlers(KycService service, BillingService billing) {
    this.service = service;
    this.billing = billing;
  }

  // GET /kyc/config
  public Handler<RoutingContext> getConfig() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.getConfig(session)
          .onSuccess(opt -> ok(ctx, new JsonObject()
              .put("config", opt.map(KycHandlers::configJson).orElse(null))))
          .onFailure(ctx::fail);
    };
  }

  // PUT /kyc/config
  public Handler<RoutingContext> saveConfig() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;
      String  lookupUrl      = body.getString("lookupUrl");
      String  lookupApiKey   = body.getString("lookupApiKey");
      Integer lookupTimeout  = body.getInteger("lookupTimeout");
      String  listenerUrl    = body.getString("listenerUrl");
      String  listenerApiKey = body.getString("listenerApiKey");
      service.saveConfig(session, lookupUrl, lookupApiKey, lookupTimeout, listenerUrl, listenerApiKey)
          .onSuccess(cfg -> ok(ctx, new JsonObject().put("config", configJson(cfg))))
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException) badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // POST /kyc/lookup
  public Handler<RoutingContext> lookup() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;
      String  customerRef   = body.getString("customerRef");
      String  triggerSource = body.getString("triggerSource");
      boolean openCase      = Boolean.TRUE.equals(body.getBoolean("openCase"));
      if (customerRef == null || customerRef.isBlank()) { badRequest(ctx, "customerRef is required"); return; }
      service.lookup(session, customerRef, triggerSource, openCase)
          .onSuccess(result -> {
            billing.chargeKycLookupAsync(session, customerRef);
            ok(ctx, result);
          })
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException || err instanceof IllegalStateException)
              badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // GET /kyc/logs
  public Handler<RoutingContext> listLogs() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.listLogs(session)
          .onSuccess(logs -> {
            var arr = new JsonArray();
            logs.forEach(l -> arr.add(logJson(l)));
            ok(ctx, new JsonObject().put("logs", arr));
          })
          .onFailure(ctx::fail);
    };
  }

  // ── JSON serialisers ──────────────────────────────────────────────────────

  private static JsonObject configJson(KycConfig c) {
    return new JsonObject()
        .put("lookupUrl",        c.lookupUrl())
        .put("hasLookupApiKey",  c.lookupApiKey() != null && !c.lookupApiKey().isBlank())
        .put("lookupTimeout",    c.lookupTimeout())
        .put("listenerUrl",      c.listenerUrl())
        .put("hasListenerApiKey", c.listenerApiKey() != null && !c.listenerApiKey().isBlank())
        .put("updatedAt",        c.updatedAt().toString());
  }

  private static JsonObject logJson(KycLookupLog l) {
    return new JsonObject()
        .put("id",            l.id())
        .put("customerRef",   l.customerRef())
        .put("triggerSource", l.triggerSource())
        .put("status",        l.status())
        .put("responseCode",  l.responseCode())
        .put("durationMs",    l.durationMs())
        .put("kycTier",       l.kycTier())
        .put("kycStatus",     l.kycStatus())
        .put("errorMessage",  l.errorMessage())
        .put("performedAt",   l.performedAt().toString());
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
