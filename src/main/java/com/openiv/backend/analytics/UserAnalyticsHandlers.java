package com.openiv.backend.analytics;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.model.Session;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class UserAnalyticsHandlers {

  private final UserAnalyticsService service;

  public UserAnalyticsHandlers(UserAnalyticsService service) {
    this.service = service;
  }

  public void getUserHeatmap(RoutingContext ctx) {
    Session session = SessionAuthHandler.require(ctx);
    String userId = ctx.pathParam("userId");
    String range = ctx.queryParam("range").stream().findFirst().orElse("90d");
    
    if (userId == null || userId.isBlank()) {
      ctx.response().setStatusCode(400).end("Missing userId");
      return;
    }

    service.getUserHeatmaps(session, userId, range)
        .onSuccess(heatmaps -> {
          JsonObject response = new JsonObject();
          response.put("behavioral", toJsonArray(heatmaps.behavioral()));
          response.put("transactions", toJsonArray(heatmaps.transactions()));
          ctx.response()
              .putHeader("Content-Type", "application/json")
              .end(response.encode());
        })
        .onFailure(err -> {
          ctx.response().setStatusCode(500).end(err.getMessage());
        });
  }

  private JsonArray toJsonArray(double[][] matrix) {
    JsonArray root = new JsonArray();
    for (double[] row : matrix) {
      JsonArray r = new JsonArray();
      for (double v : row) {
        r.add(v);
      }
      root.add(r);
    }
    return root;
  }
}
