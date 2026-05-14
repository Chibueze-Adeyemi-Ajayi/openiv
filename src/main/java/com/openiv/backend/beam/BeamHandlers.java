package com.openiv.backend.beam;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.billing.BillingService;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

public final class BeamHandlers {

  private final BeamService service;
  private final BillingService billing;

  public BeamHandlers(BeamService service, BillingService billing) {
    this.service = service;
    this.billing = billing;
  }

  public Handler<RoutingContext> ingest() {
    return ctx -> {
      long start = System.currentTimeMillis();
      long institutionId = ctx.get(BeamApiKeyHandler.INSTITUTION_ID_KEY);
      String stream = ctx.pathParam("stream");
      JsonObject body = body(ctx);
      if (body == null)
        return;
      String idempotencyKey = ctx.request().getHeader("X-Idempotency-Key");

      // Capture request metadata for network log
      String ip = ctx.request().remoteAddress().hostAddress();
      String userAgent = ctx.request().getHeader("User-Agent");
      int payloadBytes = ctx.body().buffer() != null ? ctx.body().buffer().length() : 0;
      JsonObject headersJson = new JsonObject();
      ctx.request().headers().forEach(h -> {
        if (!"authorization".equalsIgnoreCase(h.getKey())) {
          headersJson.put(h.getKey(), h.getValue());
        }
      });

      service.ingest(institutionId, stream, idempotencyKey, body.encode(),
          ip, userAgent, headersJson.encode(), payloadBytes, (int)(System.currentTimeMillis() - start))
          .onSuccess(res -> {
            billing.chargeBeamIngestAsync(institutionId, "beam_" + res.record().id());

            var response = new JsonObject()
                .put("ok", true)
                .put("record_id", res.record().id())
                .put("stream", res.record().stream())
                .put("status", res.record().status());

            if (res.analysis() != null) {
              response.put("analysis", res.analysis());
            }

            ok(ctx, response);
          })
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException)
              badRequest(ctx, err.getMessage());
            else
              ctx.fail(err);
          });
    };
  }

  public Handler<RoutingContext> listRecords() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String stream = ctx.request().getParam("stream");
      String q = ctx.request().getParam("q");
      String range = ctx.request().getParam("range");
      String pageStr = ctx.request().getParam("page");
      String pageSizeStr = ctx.request().getParam("pageSize");
      
      int page = pageStr != null ? Integer.parseInt(pageStr) : 1;
      int pageSize = pageSizeStr != null ? Integer.parseInt(pageSizeStr) : 20;

      service.listRecords(session, stream, q, range, page, pageSize)
          .onSuccess(res -> {
            var arr = new JsonArray();
            res.records().forEach(r -> arr.add(recordJson(r)));
            ok(ctx, new JsonObject().put("records", arr).put("total", res.total()));
          })
          .onFailure(ctx::fail);
    };
  }

  public Handler<RoutingContext> getApiKeyInfo() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.getApiKeyInfo(session)
          .onSuccess(opt -> ok(ctx, new JsonObject()
              .put("key", opt.map(BeamHandlers::apiKeyJson).orElse(null))))
          .onFailure(ctx::fail);
    };
  }

  public Handler<RoutingContext> generateApiKey() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.generateApiKey(session)
          .onSuccess(key -> ok(ctx, new JsonObject().put("apiKey", key)))
          .onFailure(ctx::fail);
    };
  }

  public Handler<RoutingContext> revokeApiKey() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.revokeApiKey(session)
          .onSuccess(deleted -> ok(ctx, new JsonObject().put("ok", true)))
          .onFailure(ctx::fail);
    };
  }

  private static JsonObject recordJson(BeamRecord r) {
    return new JsonObject()
        .put("id", r.id())
        .put("institutionId", r.institutionId())
        .put("stream", r.stream())
        .put("idempotencyKey", r.idempotencyKey())
        .put("payload", r.payload())
        .put("status", r.status())
        .put("receivedAt", r.receivedAt().toString())
        .put("occurredAt", r.occurredAt() != null ? r.occurredAt().toString() : null)
        .put("durationMs", r.durationMs())
        .put("bytes", r.bytes())
        .put("ip", r.ip())
        .put("userAgent", r.userAgent());
  }

  private static JsonObject apiKeyJson(BeamApiKey k) {
    return new JsonObject()
        .put("prefix", k.prefix())
        .put("createdAt", k.createdAt().toString())
        .put("lastUsedAt", k.lastUsedAt() != null ? k.lastUsedAt().toString() : null);
  }

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
      if (b == null) {
        ctx.fail(400);
        return null;
      }
      return b;
    } catch (Exception e) {
      ctx.fail(400);
      return null;
    }
  }
}
