package com.openiv.backend.verify;

import com.openiv.backend.dojah.DojahClient;
import com.openiv.backend.dojah.DojahVerificationResult;
import com.openiv.backend.dojah.NubanResult;
import com.openiv.backend.dojah.PhoneFraudResult;

import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

/**
 * Verification API — authenticated with a beam API key (Bearer token).
 *
 * POST /api/v1/verify/bvn
 * POST /api/v1/verify/nin
 * POST /api/v1/verify/phone
 * POST /api/v1/verify/pep
 */
public final class VerifyHandlers {

  private final DojahClient doja;

  public VerifyHandlers(DojahClient doja) {
    this.doja = doja;
  }

  // POST /verify/bvn { "bvn": "22123456789", "customer_ref": "CUS-001" }
  public Handler<RoutingContext> verifyBvn() {
    return ctx -> {
      JsonObject body = parseBody(ctx);
      if (body == null)
        return;
      String bvn = body.getString("bvn");
      if (bvn == null || bvn.isBlank()) {
        badRequest(ctx, "bvn is required");
        return;
      }

      doja.verifyBvn(bvn)
          .onSuccess(r -> ok(ctx, resultJson(r).put("customer_ref", body.getString("customer_ref"))))
          .onFailure(ctx::fail);
    };
  }

  // POST /verify/nin { "nin": "12345678901", "customer_ref": "CUS-001" }
  public Handler<RoutingContext> verifyNin() {
    return ctx -> {
      JsonObject body = parseBody(ctx);
      if (body == null)
        return;
      String nin = body.getString("nin");
      if (nin == null || nin.isBlank()) {
        badRequest(ctx, "nin is required");
        return;
      }

      doja.verifyNin(nin)
          .onSuccess(r -> ok(ctx, resultJson(r).put("customer_ref", body.getString("customer_ref"))))
          .onFailure(ctx::fail);
    };
  }

  // POST /verify/phone { "phone": "+2348031234567", "customer_ref": "CUS-001" }
  public Handler<RoutingContext> verifyPhone() {
    return ctx -> {
      JsonObject body = parseBody(ctx);
      if (body == null)
        return;
      String phone = body.getString("phone");
      if (phone == null || phone.isBlank()) {
        badRequest(ctx, "phone is required");
        return;
      }

      doja.lookupPhone(phone)
          .onSuccess(r -> ok(ctx, resultJson(r).put("customer_ref", body.getString("customer_ref"))))
          .onFailure(ctx::fail);
    };
  }

  // POST /verify/pep { "name": "John Doe", "dob": "1980-01-01" }
  public Handler<RoutingContext> verifyPep() {
    return ctx -> {
      JsonObject body = parseBody(ctx);
      if (body == null)
        return;
      String name = body.getString("name");
      if (name == null || name.isBlank()) {
        badRequest(ctx, "name is required");
        return;
      }

      String dob = body.getString("dob");
      String uniqueRef = "pep-verify-" + System.currentTimeMillis();

      doja.screenAml(name.trim(), dob, uniqueRef)
          .onSuccess(amlResult -> {
            if (amlResult.containsKey("error")) {
              ctx.fail(500);
              return;
            }
            JsonObject entity = amlResult.getJsonObject("entity", new JsonObject());
            int totalResults = entity.getInteger("total_results", 0);
            JsonArray matches = new JsonArray();

            // Map raw Doja results to clean match objects
            Object rawResults = entity.getValue("results");
            if (rawResults instanceof JsonArray arr) {
              arr.forEach(item -> {
                if (item instanceof JsonObject r) {
                  matches.add(new JsonObject()
                      .put("name", r.getString("name", r.getString("full_name")))
                      .put("risk_level", r.getString("risk_level", entity.getString("risk_level", "")))
                      .put("positions", r.getValue("positions", new JsonArray()))
                      .put("countries", r.getValue("countries", new JsonArray())));
                }
              });
            } else if (rawResults instanceof JsonObject r) {
              matches.add(new JsonObject()
                  .put("name", r.getString("name", r.getString("full_name")))
                  .put("risk_level", r.getString("risk_level", entity.getString("risk_level", "")))
                  .put("positions", r.getValue("positions", new JsonArray()))
                  .put("countries", r.getValue("countries", new JsonArray())));
            }

            ok(ctx, new JsonObject()
                .put("name", name)
                .put("dob", dob)
                .put("is_pep", totalResults > 0)
                .put("total_matches", totalResults)
                .put("matches", matches));
          })
          .onFailure(ctx::fail);
    };
  }

  // POST /verify/nuban { "account_number": "0123456789", "bank_code": "033" }
  public Handler<RoutingContext> verifyNuban() {
    return ctx -> {
      JsonObject body = parseBody(ctx);
      if (body == null)
        return;
      String accountNumber = body.getString("account_number");
      String bankCode = body.getString("bank_code");
      if (accountNumber == null || accountNumber.isBlank()) {
        badRequest(ctx, "account_number is required");
        return;
      }
      if (bankCode == null || bankCode.isBlank()) {
        badRequest(ctx, "bank_code is required");
        return;
      }

      doja.lookupNuban(accountNumber, bankCode)
          .onSuccess(r -> ok(ctx, nubanJson(r)))
          .onFailure(ctx::fail);
    };
  }

  // POST /verify/phone-fraud { "phone": "2348101234567" }
  public Handler<RoutingContext> screenPhoneFraud() {
    return ctx -> {
      JsonObject body = parseBody(ctx);
      if (body == null)
        return;
      String phone = body.getString("phone");
      if (phone == null || phone.isBlank()) {
        badRequest(ctx, "phone is required");
        return;
      }

      doja.screenPhoneFraud(phone)
          .onSuccess(r -> ok(ctx, phoneFraudJson(r)))
          .onFailure(ctx::fail);
    };
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private static JsonObject nubanJson(NubanResult r) {
    return new JsonObject()
        .put("resolved", r.resolved())
        .put("account_name", r.accountName())
        .put("first_name", r.firstName())
        .put("last_name", r.lastName())
        .put("other_names", r.otherNames())
        .put("dob", r.dob())
        .put("masked_phone", r.phone())
        .put("masked_bvn", r.bvn())
        .put("identity_type", r.identityType())
        .put("city", r.city())
        .put("state", r.state());
  }

  private static JsonObject phoneFraudJson(PhoneFraudResult r) {
    return new JsonObject()
        .put("resolved", r.resolved())
        .put("phone", r.phone())
        .put("valid", r.valid())
        .put("carrier", r.carrier())
        .put("line_type", r.lineType())
        .put("country", r.country())
        .put("risk_score", r.riskScore())
        .put("leaked", r.leaked())
        .put("spammer", r.spammer())
        .put("disposable", r.disposable())
        .put("suspicious", r.suspicious())
        .put("recent_abuse", r.recentAbuse())
        .put("active", r.active());
  }

  private static JsonObject resultJson(DojahVerificationResult r) {
    return new JsonObject()
        .put("verified", r.verified())
        .put("type", r.type())
        .put("reference", r.reference())
        .put("first_name", r.firstName())
        .put("last_name", r.lastName())
        .put("middle_name", r.middleName())
        .put("date_of_birth", r.dateOfBirth())
        .put("phone", r.phone())
        .put("face_match", r.faceMatch())
        .put("match_score", r.matchScore() >= 0 ? r.matchScore() : null);
  }

  private static JsonObject parseBody(RoutingContext ctx) {
    try {
      String raw = ctx.body().asString();
      if (raw == null || raw.isBlank()) {
        badRequest(ctx, "request body is required");
        return null;
      }
      return new JsonObject(raw);
    } catch (Exception e) {
      badRequest(ctx, "invalid JSON body");
      return null;
    }
  }

  private static void ok(RoutingContext ctx, JsonObject body) {
    ctx.response().setStatusCode(200)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }

  private static void badRequest(RoutingContext ctx, String message) {
    ctx.response().setStatusCode(400)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(new JsonObject().put("error", "invalid_request").put("message", message).encode());
  }
}
