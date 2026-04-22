package com.openiv.backend.api.health;

import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;

import java.time.Instant;

public final class HealthHandler {

  private HealthHandler() {}

  public static void mount(Router router) {
    router.get("/healthz").handler(HealthHandler::live);
    router.get("/readyz").handler(HealthHandler::ready);
  }

  private static void live(RoutingContext ctx) {
    respond(ctx, "alive");
  }

  private static void ready(RoutingContext ctx) {
    respond(ctx, "ready");
  }

  private static void respond(RoutingContext ctx, String status) {
    JsonObject body = new JsonObject()
        .put("status", status)
        .put("timestamp", Instant.now().toString());
    ctx.response()
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }
}
