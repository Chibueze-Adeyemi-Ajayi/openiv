package com.openiv.backend.alerts;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.repository.UserRepository;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.time.OffsetDateTime;

public final class InstitutionAlertHandlers {

  private final InstitutionAlertRepository repo;
  private final UserRepository             users;

  public InstitutionAlertHandlers(InstitutionAlertRepository repo, UserRepository users) {
    this.repo  = repo;
    this.users = users;
  }

  // GET /institution-alerts
  public Handler<RoutingContext> list() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      users.findById(session.userId()).compose(opt -> {
        if (opt.isEmpty()) { ctx.response().setStatusCode(401).end(); return io.vertx.core.Future.succeededFuture(); }
        return repo.listByInstitution(opt.get().institutionId())
            .onSuccess(alerts -> {
              JsonArray arr = new JsonArray();
              for (InstitutionAlert a : alerts) arr.add(toJson(a));
              ok(ctx, new JsonObject().put("alerts", arr));
            });
      }).onFailure(ctx::fail);
    };
  }

  // PATCH /institution-alerts/:id/status
  public Handler<RoutingContext> updateStatus() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id;
      try { id = Long.parseLong(ctx.pathParam("id")); }
      catch (NumberFormatException e) { ctx.fail(400); return; }

      JsonObject body;
      try { body = ctx.body().asJsonObject(); if (body == null) { ctx.fail(400); return; } }
      catch (Exception e) { ctx.fail(400); return; }

      String status = body.getString("status");
      if (!"investigating".equals(status) && !"resolved".equals(status) && !"open".equals(status)) {
        bad(ctx, "status must be open, investigating, or resolved"); return;
      }

      final long alertId = id;
      users.findById(session.userId()).compose(opt -> {
        if (opt.isEmpty()) { ctx.response().setStatusCode(401).end(); return io.vertx.core.Future.succeededFuture(); }
        return repo.updateStatus(alertId, opt.get().institutionId(), status)
            .onSuccess(alert -> ok(ctx, new JsonObject().put("alert", toJson(alert))));
      }).onFailure(ctx::fail);
    };
  }

  // GET /institution-alerts/:id/investigate
  public Handler<RoutingContext> investigate() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id;
      try { id = Long.parseLong(ctx.pathParam("id")); }
      catch (NumberFormatException e) { ctx.fail(400); return; }

      final long alertId = id;
      users.findById(session.userId()).compose(opt -> {
        if (opt.isEmpty()) { ctx.response().setStatusCode(401).end(); return io.vertx.core.Future.succeededFuture(); }
        long instId = opt.get().institutionId();
        return repo.updateStatus(alertId, instId, "investigating")
            .compose(alert -> repo.investigateAlert(instId)
                .map(suspects -> {
                  JsonArray arr = new JsonArray();
                  for (InstitutionAlertRepository.SuspiciousCustomer c : suspects) arr.add(suspectJson(c));
                  return new JsonObject()
                      .put("alert", toJson(alert))
                      .put("suspects", arr)
                      .put("analysedAt", OffsetDateTime.now().toString());
                }))
            .onSuccess(res -> ok(ctx, res));
      }).onFailure(ctx::fail);
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static JsonObject toJson(InstitutionAlert a) {
    return new JsonObject()
        .put("id", a.id())
        .put("alertType", a.alertType())
        .put("title", a.title())
        .put("message", a.message())
        .put("severity", a.severity())
        .put("status", a.status())
        .put("metadata", a.metadata())
        .put("createdAt", a.createdAt().toString())
        .put("updatedAt", a.updatedAt().toString());
  }

  private static JsonObject suspectJson(InstitutionAlertRepository.SuspiciousCustomer c) {
    return new JsonObject()
        .put("customerId", c.customerId())
        .put("customerName", c.customerName())
        .put("overallRiskScore", c.overallRiskScore())
        .put("txnCount", c.txnCount())
        .put("totalAmount", c.totalAmount())
        .put("avgRiskScore", c.avgRiskScore())
        .put("flaggedCount", c.flaggedCount())
        .put("casedCount", c.casedCount());
  }

  private static void ok(RoutingContext ctx, JsonObject body) {
    ctx.response().setStatusCode(200)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }

  private static void bad(RoutingContext ctx, String msg) {
    ctx.response().setStatusCode(400)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(new JsonObject().put("error", msg).encode());
  }
}
