package com.openiv.backend.security;

import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

/**
 * Auth gate placeholder. Until a concrete auth model is chosen (JWT+OIDC, mTLS, or both),
 * this handler refuses every protected request.
 *
 * <p>Wire-in sites:
 * <ul>
 *   <li><b>JWT / OIDC</b> — replace the body with {@code JWTAuthHandler.create(provider)} from
 *       {@code vertx-auth-jwt}. Verify audience, issuer, {@code exp}, and attach the principal
 *       to the routing context.</li>
 *   <li><b>mTLS</b> — enable client cert verification on the HTTP server, then here pull the
 *       peer cert, validate against a service trust store, and attach the service identity.</li>
 *   <li><b>Both</b> — chain: require mTLS at the edge, JWT as the user principal.</li>
 * </ul>
 *
 * <p>Either way: on success, call {@link AuditLog#authSuccess} and set the principal; on
 * failure, call {@link AuditLog#authFailure} and return 401.
 */
public final class RequireAuth {

  private RequireAuth() {}

  public static Handler<RoutingContext> notImplemented() {
    return ctx -> {
      AuditLog.authFailure(ctx, "auth_not_configured");
      ctx.response()
          .setStatusCode(401)
          .putHeader("WWW-Authenticate", "Bearer realm=\"openiv\"")
          .putHeader("content-type", "application/json; charset=utf-8")
          .end(new JsonObject()
              .put("error", "unauthorized")
              .put("correlationId", RequestId.of(ctx))
              .encode());
    };
  }
}
