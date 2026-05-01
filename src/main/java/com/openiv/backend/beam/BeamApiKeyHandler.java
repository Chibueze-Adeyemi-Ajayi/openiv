package com.openiv.backend.beam;

import io.vertx.core.Handler;
import io.vertx.ext.web.RoutingContext;

public final class BeamApiKeyHandler {

  public static final String INSTITUTION_ID_KEY = "beam.institutionId";
  public static final String SESSION_KEY = "auth.session";

  private final BeamService service;
  private final com.openiv.backend.auth.service.AuthService authService;

  public BeamApiKeyHandler(BeamService service, com.openiv.backend.auth.service.AuthService authService) {
    this.service = service;
    this.authService = authService;
  }

  public Handler<RoutingContext> resolve() {
    return ctx -> {
      String auth = ctx.request().getHeader("Authorization");
      if (auth != null && auth.startsWith("Bearer ")) {
        String key = auth.substring(7).strip();
        service.resolveInstitution(key)
            .onSuccess(institutionId -> {
              ctx.put(INSTITUTION_ID_KEY, institutionId);
              ctx.next();
            })
            .onFailure(err -> {
              ctx.response().setStatusCode(401).putHeader("content-type", "application/json; charset=utf-8")
                  .end("{\"error\":\"invalid_api_key\"}");
            });
        return;
      }

      // Fallback to session auth for dashboard simulation
      String token = com.openiv.backend.auth.handler.SessionCookie.read(ctx);
      if (token != null && !token.isEmpty()) {
        authService.resolve(token)
            .compose(session -> {
              ctx.put(SESSION_KEY, session);
              return service.resolveInstitution(session);
            })
            .onSuccess(institutionId -> {
              ctx.put(INSTITUTION_ID_KEY, institutionId);
              ctx.next();
            })
            .onFailure(err -> {
               ctx.response().setStatusCode(401).putHeader("content-type", "application/json; charset=utf-8")
                  .end("{\"error\":\"invalid_session_or_user\"}");
            });
        return;
      }

      ctx.response().setStatusCode(401).putHeader("content-type", "application/json; charset=utf-8")
          .end("{\"error\":\"missing_api_key_or_session\"}");
    };
  }
}
