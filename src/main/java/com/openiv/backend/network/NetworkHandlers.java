package com.openiv.backend.network;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.time.OffsetDateTime;

public final class NetworkHandlers {

  private final NetworkService service;

  public NetworkHandlers(NetworkService service) {
    this.service = service;
  }

  public Handler<RoutingContext> listLogs() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);

      String source      = blankToNull(ctx.request().getParam("source"));
      String statusClass = blankToNull(ctx.request().getParam("status"));
      String sinceStr    = blankToNull(ctx.request().getParam("since"));
      String q           = blankToNull(ctx.request().getParam("q"));
      int    limit       = parseIntParam(ctx.request().getParam("limit"),  200);
      int    offset      = parseIntParam(ctx.request().getParam("offset"),   0);

      OffsetDateTime since = null;
      if (sinceStr != null) {
        try { since = OffsetDateTime.parse(sinceStr); } catch (Exception ignored) {}
      }

      NetworkFilter filter = new NetworkFilter(source, statusClass, since, q, limit, offset);

      service.listLogs(session, filter)
          .onSuccess(entries -> {
            var arr = new JsonArray();
            entries.forEach(e -> arr.add(entryJson(e)));
            ctx.response()
                .setStatusCode(200)
                .putHeader("content-type", "application/json; charset=utf-8")
                .end(new JsonObject()
                    .put("entries", arr)
                    .put("total", arr.size())
                    .encode());
          })
          .onFailure(ctx::fail);
    };
  }

  private static JsonObject entryJson(NetworkEntry e) {
    return new JsonObject()
        .put("id",           e.id())
        .put("source",       e.source())
        .put("method",       e.method())
        .put("endpoint",     e.endpoint())
        .put("stream",       e.stream())
        .put("statusCode",   e.statusCode())
        .put("durationMs",   e.durationMs())
        .put("bytes",        e.bytes())
        .put("ip",           e.ip())
        .put("reqHeaders",   e.reqHeaders())
        .put("reqBody",      e.reqBody())
        .put("resHeaders",   e.resHeaders())
        .put("resBody",      e.resBody())
        .put("errorMessage", e.errorMessage())
        .put("ts",           e.ts().toString());
  }

  private static int parseIntParam(String s, int def) {
    if (s == null) return def;
    try { return Integer.parseInt(s); } catch (NumberFormatException e) { return def; }
  }

  private static String blankToNull(String s) {
    return (s == null || s.isBlank()) ? null : s;
  }
}
