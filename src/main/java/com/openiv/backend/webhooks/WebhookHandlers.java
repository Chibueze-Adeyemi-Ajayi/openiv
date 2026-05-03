package com.openiv.backend.webhooks;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.service.AuthService;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

public final class WebhookHandlers {

  private static final Logger log = LoggerFactory.getLogger(WebhookHandlers.class);
  private final WebhookService service;
  private final AuthService authService;

  public WebhookHandlers(WebhookService service, AuthService authService) {
    this.service = service;
    this.authService = authService;
  }

  // GET /webhooks/secret
  public Handler<RoutingContext> getSecret() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.getSecret(session)
          .onSuccess(s -> ok(ctx, new JsonObject().put("secret", secretJson(s))))
          .onFailure(ctx::fail);
    };
  }

  // POST /webhooks/secret/rotate
  public Handler<RoutingContext> rotateSecret() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;
      String totpCode = body.getString("totpCode");
      if (totpCode == null || totpCode.isBlank()) {
        badRequest(ctx, "TOTP code required for webhook operations");
        return;
      }
      authService.verifyTotpStepUp(session, totpCode)
          .compose(v -> service.rotateSecret(session))
          .onSuccess(s -> ok(ctx, new JsonObject().put("secret", secretJson(s))))
          .onFailure(err -> {
            if (err.getMessage() != null && err.getMessage().contains("totp")) {
              badRequest(ctx, "Invalid TOTP code");
            } else {
              ctx.fail(err);
            }
          });
    };
  }

  // PATCH /webhooks/secret
  public Handler<RoutingContext> updateSecret() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;
      if (!body.containsKey("autoRotate")) { badRequest(ctx, "autoRotate required"); return; }
      String totpCode = body.getString("totpCode");
      if (totpCode == null || totpCode.isBlank()) {
        badRequest(ctx, "TOTP code required for webhook operations");
        return;
      }
      boolean autoRotate = body.getBoolean("autoRotate", true);
      authService.verifyTotpStepUp(session, totpCode)
          .compose(v -> service.updateAutoRotate(session, autoRotate))
          .onSuccess(s -> ok(ctx, new JsonObject().put("secret", secretJson(s))))
          .onFailure(err -> {
            if (err.getMessage() != null && err.getMessage().contains("totp")) {
              badRequest(ctx, "Invalid TOTP code");
            } else {
              ctx.fail(err);
            }
          });
    };
  }

  // GET /webhooks
  public Handler<RoutingContext> listEndpoints() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.listEndpoints(session)
          .onSuccess(endpoints -> {
            var arr = new JsonArray();
            endpoints.forEach(e -> arr.add(endpointJson(e)));
            ok(ctx, new JsonObject().put("endpoints", arr));
          })
          .onFailure(ctx::fail);
    };
  }

  // POST /webhooks
  public Handler<RoutingContext> createEndpoint() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;
      String url         = body.getString("url");
      String description = body.getString("description");
      String totpCode    = body.getString("totpCode");
      JsonArray evArr    = body.getJsonArray("events");
      if (url == null || url.isBlank())         { badRequest(ctx, "url is required"); return; }
      if (evArr == null || evArr.isEmpty())     { badRequest(ctx, "events required"); return; }
      if (totpCode == null || totpCode.isBlank()) { badRequest(ctx, "TOTP code required for webhook operations"); return; }
      List<String> events = new ArrayList<>();
      evArr.forEach(o -> events.add(o.toString()));
      authService.verifyTotpStepUp(session, totpCode)
          .compose(v -> service.createEndpoint(session, url, description, events))
          .onSuccess(ep -> ok(ctx, new JsonObject().put("endpoint", endpointJson(ep))))
          .onFailure(err -> {
            if (err.getMessage() != null && err.getMessage().contains("totp")) {
              badRequest(ctx, "Invalid TOTP code");
            } else if (err instanceof IllegalArgumentException) {
              badRequest(ctx, err.getMessage());
            } else {
              ctx.fail(err);
            }
          });
    };
  }

  // PATCH /webhooks/:id
  public Handler<RoutingContext> updateEndpoint() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = longPath(ctx, "id");
      if (id < 0) return;
      JsonObject body = body(ctx);
      if (body == null) return;
      String totpCode = body.getString("totpCode");
      if (totpCode == null || totpCode.isBlank()) {
        badRequest(ctx, "TOTP code required for webhook operations");
        return;
      }
      String     status      = body.getString("status");
      String     description = body.getString("description");
      JsonArray  evArr       = body.getJsonArray("events");
      List<String> events    = evArr == null ? null : evArr.stream().map(Object::toString).toList();
      authService.verifyTotpStepUp(session, totpCode)
          .compose(v -> service.updateEndpoint(session, id, status, events, description))
          .onSuccess(opt -> {
            if (opt.isEmpty()) { ctx.fail(404); return; }
            ok(ctx, new JsonObject().put("endpoint", endpointJson(opt.get())));
          })
          .onFailure(err -> {
            if (err.getMessage() != null && err.getMessage().contains("totp")) {
              badRequest(ctx, "Invalid TOTP code");
            } else if (err instanceof IllegalArgumentException) {
              badRequest(ctx, err.getMessage());
            } else {
              ctx.fail(err);
            }
          });
    };
  }

  // DELETE /webhooks/:id
  public Handler<RoutingContext> deleteEndpoint() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = longPath(ctx, "id");
      if (id < 0) return;
      JsonObject body = body(ctx);
      if (body == null) return;
      String totpCode = body.getString("totpCode");
      if (totpCode == null || totpCode.isBlank()) {
        badRequest(ctx, "TOTP code required for webhook operations");
        return;
      }
      authService.verifyTotpStepUp(session, totpCode)
          .compose(v -> service.deleteEndpoint(session, id))
          .onSuccess(deleted -> {
            if (!deleted) { ctx.fail(404); return; }
            ok(ctx, new JsonObject().put("ok", true));
          })
          .onFailure(err -> {
            if (err.getMessage() != null && err.getMessage().contains("totp")) {
              badRequest(ctx, "Invalid TOTP code");
            } else {
              ctx.fail(err);
            }
          });
    };
  }

  // POST /webhooks/verify
  public Handler<RoutingContext> verifyEndpoint() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;
      String url  = body.getString("url");
      String type = body.getString("type", "notification");
      if (url == null || url.isBlank()) { badRequest(ctx, "url is required"); return; }
      service.verifyEndpoint(session, url, type)
          .onSuccess(result -> ok(ctx, result))
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException) badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // POST /webhooks/:id/test
  public Handler<RoutingContext> testEndpoint() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = longPath(ctx, "id");
      if (id < 0) return;
      service.sendTestEvent(session, id)
          .onSuccess(result -> ok(ctx, new JsonObject()
              .put("ok",        true)
              .put("delivery",  deliveryJson(result.delivery()))
              .put("payload",   new JsonObject(result.payload()))
              .put("signature", result.signature())))
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException) badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // GET /webhooks/:id/deliveries
  public Handler<RoutingContext> listDeliveries() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = longPath(ctx, "id");
      if (id < 0) return;
      service.listDeliveries(session, id)
          .onSuccess(list -> {
            var arr = new JsonArray();
            list.forEach(d -> arr.add(deliveryJson(d)));
            ok(ctx, new JsonObject().put("deliveries", arr));
          })
          .onFailure(ctx::fail);
    };
  }

  // GET /webhooks/deliveries  (institution-wide beam log)
  public Handler<RoutingContext> listAllDeliveries() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.listAllDeliveries(session)
          .onSuccess(list -> {
            var arr = new JsonArray();
            list.forEach(d -> arr.add(deliveryJson(d)));
            ok(ctx, new JsonObject().put("deliveries", arr));
          })
          .onFailure(ctx::fail);
    };
  }

  // GET /webhooks/:id/security
  public Handler<RoutingContext> getSecurityRule() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = longPath(ctx, "id");
      if (id < 0) return;
      service.getSecurityRule(session, id)
          .onSuccess(opt -> ok(ctx, new JsonObject()
              .put("rule", opt.map(WebhookHandlers::securityRuleJson).orElse(null))))
          .onFailure(ctx::fail);
    };
  }

  // PUT /webhooks/:id/security
  public Handler<RoutingContext> upsertSecurityRule() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = longPath(ctx, "id");
      if (id < 0) return;
      JsonObject body = body(ctx);
      if (body == null) return;
      String  apiKey         = body.getString("apiKey");
      String  ipAllowlist    = body.getString("ipAllowlist");
      int     timeoutSeconds = body.getInteger("timeoutSeconds", 10);
      int     maxRetries     = body.getInteger("maxRetries", 3);
      boolean requireAck     = body.getBoolean("requireAck", false);
      service.upsertSecurityRule(session, id, apiKey, ipAllowlist, timeoutSeconds, maxRetries, requireAck)
          .onSuccess(rule -> ok(ctx, new JsonObject().put("rule", securityRuleJson(rule))))
          .onFailure(ctx::fail);
    };
  }

  // POST /webhooks/:id/security/api-key  (generate fresh API key)
  public Handler<RoutingContext> generateApiKey() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = longPath(ctx, "id");
      if (id < 0) return;
      service.generateApiKey(session, id)
          .onSuccess(key -> ok(ctx, new JsonObject().put("apiKey", key)))
          .onFailure(ctx::fail);
    };
  }

  // ── JSON serialisers ──────────────────────────────────────────────────────

  private static JsonObject secretJson(WebhookSecret s) {
    return new JsonObject()
        .put("id",           s.id())
        .put("secret",       s.secret())
        .put("autoRotate",   s.autoRotate())
        .put("nextRotation", s.nextRotation().toString())
        .put("updatedAt",    s.updatedAt().toString());
  }

  private static JsonObject endpointJson(WebhookEndpoint e) {
    var evArr = new JsonArray();
    e.events().forEach(evArr::add);
    return new JsonObject()
        .put("id",              e.id())
        .put("url",             e.url())
        .put("description",     e.description())
        .put("events",          evArr)
        .put("status",          e.status())
        .put("successCount",    e.successCount())
        .put("failureCount",    e.failureCount())
        .put("lastDeliveredAt", e.lastDeliveredAt() != null ? e.lastDeliveredAt().toString() : null)
        .put("createdAt",       e.createdAt().toString())
        .put("updatedAt",       e.updatedAt().toString());
  }

  static JsonObject deliveryJson(WebhookDelivery d) {
    return new JsonObject()
        .put("id",              d.id())
        .put("endpointId",      d.endpointId())
        .put("eventType",       d.eventType())
        .put("status",          d.status())
        .put("responseCode",    d.responseCode())
        .put("attemptCount",    d.attemptCount())
        .put("deliveredAt",     d.deliveredAt() != null ? d.deliveredAt().toString() : null)
        .put("createdAt",       d.createdAt().toString())
        .put("deliveryId",      d.deliveryId())
        .put("requestHeaders",  d.requestHeaders())
        .put("requestBody",     d.requestBody())
        .put("responseHeaders", d.responseHeaders())
        .put("responseBody",    d.responseBody())
        .put("durationMs",      d.durationMs())
        .put("errorMessage",    d.errorMessage());
  }

  private static JsonObject securityRuleJson(WebhookSecurityRule r) {
    return new JsonObject()
        .put("id",             r.id())
        .put("endpointId",     r.endpointId())
        .put("hasApiKey",      r.apiKey() != null && !r.apiKey().isBlank())
        .put("ipAllowlist",    r.ipAllowlist())
        .put("timeoutSeconds", r.timeoutSeconds())
        .put("maxRetries",     r.maxRetries())
        .put("requireAck",     r.requireAck())
        .put("updatedAt",      r.updatedAt().toString());
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

  private static long longPath(RoutingContext ctx, String key) {
    try { return Long.parseLong(ctx.pathParam(key)); }
    catch (NumberFormatException e) { ctx.fail(400); return -1; }
  }
}
