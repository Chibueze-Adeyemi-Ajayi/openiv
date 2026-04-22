package com.openiv.backend.auth.handler;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.auth.service.AuthService;
import com.openiv.backend.security.AuditLog;
import com.openiv.backend.security.RequestId;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

/**
 * Reads the session token from the {@code openiv_sid} HttpOnly cookie (preferred) or from
 * {@code Authorization: Bearer <token>} (kept as a fallback for API clients / Swagger "Try it").
 * Resolves it to a {@link Session} and attaches it to the routing context at {@link #SESSION_KEY}.
 *
 * <p>Downstream handlers pick which session states they accept.
 */
public final class SessionAuthHandler {

  public static final String SESSION_KEY = "auth.session";
  public static final String HEADER = "Authorization";
  public static final String PREFIX = "Bearer ";

  private SessionAuthHandler() {}

  /** Require *any* valid session (any state). */
  public static Handler<RoutingContext> any(AuthService auth) {
    return resolver(auth, false);
  }

  /** Require a fully-authenticated session. */
  public static Handler<RoutingContext> authenticated(AuthService auth) {
    return resolver(auth, true);
  }

  private static Handler<RoutingContext> resolver(AuthService auth, boolean mustBeAuthenticated) {
    return ctx -> {
      String token = extractToken(ctx);
      if (token == null || token.isEmpty()) {
        unauthorized(ctx, "missing_session");
        return;
      }
      auth.resolve(token)
          .onFailure(err -> unauthorized(ctx, "invalid_session"))
          .onSuccess(session -> {
            if (mustBeAuthenticated
                && session.state() != com.openiv.backend.auth.model.SessionState.AUTHENTICATED) {
              unauthorized(ctx, "wrong_state");
              return;
            }
            ctx.put(SESSION_KEY, session);
            ctx.next();
          });
    };
  }

  private static String extractToken(RoutingContext ctx) {
    String cookie = SessionCookie.read(ctx);
    if (cookie != null && !cookie.isEmpty()) {
      return cookie;
    }
    String header = ctx.request().getHeader(HEADER);
    if (header != null && header.startsWith(PREFIX)) {
      String t = header.substring(PREFIX.length()).trim();
      return t.isEmpty() ? null : t;
    }
    return null;
  }

  public static Session require(RoutingContext ctx) {
    Session s = ctx.get(SESSION_KEY);
    if (s == null) {
      throw AuthException.invalid("session");
    }
    return s;
  }

  private static void unauthorized(RoutingContext ctx, String reason) {
    AuditLog.authFailure(ctx, reason);
    ctx.response()
        .setStatusCode(401)
        .putHeader("WWW-Authenticate", "Bearer realm=\"openiv\"")
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(new JsonObject()
            .put("error", "unauthorized")
            .put("correlationId", RequestId.of(ctx))
            .encode());
  }
}
