package com.openiv.backend.auth.handler;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthService;
import com.openiv.backend.security.RequestId;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

/**
 * Two-layer guard for super-admin routes. Register both handlers in sequence:
 * <pre>
 *   router.get("/superadmin/...")
 *       .handler(SuperAdminAuthHandler.session(auth))
 *       .handler(SuperAdminAuthHandler.emailGate(users))
 *       .handler(actualHandler);
 * </pre>
 *
 * <p>Layer 1 ({@link #session}): session must be fully authenticated.
 * <p>Layer 2 ({@link #emailGate}): authenticated user's email must be the super-admin address.
 * Returns 403 on failure so attackers cannot distinguish endpoint existence from authorisation.
 */
public final class SuperAdminAuthHandler {

  public static final String SUPER_ADMIN_EMAIL = "chibuezeadeyemi@gmail.com";

  private SuperAdminAuthHandler() {}

  /** Layer 1 — standard session authentication. */
  public static Handler<RoutingContext> session(AuthService auth) {
    return SessionAuthHandler.authenticated(auth);
  }

  /** Layer 2 — email-based super-admin gate. Must follow {@link #session}. */
  public static Handler<RoutingContext> emailGate(UserRepository users) {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      users.findById(session.userId())
          .onSuccess(opt -> {
            if (opt.isEmpty() || !SUPER_ADMIN_EMAIL.equalsIgnoreCase(opt.get().email())) {
              forbidden(ctx);
              return;
            }
            ctx.next();
          })
          .onFailure(e -> forbidden(ctx));
    };
  }

  private static void forbidden(RoutingContext ctx) {
    ctx.response()
        .setStatusCode(403)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(new JsonObject()
            .put("error", "forbidden")
            .put("correlationId", RequestId.of(ctx))
            .encode());
  }
}
