package com.openiv.backend.auth.handler;

import com.openiv.backend.auth.model.AccountType;
import com.openiv.backend.auth.service.AccessRequestService;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.security.AuditLog;
import com.openiv.backend.security.RequestId;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

/**
 * Public HTTP surface for self-service institution onboarding requests.
 */
public final class AccessRequestHandlers {

  private final AccessRequestService service;

  public AccessRequestHandlers(AccessRequestService service) {
    this.service = service;
  }

  public Handler<RoutingContext> submit() {
    return ctx -> {
      JsonObject body;
      try {
        body = ctx.body().asJsonObject();
        if (body == null) { badRequest(ctx, "invalid_body"); return; }
      } catch (Exception e) {
        badRequest(ctx, "invalid_json");
        return;
      }

      AccountType type;
      try {
        String raw = body.getString("institutionType");
        type = raw == null ? null : AccountType.fromDb(raw);
      } catch (IllegalArgumentException e) {
        badRequest(ctx, "invalid_institutionType");
        return;
      }

      AccessRequestService.SubmitInput input = new AccessRequestService.SubmitInput(
          body.getString("institutionName"),
          type,
          body.getString("contactName"),
          body.getString("contactEmail"),
          body.getString("contactPhone"),
          body.getString("description"));

      service.submit(input)
          .onSuccess(req -> {
            AuditLog.securityException(ctx, "access_request_submitted",
                "id=" + req.id() + " email=" + req.contactEmail());
            ctx.response()
                .setStatusCode(201)
                .putHeader("content-type", "application/json; charset=utf-8")
                .end(new JsonObject()
                    .put("id", req.id())
                    .put("status", req.status())
                    .encode());
          })
          .onFailure(err -> {
            if (err instanceof AuthException ae) {
              int status = ae.detail() != null && ae.detail().startsWith("rate_limited") ? 429 : 400;
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
          });
    };
  }

  private static void badRequest(RoutingContext ctx, String error) {
    ctx.response()
        .setStatusCode(400)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(new JsonObject()
            .put("error", error)
            .put("correlationId", RequestId.of(ctx))
            .encode());
  }
}
