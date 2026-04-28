package com.openiv.backend.billing;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class BillingHandlers {

  private final BillingService service;
  private final String         paystackPublicKey;

  public BillingHandlers(BillingService service, String paystackPublicKey) {
    this.service          = service;
    this.paystackPublicKey = paystackPublicKey;
  }

  // GET /billing/config
  public Handler<RoutingContext> getConfig() {
    return ctx -> ok(ctx, new JsonObject().put("paystackPublicKey", paystackPublicKey));
  }

  // GET /billing/summary
  public Handler<RoutingContext> getSummary() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.getSummary(session)
          .onSuccess(summary -> ok(ctx, summary))
          .onFailure(ctx::fail);
    };
  }

  // GET /billing/usage
  public Handler<RoutingContext> getUsage() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.getUsage(session)
          .onSuccess(usage -> {
            var cats = new JsonArray();
            usage.categories().forEach(c -> cats.add(new JsonObject()
                .put("category",         c.category())
                .put("eventCount",       c.eventCount())
                .put("totalAmountUnits", c.totalAmountUnits())
                .put("rateUnitsEach",    c.rateUnitsEach())));
            ok(ctx, new JsonObject()
                .put("periodStart",     usage.periodStart())
                .put("periodEnd",       usage.periodEnd())
                .put("dayOfPeriod",     usage.dayOfPeriod())
                .put("daysInPeriod",    usage.daysInPeriod())
                .put("totalDebitUnits", usage.totalDebitUnits())
                .put("creditExpiresAt", usage.creditExpiresAt())
                .put("isInFreePeriod",  usage.isInFreePeriod())
                .put("categories",      cats));
          })
          .onFailure(ctx::fail);
    };
  }

  // GET /billing/ledger
  public Handler<RoutingContext> getLedger() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.getLedger(session)
          .onSuccess(entries -> {
            var arr = new JsonArray();
            entries.forEach(e -> arr.add(ledgerJson(e)));
            ok(ctx, new JsonObject().put("entries", arr));
          })
          .onFailure(ctx::fail);
    };
  }

  // GET /billing/payment-methods
  public Handler<RoutingContext> listPaymentMethods() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.listPaymentMethods(session)
          .onSuccess(methods -> {
            var arr = new JsonArray();
            methods.forEach(m -> arr.add(paymentMethodJson(m)));
            ok(ctx, new JsonObject().put("paymentMethods", arr));
          })
          .onFailure(ctx::fail);
    };
  }

  // DELETE /billing/payment-methods/:id
  public Handler<RoutingContext> deletePaymentMethod() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id;
      try { id = Long.parseLong(ctx.pathParam("id")); }
      catch (NumberFormatException e) { badRequest(ctx, "invalid id"); return; }
      service.deletePaymentMethod(session, id)
          .onSuccess(ignored -> ok(ctx, new JsonObject().put("ok", true)))
          .onFailure(ctx::fail);
    };
  }

  // POST /billing/payment/initialize
  public Handler<RoutingContext> initializePayment() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;
      Long   amountNgn = body.getLong("amountNgn");
      String email     = body.getString("email");
      if (amountNgn == null || amountNgn <= 0) { badRequest(ctx, "amountNgn must be > 0"); return; }
      if (email == null || email.isBlank())     { badRequest(ctx, "email is required"); return; }
      service.initializePayment(session, amountNgn, email)
          .onSuccess(result -> ok(ctx, result))
          .onFailure(err -> {
            if (err instanceof IllegalStateException) badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // POST /billing/payment/verify
  public Handler<RoutingContext> verifyPayment() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;
      String  reference = body.getString("reference");
      boolean saveCard  = Boolean.TRUE.equals(body.getBoolean("saveCard"));
      if (reference == null || reference.isBlank()) { badRequest(ctx, "reference is required"); return; }
      service.verifyAndSaveCard(session, reference, saveCard)
          .onSuccess(result -> ok(ctx, result))
          .onFailure(err -> {
            if (err instanceof IllegalStateException) badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // POST /billing/topup
  public Handler<RoutingContext> topup() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;
      Long   methodId  = body.getLong("paymentMethodId");
      Long   amountNgn = body.getLong("amountNgn");
      String email     = body.getString("email");
      if (methodId == null)                        { badRequest(ctx, "paymentMethodId is required"); return; }
      if (amountNgn == null || amountNgn <= 0)     { badRequest(ctx, "amountNgn must be > 0"); return; }
      if (email == null || email.isBlank())         { badRequest(ctx, "email is required"); return; }
      service.topupWithSavedCard(session, methodId, amountNgn, email)
          .onSuccess(result -> ok(ctx, result))
          .onFailure(err -> {
            if (err instanceof IllegalStateException || err instanceof IllegalArgumentException)
              badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // POST /billing/card/charge
  public Handler<RoutingContext> chargeCard() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;
      String  cardNumber  = body.getString("cardNumber");
      String  cvv         = body.getString("cvv");
      String  expiryMonth = body.getString("expiryMonth");
      String  expiryYear  = body.getString("expiryYear");
      Long    amountNgn   = body.getLong("amountNgn");
      String  email       = body.getString("email");
      boolean saveCard    = Boolean.TRUE.equals(body.getBoolean("saveCard"));
      if (blank(cardNumber))  { badRequest(ctx, "cardNumber is required"); return; }
      if (blank(cvv))         { badRequest(ctx, "cvv is required"); return; }
      if (blank(expiryMonth)) { badRequest(ctx, "expiryMonth is required"); return; }
      if (blank(expiryYear))  { badRequest(ctx, "expiryYear is required"); return; }
      if (amountNgn == null || amountNgn < 100) { badRequest(ctx, "amountNgn must be ≥ 100"); return; }
      if (blank(email))       { badRequest(ctx, "email is required"); return; }
      service.chargeCardDirect(session, cardNumber, cvv, expiryMonth, expiryYear, amountNgn, email, saveCard)
          .onSuccess(result -> ok(ctx, result))
          .onFailure(err -> {
            if (err instanceof IllegalStateException || err instanceof IllegalArgumentException)
              badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // POST /billing/card/challenge
  public Handler<RoutingContext> submitChallenge() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;
      String  reference     = body.getString("reference");
      String  challengeType = body.getString("type");
      String  value         = body.getString("value");
      Long    amountNgn     = body.getLong("amountNgn");
      String  email         = body.getString("email");
      boolean saveCard      = Boolean.TRUE.equals(body.getBoolean("saveCard"));
      if (blank(reference))     { badRequest(ctx, "reference is required"); return; }
      if (blank(challengeType)) { badRequest(ctx, "type is required"); return; }
      if (blank(value))         { badRequest(ctx, "value is required"); return; }
      if (amountNgn == null || amountNgn < 100) { badRequest(ctx, "amountNgn must be ≥ 100"); return; }
      if (blank(email))         { badRequest(ctx, "email is required"); return; }
      if (!"pin".equals(challengeType) && !"otp".equals(challengeType)) {
        badRequest(ctx, "type must be 'pin' or 'otp'"); return;
      }
      service.submitCardChallenge(session, reference, challengeType, value, amountNgn, email, saveCard)
          .onSuccess(result -> ok(ctx, result))
          .onFailure(err -> {
            if (err instanceof IllegalStateException || err instanceof IllegalArgumentException)
              badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // ── JSON serialisers ──────────────────────────────────────────────────────

  private static JsonObject ledgerJson(BillingLedgerEntry e) {
    return new JsonObject()
        .put("dayStr",             e.dayStr())
        .put("type",               e.type())
        .put("totalAmountUnits",   e.totalAmountUnits())
        .put("endingBalanceUnits", e.endingBalanceUnits())
        .put("eventCount",         e.eventCount())
        .put("lastRef",            e.lastRef());
  }

  private static JsonObject paymentMethodJson(PaymentMethod m) {
    return new JsonObject()
        .put("id",          m.id())
        .put("provider",    m.provider())
        .put("type",        m.type())
        .put("displayName", m.displayName())
        .put("last4",       m.last4())
        .put("isDefault",   m.isDefault())
        .put("createdAt",   m.createdAt().toString());
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  private static boolean blank(String s) {
    return s == null || s.isBlank();
  }
}
