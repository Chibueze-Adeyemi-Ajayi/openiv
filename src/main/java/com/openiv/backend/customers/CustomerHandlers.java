package com.openiv.backend.customers;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.util.Map;

public final class CustomerHandlers {
  private static final Logger log = LoggerFactory.getLogger(CustomerHandlers.class);
  private final CustomerService service;
  private final UserRepository users;

  public CustomerHandlers(CustomerService service, UserRepository users) {
    this.service = service;
    this.users = users;
  }

  // GET /customers?q=&pageSize=
  public Handler<RoutingContext> listCustomers() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      String q = ctx.queryParam("q").stream().findFirst().orElse(null);
      int pageSize;
      try {
        pageSize = Integer.parseInt(ctx.queryParam("pageSize").stream().findFirst().orElse("30"));
      } catch (NumberFormatException e) {
        pageSize = 30;
      }
      int finalPageSize = pageSize;

      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> AuthException.invalid("session"));
            return service.listCustomers(u.institutionId(), q, finalPageSize);
          })
          .onSuccess(list -> {
            var arr = new io.vertx.core.json.JsonArray();
            list.forEach(c -> arr.add(toJson(c)));
            ctx.response().setStatusCode(200)
                .putHeader("Content-Type", "application/json")
                .end(new JsonObject().put("customers", arr).encode());
          })
          .onFailure(ctx::fail);
    };
  }

  // GET /customers/:id
  public Handler<RoutingContext> getCustomer() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      String externalId = ctx.pathParam("id");

      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> AuthException.invalid("session"));
            return service.getCustomer(u.institutionId(), externalId)
                .map(cOpt -> Map.entry(u.institutionId(), cOpt));
          })
          .onSuccess(entry -> {
            long instId = entry.getKey();
            var cOpt = entry.getValue();
            if (cOpt.isEmpty()) {
              ctx.response().setStatusCode(404)
                  .putHeader("Content-Type", "application/json")
                  .end(new JsonObject().put("error", "Customer not found").encode());
            } else {
              Customer c = cOpt.get();
              ctx.response().setStatusCode(200)
                  .putHeader("Content-Type", "application/json")
                  .end(toJson(c).encode());
              int score = (int) Math.round(
                  c.riskScore() * 0.20 + c.riskProfileScore() * 0.55 + c.transactionRiskScore() * 0.25);
              service.updateOverallRiskScore(instId, c.externalId(), score)
                  .onFailure(e -> log.warn("Failed to persist overall risk score for {}: {}", c.externalId(), e.getMessage()));
            }
          })
          .onFailure(ctx::fail);
    };
  }

  // GET /customers/high-risk?page=&pageSize=
  public Handler<RoutingContext> highRisk() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      int page;
      int pageSize;
      try { page = Integer.parseInt(ctx.queryParam("page").stream().findFirst().orElse("1")); }
      catch (NumberFormatException e) { page = 1; }
      try { pageSize = Integer.parseInt(ctx.queryParam("pageSize").stream().findFirst().orElse("20")); }
      catch (NumberFormatException e) { pageSize = 20; }
      final int finalPage = Math.max(1, page);
      final int limit = Math.min(Math.max(1, pageSize), 100);
      final int offset = (finalPage - 1) * limit;

      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> AuthException.invalid("session"));
            long instId = u.institutionId();
            return service.countHighRisk(instId)
                .compose(total -> service.listHighRisk(instId, limit, offset)
                    .map(list -> Map.entry(total, list)));
          })
          .onSuccess(entry -> {
            long total = entry.getKey();
            var list = entry.getValue();
            var arr = new JsonArray();
            list.forEach(c -> arr.add(toJson(c)));
            ctx.response().setStatusCode(200)
                .putHeader("Content-Type", "application/json")
                .end(new JsonObject()
                    .put("customers", arr)
                    .put("total", total)
                    .put("page", finalPage)
                    .put("pageSize", limit)
                    .encode());
          })
          .onFailure(ctx::fail);
    };
  }

  // PATCH /customers/:id/profile
  public Handler<RoutingContext> updateProfile() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      String externalId = ctx.pathParam("id");

      JsonObject body;
      try {
        body = ctx.body().asJsonObject();
        if (body == null) body = new JsonObject();
      } catch (Exception e) {
        ctx.response().setStatusCode(400)
            .putHeader("Content-Type", "application/json")
            .end(new JsonObject().put("error", "Invalid JSON body").encode());
        return;
      }

      String bvn           = body.getString("bvn");
      String nin           = body.getString("nin");
      String photo         = body.getString("photo");
      String accountNumber = body.getString("accountNumber");
      String subjectType   = body.getString("subjectType");
      String dobStr        = body.getString("dob");
      String address       = body.getString("address");

      LocalDate dob = null;
      if (dobStr != null && !dobStr.isBlank()) {
        try { dob = LocalDate.parse(dobStr); } catch (Exception ignored) {}
      }

      final LocalDate finalDob = dob;
      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> AuthException.invalid("session"));
            return service.updateProfile(u.institutionId(), externalId,
                bvn, nin, photo, accountNumber, subjectType, finalDob, address);
          })
          .onSuccess(c -> ctx.response().setStatusCode(200)
              .putHeader("Content-Type", "application/json")
              .end(toJson(c).encode()))
          .onFailure(e -> {
            if (e.getMessage() != null && e.getMessage().contains("No rows")) {
              ctx.response().setStatusCode(404)
                  .putHeader("Content-Type", "application/json")
                  .end(new JsonObject().put("error", "Customer not found").encode());
            } else {
              ctx.fail(e);
            }
          });
    };
  }

  // PATCH /customers/:id/watchlist
  public Handler<RoutingContext> watchlistCustomer() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      String externalId = ctx.pathParam("id");
      JsonObject body;
      try { body = ctx.body().asJsonObject(); if (body == null) body = new JsonObject(); }
      catch (Exception e) { ctx.response().setStatusCode(400).putHeader("Content-Type","application/json").end(new JsonObject().put("error","invalid body").encode()); return; }
      String reason = body.getString("reason", "Watchlisted from case resolution");
      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> AuthException.invalid("session"));
            return service.watchlist(u.institutionId(), externalId, reason);
          })
          .onSuccess(c -> ctx.response().setStatusCode(200).putHeader("Content-Type","application/json").end(toJson(c).encode()))
          .onFailure(ctx::fail);
    };
  }

  // PATCH /customers/:id/unwatchlist
  public Handler<RoutingContext> unwatchlistCustomer() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      String externalId = ctx.pathParam("id");
      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> AuthException.invalid("session"));
            return service.unwatchlist(u.institutionId(), externalId);
          })
          .onSuccess(c -> ctx.response().setStatusCode(200).putHeader("Content-Type","application/json").end(toJson(c).encode()))
          .onFailure(ctx::fail);
    };
  }

  static JsonObject toJson(Customer c) {
    int overallRiskScore = (int) Math.round(
        c.riskScore()            * 0.20
        + c.riskProfileScore()   * 0.55
        + c.transactionRiskScore() * 0.25);
    var obj = new JsonObject()
        .put("id",                   c.id())
        .put("institutionId",        c.institutionId())
        .put("externalId",           c.externalId())
        .put("name",                 c.name())
        .put("email",                c.email())
        .put("phone",                c.phone())
        .put("riskScore",            c.riskScore())
        .put("riskProfileScore",     c.riskProfileScore())
        .put("transactionRiskScore", c.transactionRiskScore())
        .put("overallRiskScore",     overallRiskScore)
        .put("bvn",           c.bvn())
        .put("nin",           c.nin())
        .put("photo",         c.photo())
        .put("accountNumber", c.accountNumber())
        .put("subjectType",   c.subjectType())
        .put("address",       c.address())
        .put("createdAt",     c.createdAt().toString())
        .put("updatedAt",     c.updatedAt().toString())
        .put("watchlisted",   c.watchlisted());
    if (c.dob() != null)            obj.put("dob",              c.dob().toString());
    if (c.watchlistedAt() != null)  obj.put("watchlistedAt",    c.watchlistedAt().toString());
    if (c.watchlistedReason() != null) obj.put("watchlistedReason", c.watchlistedReason());
    return obj;
  }
}
