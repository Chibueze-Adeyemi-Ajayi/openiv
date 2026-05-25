package com.openiv.backend.billing;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthService;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

/**
 * Middleware that blocks access for institutions with an expired subscription.
 * Place after the session auth handler on any route that should be gated.
 */
public final class SubscriptionBlockGuard implements Handler<RoutingContext> {

  private final SubscriptionRepository subscriptions;
  private final UserRepository         users;
  @SuppressWarnings("unused")
  private final AuthService            authService;

  public SubscriptionBlockGuard(
      SubscriptionRepository subscriptions,
      UserRepository users,
      AuthService authService) {
    this.subscriptions = subscriptions;
    this.users         = users;
    this.authService   = authService;
  }

  @Override
  public void handle(RoutingContext ctx) {
    var session = ctx.get(SessionAuthHandler.SESSION_KEY);
    if (session == null) {
      ctx.next();
      return;
    }
    com.openiv.backend.auth.model.Session s =
        (com.openiv.backend.auth.model.Session) session;

    users.findById(s.userId())
        .onSuccess(userOpt -> {
          if (userOpt.isEmpty()) { ctx.next(); return; }
          long institutionId = userOpt.get().institutionId();
          subscriptions.isBlocked(institutionId)
              .onSuccess(blocked -> {
                if (blocked) {
                  ctx.response()
                      .setStatusCode(402)
                      .putHeader("Content-Type", "application/json")
                      .end(new JsonObject()
                          .put("error", "account_suspended")
                          .put("message", "Your subscription has expired. Renew to restore access.")
                          .encode());
                } else {
                  ctx.next();
                }
              })
              .onFailure(err -> ctx.next()); // fail open — don't block on DB error
        })
        .onFailure(err -> ctx.next());
  }
}
