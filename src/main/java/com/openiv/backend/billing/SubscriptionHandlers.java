package com.openiv.backend.billing;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.repository.UserRepository;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class SubscriptionHandlers {

  private final SubscriptionRepository      repo;
  private final UserRepository              users;
  private final SubscriptionLifecycleService lifecycle;
  private final InvoiceRepository           invoices;

  public SubscriptionHandlers(
      SubscriptionRepository repo,
      UserRepository users,
      SubscriptionLifecycleService lifecycle,
      InvoiceRepository invoices) {
    this.repo      = repo;
    this.users     = users;
    this.lifecycle = lifecycle;
    this.invoices  = invoices;
  }

  // GET /subscription/plans  (public — no auth)
  public Handler<RoutingContext> listPlans() {
    return ctx -> repo.listPlans()
        .onSuccess(plans -> {
          var arr = new JsonArray();
          plans.forEach(p -> arr.add(planJson(p)));
          ok(ctx, new JsonObject().put("plans", arr));
        })
        .onFailure(ctx::fail);
  }

  // GET /subscription/current  (auth required)
  public Handler<RoutingContext> getCurrent() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      users.findById(session.userId())
          .compose(opt -> {
            if (opt.isEmpty()) return io.vertx.core.Future.failedFuture("user not found");
            return repo.getByInstitution(opt.get().institutionId());
          })
          .onSuccess(opt -> {
            if (opt.isEmpty()) { ctx.fail(404); return; }
            var sub = opt.get();
            ok(ctx, new JsonObject()
                .put("plan",        planJson(sub.plan()))
                .put("status",      sub.status())
                .put("startsAt",    sub.startsAt()    != null ? sub.startsAt().toString()    : null)
                .put("trialEndsAt", sub.trialEndsAt() != null ? sub.trialEndsAt().toString() : null)
                .put("renewsAt",    sub.renewsAt()    != null ? sub.renewsAt().toString()    : null));
          })
          .onFailure(ctx::fail);
    };
  }

  // POST /subscription/upgrade  { "planId": "..." }  — kept for dev backward compat
  public Handler<RoutingContext> upgrade() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      var body    = ctx.body().asJsonObject();
      if (body == null || body.getString("planId") == null) { ctx.fail(400); return; }
      String planId = body.getString("planId");
      users.findById(session.userId())
          .compose(opt -> {
            if (opt.isEmpty()) return io.vertx.core.Future.failedFuture("user not found");
            return repo.changePlan(opt.get().institutionId(), planId);
          })
          .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
          .onFailure(ctx::fail);
    };
  }

  // POST /subscription/initiate  { "planId": "...", "couponCode": "..." }
  public Handler<RoutingContext> initiatePayment() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      var body    = parseBody(ctx);
      if (body == null || body.getString("planId") == null) { ctx.fail(400); return; }
      String planId     = body.getString("planId");
      String couponCode = body.getString("couponCode");

      users.findById(session.userId())
          .compose(opt -> {
            if (opt.isEmpty()) return io.vertx.core.Future.failedFuture("user not found");
            var user = opt.get();
            return lifecycle.initiate(user.institutionId(), planId, user.email(), couponCode);
          })
          .onSuccess(result -> ok(ctx, new JsonObject()
              .put("invoiceId",           result.invoiceId().toString())
              .put("reference",           result.reference())
              .put("accessCode",          result.accessCode())
              .put("authorizationUrl",    result.authorizationUrl())
              .put("amountNgn",           result.amountNgn())
              .put("discountedAmountNgn", result.discountedAmountNgn())
              .put("discountPercent",     result.discountPercent())
              .put("invoiceType",         result.invoiceType())))
          .onFailure(err -> {
            String msg = err.getMessage();
            if (msg != null && msg.contains("Downgrade is only available")) {
              ctx.response().setStatusCode(409)
                  .putHeader("Content-Type", "application/json")
                  .end(new JsonObject()
                      .put("error", "downgrade_window_closed")
                      .put("message", msg)
                      .encode());
            } else {
              ctx.fail(err);
            }
          });
    };
  }

  // POST /subscription/verify  { "reference": "..." }
  public Handler<RoutingContext> verifyPayment() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      var body    = parseBody(ctx);
      if (body == null || body.getString("reference") == null) { ctx.fail(400); return; }
      String reference = body.getString("reference");

      users.findById(session.userId())
          .compose(opt -> {
            if (opt.isEmpty()) return io.vertx.core.Future.failedFuture("user not found");
            return lifecycle.verifyAndApply(opt.get().institutionId(), reference);
          })
          .onSuccess(planId -> ok(ctx, new JsonObject().put("ok", true).put("planId", planId)))
          .onFailure(ctx::fail);
    };
  }

  // GET /subscription/active-discount
  public Handler<RoutingContext> getActiveDiscount() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      users.findById(session.userId())
          .compose(opt -> {
            if (opt.isEmpty()) return io.vertx.core.Future.failedFuture("user not found");
            return invoices.findActiveForInstitution(opt.get().institutionId());
          })
          .onSuccess(invoiceOpt -> {
            if (invoiceOpt.isEmpty()) {
              ctx.response().setStatusCode(200)
                  .putHeader("Content-Type", "application/json")
                  .end("null");
              return;
            }
            var inv = invoiceOpt.get();
            ok(ctx, new JsonObject()
                .put("discountPercent",    inv.discountPercent())
                .put("couponCode",         inv.couponCode())
                .put("couponExpiresAt",    inv.couponExpiresAt() != null ? inv.couponExpiresAt().toString() : null)
                .put("amountNgn",          inv.amountNgn())
                .put("discountedAmountNgn", inv.discountedAmountNgn()));
          })
          .onFailure(ctx::fail);
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Safely parse body as JsonObject regardless of Content-Type parsing quirks. */
  private static JsonObject parseBody(RoutingContext ctx) {
    try {
      String raw = ctx.body().asString();
      if (raw == null || raw.isBlank()) return null;
      return new JsonObject(raw);
    } catch (Exception e) {
      return null;
    }
  }

  private static JsonObject planJson(SubscriptionPlan p) {
    var feats = new JsonArray();
    p.features().forEach(feats::add);
    return new JsonObject()
        .put("id",                       p.id())
        .put("name",                     p.name())
        .put("slug",                     p.slug())
        .put("monthlyPriceNgn",          p.monthlyPriceNgn())
        .put("maxUsers",                 p.maxUsers())
        .put("maxMonthlyTransactions",   p.maxMonthlyTransactions())
        .put("maxActiveCases",           p.maxActiveCases())
        .put("aiFeaturesEnabled",        p.aiFeaturesEnabled())
        .put("apiRateLimitPerMin",       p.apiRateLimitPerMin())
        .put("includedTransactionUnits", p.includedTransactionUnits())
        .put("features",                 feats)
        .put("sortOrder",                p.sortOrder())
        .put("maxMonthlyKycLookups",     p.maxMonthlyKycLookups());
  }

  private static void ok(RoutingContext ctx, JsonObject body) {
    ctx.response().setStatusCode(200)
        .putHeader("Content-Type", "application/json")
        .end(body.encode());
  }
}
