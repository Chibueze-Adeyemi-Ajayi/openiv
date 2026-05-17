package com.openiv.backend.waitlist;

import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class WaitlistHandlers {

  private final WaitlistService service;

  public WaitlistHandlers(WaitlistService service) { this.service = service; }

  public Handler<RoutingContext> join() {
    return ctx -> {
      JsonObject body;
      try {
        body = ctx.body().asJsonObject();
        if (body == null) { badRequest(ctx, "invalid_body"); return; }
      } catch (Exception e) {
        badRequest(ctx, "invalid_json");
        return;
      }

      service.join(body.getString("name"), body.getString("email"), body.getString("description"))
          .onSuccess(entry ->
              ctx.response()
                  .setStatusCode(201)
                  .putHeader("content-type", "application/json; charset=utf-8")
                  .end(new JsonObject()
                      .put("id",        entry.id())
                      .put("createdAt", entry.createdAt().toString())
                      .encode()))
          .onFailure(err -> {
            String msg = err.getMessage();
            if ("rate_limited".equals(msg)) {
              ctx.response().setStatusCode(429)
                  .putHeader("content-type", "application/json; charset=utf-8")
                  .end(new JsonObject().put("error", "rate_limited").encode());
            } else if (msg != null && msg.startsWith("invalid_")) {
              badRequest(ctx, msg);
            } else {
              ctx.fail(err);
            }
          });
    };
  }

  public Handler<RoutingContext> list() {
    return ctx -> service.listAll()
        .onSuccess(entries -> {
          var arr = new JsonArray();
          entries.forEach(e -> arr.add(new JsonObject()
              .put("id",          e.id())
              .put("name",        e.name())
              .put("email",       e.email())
              .put("description", e.description())
              .put("source",      e.source())
              .put("createdAt",   e.createdAt() != null ? e.createdAt().toString() : null)));
          ctx.response()
              .setStatusCode(200)
              .putHeader("content-type", "application/json; charset=utf-8")
              .end(new JsonObject().put("entries", arr).encode());
        })
        .onFailure(ctx::fail);
  }

  private static void badRequest(RoutingContext ctx, String error) {
    ctx.response().setStatusCode(400)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(new JsonObject().put("error", error).encode());
  }
}
