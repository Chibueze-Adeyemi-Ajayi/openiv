package com.openiv.backend.institution;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.model.Institution;
import com.openiv.backend.auth.repository.InstitutionRepository;
import com.openiv.backend.auth.repository.UserRepository;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class InstitutionHandlers {

  private final InstitutionRepository institutions;
  private final UserRepository users;

  public InstitutionHandlers(InstitutionRepository institutions, UserRepository users) {
    this.institutions = institutions;
    this.users = users;
  }

  // GET /institution/profile
  public Handler<RoutingContext> getProfile() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      users.findById(session.userId())
          .compose(uOpt -> {
            long instId = uOpt.orElseThrow().institutionId();
            return institutions.findById(instId);
          })
          .onSuccess(opt -> {
            if (opt.isEmpty()) { ctx.fail(404); return; }
            ok(ctx, toJson(opt.get()));
          })
          .onFailure(ctx::fail);
    };
  }

  // GET /institution/signing-credentials
  public Handler<RoutingContext> getSigningCredentials() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      users.findById(session.userId())
          .compose(uOpt -> {
            long instId = uOpt.orElseThrow().institutionId();
            return institutions.findById(instId);
          })
          .onSuccess(opt -> {
            if (opt.isEmpty()) { ctx.fail(404); return; }
            var inst = opt.get();
            ok(ctx, new io.vertx.core.json.JsonObject()
                .put("officialStamp",     inst.officialStamp())
                .put("officialSignature", inst.officialSignature()));
          })
          .onFailure(ctx::fail);
    };
  }

  // PATCH /institution/signing-credentials  (TOTP step-up enforced on the frontend)
  public Handler<RoutingContext> updateSigningCredentials() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body;
      try {
        body = ctx.body().asJsonObject();
        if (body == null) { ctx.fail(400); return; }
      } catch (Exception e) { ctx.fail(400); return; }

      String officialStamp     = body.getString("officialStamp");
      String officialSignature = body.getString("officialSignature");

      users.findById(session.userId())
          .compose(uOpt -> {
            long instId = uOpt.orElseThrow().institutionId();
            return institutions.updateSigningCredentials(instId, officialStamp, officialSignature);
          })
          .onSuccess(inst -> ok(ctx, toJson(inst)))
          .onFailure(ctx::fail);
    };
  }

  // PATCH /institution/profile
  public Handler<RoutingContext> updateProfile() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body;
      try {
        body = ctx.body().asJsonObject();
        if (body == null) { ctx.fail(400); return; }
      } catch (Exception e) { ctx.fail(400); return; }

      String cbnCode      = body.getString("cbnCode");
      String address      = body.getString("address");
      String contactPhone = body.getString("contactPhone");

      users.findById(session.userId())
          .compose(uOpt -> {
            long instId = uOpt.orElseThrow().institutionId();
            return institutions.updateProfile(instId, cbnCode, address, contactPhone);
          })
          .onSuccess(inst -> ok(ctx, toJson(inst)))
          .onFailure(ctx::fail);
    };
  }

  private static JsonObject toJson(Institution i) {
    return new JsonObject()
        .put("id",                i.id())
        .put("name",              i.name())
        .put("type",              i.type().name())
        .put("status",            i.status())
        .put("cbnCode",           i.cbnCode())
        .put("address",           i.address())
        .put("contactPhone",      i.contactPhone())
        .put("officialStamp",     i.officialStamp())
        .put("officialSignature", i.officialSignature());
  }

  private static void ok(RoutingContext ctx, JsonObject body) {
    ctx.response().setStatusCode(200)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }
}
