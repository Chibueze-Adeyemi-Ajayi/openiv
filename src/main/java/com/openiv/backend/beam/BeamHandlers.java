package com.openiv.backend.beam;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class BeamHandlers {

  private final BeamService service;

  public BeamHandlers(BeamService service) {
    this.service = service;
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

  /** POST /beam/kyc/stream — SSE response, one event per pipeline step. */
  public Handler<RoutingContext> ingestKycStream() {
    return ctx -> {
      long institutionId = ctx.get(BeamApiKeyHandler.INSTITUTION_ID_KEY);
      String ct = ctx.request().getHeader("Content-Type");
      JsonObject body = (ct != null && ct.toLowerCase().startsWith("multipart/form-data"))
          ? kycBodyFromMultipart(ctx)
          : body(ctx);
      if (body == null) return;

      String customerId = body.getString("customer_id", body.getString("customerId", "unknown"));

      var resp = ctx.response();
      resp.setChunked(true)
          .putHeader("Content-Type",      "text/event-stream; charset=utf-8")
          .putHeader("Cache-Control",     "no-cache")
          .putHeader("Connection",        "keep-alive")
          .putHeader("X-Accel-Buffering", "no");

      writeSse(resp, "started", new JsonObject()
          .put("customerId", customerId)
          .put("steps", new io.vertx.core.json.JsonArray()
              .add("bvn_nin")
              .add("phone_record_basic").add("phone_record_fraud")
              .add("phone_beam_basic").add("phone_beam_fraud")
              .add("liveness").add("pep_check")));

      String ip        = ctx.request().remoteAddress().hostAddress();
      String userAgent = ctx.request().getHeader("User-Agent");
      int    bytes     = ctx.body().buffer() != null ? ctx.body().buffer().length() : 0;

      service.processKycStream(institutionId, body.encode(), ip, userAgent, bytes,
              stepEvent -> writeSse(resp, "step", stepEvent))
          .onSuccess(res -> {
            writeSse(resp, "result", res.analysis() != null ? res.analysis() : new JsonObject());
            writeSse(resp, "done",   new JsonObject());
            resp.end();
          })
          .onFailure(err -> {
            writeSse(resp, "error", new JsonObject().put("message", err.getMessage()));
            resp.end();
          });
    };
  }

  private static void writeSse(io.vertx.core.http.HttpServerResponse r, String event, JsonObject data) {
    r.write("event: " + event + "\ndata: " + data.encode() + "\n\n");
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

  /** Read a multipart/form-data KYC request into a JsonObject.
   *  Text fields are copied verbatim; the "photo" file part is base64-encoded. */
  private static JsonObject kycBodyFromMultipart(RoutingContext ctx) {
    JsonObject obj = new JsonObject();
    for (String field : new String[]{ "customer_id", "customerId", "name", "bvn", "nin", "phone", "phone_number", "occurred_at" }) {
      String val = ctx.request().getFormAttribute(field);
      if (val != null && !val.isBlank()) obj.put(field, val);
    }
    for (io.vertx.ext.web.FileUpload f : ctx.fileUploads()) {
      if ("photo".equals(f.name())) {
        try {
          byte[] bytes = java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(f.uploadedFileName()));
          obj.put("photo", java.util.Base64.getEncoder().encodeToString(bytes));
        } catch (Exception ignored) {}
      }
    }
    String id = obj.getString("customer_id", obj.getString("customerId"));
    if (id == null || id.isBlank()) { ctx.fail(400); return null; }
    return obj;
  }
}
