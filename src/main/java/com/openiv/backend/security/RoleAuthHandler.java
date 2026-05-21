package com.openiv.backend.security;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.repository.UserRepository;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

/**
 * Role-based access control handler.
 *
 * <p>Must run AFTER a {@link SessionAuthHandler} handler so that the session is already
 * attached to the context. Resolves the user's role from the database and rejects with
 * 403 if the role does not have the required permission.
 */
public final class RoleAuthHandler {

  private RoleAuthHandler() {}

  /**
   * Returns a handler that allows the request only if the authenticated user's role
   * has {@code permission}.
   */
  public static Handler<RoutingContext> require(UserRepository users, Permission permission) {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      users.findById(session.userId())
          .onFailure(ctx::fail)
          .onSuccess(opt -> {
            if (opt.isEmpty()) {
              forbidden(ctx, "user_not_found");
              return;
            }
            String role = opt.get().role();
            if (!RolePermissions.has(role, permission)) {
              forbidden(ctx, "insufficient_role");
            } else {
              ctx.next();
            }
          });
    };
  }

  /**
   * Returns a handler that allows the request if the user has ANY of the given permissions.
   */
  public static Handler<RoutingContext> requireAny(UserRepository users, Permission... permissions) {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      users.findById(session.userId())
          .onFailure(ctx::fail)
          .onSuccess(opt -> {
            if (opt.isEmpty()) {
              forbidden(ctx, "user_not_found");
              return;
            }
            String role = opt.get().role();
            if (!RolePermissions.hasAny(role, permissions)) {
              forbidden(ctx, "insufficient_role");
            } else {
              ctx.next();
            }
          });
    };
  }

  private static void forbidden(RoutingContext ctx, String reason) {
    ctx.response()
        .setStatusCode(403)
        .putHeader("Content-Type", "application/json; charset=utf-8")
        .end(new JsonObject()
            .put("error", "forbidden")
            .put("reason", reason)
            .put("correlationId", RequestId.of(ctx))
            .encode());
  }
}
