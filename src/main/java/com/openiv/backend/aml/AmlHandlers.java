package com.openiv.backend.aml;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.cases.CaseService;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class AmlHandlers {

  private final CaseService service;

  public AmlHandlers(CaseService service) {
    this.service = service;
  }

  // GET /aml-settings
  public Handler<RoutingContext> getSettings() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.getAmlSettings(session)
          .onSuccess(opt -> {
            JsonObject res = new JsonObject();
            if (opt.isPresent()) {
              AmlSettings settings = opt.get();
              res.put("settings", new JsonObject()
                  .put("id", settings.id())
                  .put("institutionId", settings.institutionId())
                  .put("autoOpenCase", settings.autoOpenCase())
                  .put("riskScoreFlagThreshold", settings.riskScoreFlagThreshold())
                  .put("riskScoreCaseThreshold", settings.riskScoreCaseThreshold())
                  .put("behRiskScoreFlagThreshold", settings.behRiskScoreFlagThreshold())
                  .put("behRiskScoreCaseThreshold", settings.behRiskScoreCaseThreshold())
                  .put("riskScoreNormalThreshold", settings.riskScoreNormalThreshold())
                  .put("behRiskScoreNormalThreshold", settings.behRiskScoreNormalThreshold()));
            } else {
              res.put("settings", JsonObject.of());
            }
            ok(ctx, res);
          })
          .onFailure(ctx::fail);
    };
  }

  // PUT /aml-settings
  public Handler<RoutingContext> updateSettings() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;

      Boolean autoOpenCase = body.getBoolean("autoOpenCase");
      Integer flagThreshold = body.getInteger("riskScoreFlagThreshold");
      Integer caseThreshold = body.getInteger("riskScoreCaseThreshold");
      Integer behFlagThreshold = body.getInteger("behRiskScoreFlagThreshold");
      Integer behCaseThreshold = body.getInteger("behRiskScoreCaseThreshold");
      Integer normalThreshold = body.getInteger("riskScoreNormalThreshold");
      Integer behNormalThreshold = body.getInteger("behRiskScoreNormalThreshold");

      if (autoOpenCase == null) {
        badRequest(ctx, "autoOpenCase is required");
        return;
      }

      service.updateAmlSettings(session, autoOpenCase, flagThreshold, caseThreshold, behFlagThreshold, behCaseThreshold, normalThreshold, behNormalThreshold)
          .onSuccess(settings -> ok(ctx, settingsJson(settings)))
          .onFailure(ctx::fail);
    };
  }

  // POST /aml-settings/notifications/email
  public Handler<RoutingContext> addNotificationEmail() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;

      String email = body.getString("email");
      if (email == null || email.isBlank()) {
        badRequest(ctx, "email is required");
        return;
      }
      if (!isValidEmail(email)) {
        badRequest(ctx, "invalid email format");
        return;
      }

      service.addCaseNotificationEmail(session, email.trim())
          .onSuccess(settings -> ok(ctx, settingsJson(settings)))
          .onFailure(ctx::fail);
    };
  }

  // DELETE /aml-settings/notifications/email
  public Handler<RoutingContext> removeNotificationEmail() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String email = first(ctx, "email");
      if (email == null || email.isBlank()) {
        badRequest(ctx, "email query parameter is required");
        return;
      }

      service.removeCaseNotificationEmail(session, email.trim())
          .onSuccess(settings -> ok(ctx, settingsJson(settings)))
          .onFailure(ctx::fail);
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static JsonObject settingsJson(AmlSettings settings) {
    JsonObject json = new JsonObject()
        .put("id", settings.id())
        .put("institutionId", settings.institutionId())
        .put("autoOpenCase", settings.autoOpenCase())
        .put("riskScoreFlagThreshold", settings.riskScoreFlagThreshold())
        .put("riskScoreCaseThreshold", settings.riskScoreCaseThreshold())
        .put("behRiskScoreFlagThreshold", settings.behRiskScoreFlagThreshold())
        .put("behRiskScoreCaseThreshold", settings.behRiskScoreCaseThreshold())
        .put("riskScoreNormalThreshold", settings.riskScoreNormalThreshold())
        .put("behRiskScoreNormalThreshold", settings.behRiskScoreNormalThreshold());
    if (settings.caseNotificationEmails() != null) {
      json.put("caseNotificationEmails", settings.caseNotificationEmails());
    }
    return new JsonObject().put("settings", json);
  }

  private static boolean isValidEmail(String email) {
    return email != null && email.contains("@") && email.contains(".") && email.length() > 5;
  }

  private static void ok(RoutingContext ctx, JsonObject body) {
    ctx.response().setStatusCode(200)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }

  private static void badRequest(RoutingContext ctx, String msg) {
    ctx.response().setStatusCode(400)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(new JsonObject().put("error", msg).encode());
  }

  private static JsonObject body(RoutingContext ctx) {
    try {
      JsonObject b = ctx.body().asJsonObject();
      if (b == null) { ctx.fail(400); return null; }
      return b;
    } catch (Exception e) { ctx.fail(400); return null; }
  }

  private static String first(RoutingContext ctx, String key) {
    return ctx.queryParam(key).stream().findFirst().orElse(null);
  }
}
