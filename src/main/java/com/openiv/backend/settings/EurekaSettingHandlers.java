package com.openiv.backend.settings;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.security.RequestId;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class EurekaSettingHandlers {

  private final UserRepository userRepo;

  public EurekaSettingHandlers(UserRepository userRepo) {
    this.userRepo = userRepo;
  }

  public Handler<RoutingContext> getSetting() {
    return ctx -> {
      long userId = SessionAuthHandler.require(ctx).userId();
      userRepo.findById(userId)
          .onSuccess(opt -> {
            boolean enabled = opt.map(u -> u.eurekaCompanionEnabled()).orElse(true);
            ctx.response()
                .setStatusCode(200)
                .putHeader("content-type", "application/json; charset=utf-8")
                .end(new JsonObject().put("eurekaCompanionEnabled", enabled).encode());
          })
          .onFailure(err -> handleFailure(ctx, err));
    };
  }

  public Handler<RoutingContext> updateSetting() {
    return ctx -> {
      long userId = SessionAuthHandler.require(ctx).userId();
      JsonObject body;
      try {
        body = ctx.body().asJsonObject();
      } catch (Exception e) {
        ctx.response()
            .setStatusCode(400)
            .putHeader("content-type", "application/json; charset=utf-8")
            .end(new JsonObject().put("error", "invalid_body").encode());
        return;
      }
      if (body == null || !body.containsKey("eurekaCompanionEnabled")) {
        ctx.response()
            .setStatusCode(400)
            .putHeader("content-type", "application/json; charset=utf-8")
            .end(new JsonObject().put("error", "missing_field").put("detail", "eurekaCompanionEnabled").encode());
        return;
      }
      boolean enabled = Boolean.TRUE.equals(body.getBoolean("eurekaCompanionEnabled"));
      userRepo.updateEurekaCompanion(userId, enabled)
          .onSuccess(v -> ctx.response()
              .setStatusCode(200)
              .putHeader("content-type", "application/json; charset=utf-8")
              .end(new JsonObject().put("eurekaCompanionEnabled", enabled).encode()))
          .onFailure(err -> handleFailure(ctx, err));
    };
  }

  private static void handleFailure(RoutingContext ctx, Throwable err) {
    if (err instanceof AuthException ae) {
      int status = "session".equals(ae.detail()) ? 401 : 400;
      ctx.response()
          .setStatusCode(status)
          .putHeader("content-type", "application/json; charset=utf-8")
          .end(new JsonObject()
              .put("error", ae.category().name().toLowerCase())
              .put("detail", ae.detail())
              .put("correlationId", RequestId.of(ctx))
              .encode());
      return;
    }
    ctx.fail(err);
  }
}
