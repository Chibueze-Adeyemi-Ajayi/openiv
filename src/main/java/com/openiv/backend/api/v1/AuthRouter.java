package com.openiv.backend.api.v1;

import com.openiv.backend.auth.handler.AuthHandlers;
import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.service.AuthService;
import com.openiv.backend.customers.CustomerService;
import io.vertx.core.Vertx;
import io.vertx.ext.web.Router;

/**
 * Auth / onboarding routes. Mounted under {@code /api/v1/auth}.
 *
 * <p>Public endpoints (no session required): {@code invite/verify}, {@code login},
 * {@code password/reset/request}, {@code password/reset/confirm}.
 *
 * <p>Session-required endpoints: everything else. The {@link SessionAuthHandler} middleware
 * reads the Bearer token; the service layer decides whether the session's <i>state</i> is
 * valid for the operation.
 */
public final class AuthRouter {

  private AuthRouter() {}

  public static Router create(Vertx vertx, AuthService authService, boolean productionCookies,
      CustomerService customerService) {
    AuthHandlers handlers = new AuthHandlers(authService, productionCookies, customerService);
    Router router = Router.router(vertx);

    // Public
    router.post("/invite/verify").handler(handlers.verifyInvite());
    router.post("/login").handler(handlers.login());
    router.post("/session/transfer").handler(handlers.transferSession());
    router.post("/password/reset/request").handler(handlers.requestPasswordReset());
    router.post("/password/reset/verify").handler(handlers.verifyPasswordResetCode());
    router.post("/password/reset/confirm").handler(handlers.confirmPasswordReset());

    // Session required (any state)
    router.post("/email/resend").handler(SessionAuthHandler.any(authService))
        .handler(handlers.resendEmail());
    router.post("/email/verify").handler(SessionAuthHandler.any(authService))
        .handler(handlers.verifyEmail());
    router.post("/totp/enroll").handler(SessionAuthHandler.any(authService))
        .handler(handlers.enrollTotp());
    router.post("/totp/verify").handler(SessionAuthHandler.any(authService))
        .handler(handlers.verifyTotp());
    router.get("/session").handler(SessionAuthHandler.any(authService))
        .handler(handlers.session());
    router.post("/logout").handler(SessionAuthHandler.any(authService))
        .handler(handlers.logout());

    // Authenticated session required
    router.post("/devices/block").handler(SessionAuthHandler.authenticated(authService))
        .handler(handlers.blockDevice());
    router.post("/totp/step-up").handler(SessionAuthHandler.authenticated(authService))
        .handler(handlers.verifyTotpStepUp());
    router.post("/totp/step-up-lockout").handler(SessionAuthHandler.authenticated(authService))
        .handler(handlers.stepUpLockoutAlert());
    router.post("/password/change").handler(SessionAuthHandler.authenticated(authService))
        .handler(handlers.changePassword());

    return router;
  }
}
