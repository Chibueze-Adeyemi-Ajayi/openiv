package com.openiv.backend.beam;

import io.vertx.core.Handler;
import io.vertx.ext.web.RoutingContext;

public final class BeamApiKeyHandler {

  public static final String INSTITUTION_ID_KEY = "beam.institutionId";

  private final BeamService service;

  public BeamApiKeyHandler(BeamService service) {
    this.service = service;
  }

  public Handler<RoutingContext> resolve() {
    return ctx -> {
      String auth = ctx.request().getHeader("Authorization");
      if (auth == null || !auth.startsWith("Bearer ")) {
        ctx.response().setStatusCode(401).putHeader("content-type", "application/json; charset=utf-8")
            .end("{\"error\":\"missing_api_key\"}");
        return;
      }
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
    };
  }
}
