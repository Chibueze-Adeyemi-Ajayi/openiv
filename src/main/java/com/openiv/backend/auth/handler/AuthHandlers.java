package com.openiv.backend.auth.handler;

import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.auth.service.AuthService;
import com.openiv.backend.security.AuditLog;
import com.openiv.backend.security.RequestId;
import io.vertx.core.Future;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.util.function.Function;

/**
 * Thin HTTP handlers. Each: parses/validates the JSON body, delegates to
 * {@link AuthService},
 * translates success/failure to HTTP. No business logic lives here.
 */
public final class AuthHandlers {

  /**
   * Matches AuthService SESSION_TTL_MINUTES (24h); used as the cookie's Max-Age.
   */
  private static final int SESSION_COOKIE_SECONDS = 24 * 60 * 60;

  private final AuthService auth;
  private final boolean productionCookies;

  public AuthHandlers(AuthService auth, boolean productionCookies) {
    this.auth = auth;
    this.productionCookies = productionCookies;
  }

  public Handler<RoutingContext> verifyInvite() {
    return ctx -> withJson(ctx, body -> {
      String code = required(body, "inviteCode");
      return auth.verifyInvite(code).map(info -> new JsonObject()
          .put("email", info.maskedEmail())
          .put("accountType", info.accountType().dbValue()));
    });
  }

  public Handler<RoutingContext> login() {
    return ctx -> withJson(ctx, body -> {
      String email    = required(body, "email");
      String password = required(body, "password");
      String inviteCode = body.getString("inviteCode");
      String deviceId   = body.getString("deviceId");   // browser localStorage UUID, may be null
      String ip = ctx.request().remoteAddress().hostAddress();
      String ua = ctx.request().getHeader("User-Agent");
      Double lat = body.getDouble("lat");
      Double lon = body.getDouble("lon");
      Double acc = body.getDouble("accuracy");
      return auth.login(email, password, inviteCode, ip, ua, lat, lon, acc, deviceId).map(result -> {
        AuditLog.authSuccess(ctx, email);
        SessionCookie.set(ctx, result.sessionToken(), SESSION_COOKIE_SECONDS, productionCookies);
        return new JsonObject()
            .put("state",       result.state().dbValue())
            .put("accountType", result.accountType().dbValue());
      });
    });
  }

  /** POST /auth/session/transfer — same-device TOTP transfer. No existing session required. */
  public Handler<RoutingContext> transferSession() {
    return ctx -> withJson(ctx, body -> {
      String transferRef = required(body, "transferRef");
      String totpCode    = required(body, "totpCode");
      String deviceId    = body.getString("deviceId");
      String ip = ctx.request().remoteAddress().hostAddress();
      String ua = ctx.request().getHeader("User-Agent");
      Double lat = body.getDouble("lat");
      Double lon = body.getDouble("lon");
      Double acc = body.getDouble("accuracy");
      return auth.transferSession(transferRef, totpCode, deviceId, ip, ua, lat, lon, acc)
          .map(result -> {
            SessionCookie.set(ctx, result.sessionToken(), SESSION_COOKIE_SECONDS, productionCookies);
            return new JsonObject()
                .put("state",       result.state().dbValue())
                .put("accountType", result.accountType().dbValue());
          });
    });
  }

  /** POST /auth/devices/block — block a device fingerprint from the alert popup. */
  public Handler<RoutingContext> blockDevice() {
    return ctx -> withJson(ctx, body -> {
      var session   = SessionAuthHandler.require(ctx);
      String deviceId  = required(body, "deviceId");
      String ipAddr    = body.getString("ipAddress");
      String ua        = body.getString("userAgent");
      return auth.blockDevice(session, deviceId, ipAddr, ua)
          .map(v -> new JsonObject().put("ok", true));
    });
  }

  public Handler<RoutingContext> resendEmail() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      auth.resendEmailCode(session)
          .onSuccess(v -> noContent(ctx))
          .onFailure(err -> handleFailure(ctx, err));
    };
  }

  public Handler<RoutingContext> verifyEmail() {
    return ctx -> withJson(ctx, body -> {
      var session = SessionAuthHandler.require(ctx);
      String code = required(body, "code");
      return auth.verifyEmailCode(session, code)
          .map(result -> new JsonObject().put("state", result.state().dbValue()));
    });
  }

  public Handler<RoutingContext> enrollTotp() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      auth.enrollTotp(session)
          .onSuccess(enr -> okJson(ctx, new JsonObject()
              .put("secret", enr.secret())
              .put("otpauthUri", enr.otpauthUri())))
          .onFailure(err -> handleFailure(ctx, err));
    };
  }

  public Handler<RoutingContext> verifyTotp() {
    return ctx -> withJson(ctx, body -> {
      var session = SessionAuthHandler.require(ctx);
      String code = required(body, "code");
      return auth.verifyTotp(session, code)
          .map(result -> new JsonObject().put("state", result.state().dbValue()));
    });
  }

  public Handler<RoutingContext> verifyTotpStepUp() {
    return ctx -> withJson(ctx, body -> {
      var session = SessionAuthHandler.require(ctx);
      String code = required(body, "code");
      return auth.verifyTotpStepUp(session, code)
          .map(v -> new JsonObject().put("ok", true));
    });
  }

  public Handler<RoutingContext> stepUpLockoutAlert() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      auth.reportStepUpLockout(session)
          .onSuccess(v -> okJson(ctx, new JsonObject().put("ok", true)))
          .onFailure(err -> handleFailure(ctx, err));
    };
  }

  public Handler<RoutingContext> changePassword() {
    return ctx -> withJson(ctx, body -> {
      var session = SessionAuthHandler.require(ctx);
      String current = required(body, "currentPassword");
      String next = required(body, "newPassword");
      return auth.changePassword(session, current, next).map(v -> new JsonObject().put("ok", true));
    });
  }

  public Handler<RoutingContext> requestPasswordReset() {
    return ctx -> withJson(ctx, body -> {
      String email = required(body, "email");
      return auth.requestPasswordReset(email).map(v -> new JsonObject().put("ok", true));
    });
  }

  public Handler<RoutingContext> verifyPasswordResetCode() {
    return ctx -> withJson(ctx, body -> {
      String email = required(body, "email");
      String code = required(body, "code");
      return auth.verifyPasswordResetCode(email, code)
          .map(tok -> new JsonObject().put("resetToken", tok.token()));
    });
  }

  public Handler<RoutingContext> confirmPasswordReset() {
    return ctx -> withJson(ctx, body -> {
      String email = required(body, "email");
      String resetToken = required(body, "resetToken");
      String newPassword = required(body, "newPassword");
      return auth.confirmPasswordReset(email, resetToken, newPassword)
          .map(v -> new JsonObject().put("ok", true));
    });
  }

  public Handler<RoutingContext> session() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      auth.sessionInfo(session)
          .onSuccess(info -> {
            JsonObject body = new JsonObject().put("state", info.state().dbValue());
            if (info.accountType() != null)
              body.put("accountType", info.accountType().dbValue());
            if (info.email() != null)
              body.put("email", info.email());
            if (info.fullName() != null)
              body.put("fullName", info.fullName());
            okJson(ctx, body);
          })
          .onFailure(err -> handleFailure(ctx, err));
    };
  }

  public Handler<RoutingContext> logout() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      auth.logout(session)
          .onSuccess(v -> {
            SessionCookie.clear(ctx, productionCookies);
            noContent(ctx);
          })
          .onFailure(err -> handleFailure(ctx, err));
    };
  }

  // --- plumbing ------------------------------------------------------------

  private void withJson(RoutingContext ctx, Function<JsonObject, Future<JsonObject>> fn) {
    JsonObject body;
    try {
      body = ctx.body().asJsonObject();
      if (body == null) {
        badRequest(ctx, "invalid_body");
        return;
      }
    } catch (Exception e) {
      badRequest(ctx, "invalid_json");
      return;
    }
    try {
      fn.apply(body)
          .onSuccess(out -> okJson(ctx, out))
          .onFailure(err -> handleFailure(ctx, err));
    } catch (Throwable t) {
      handleFailure(ctx, t);
    }
  }

  private static String required(JsonObject body, String key) {
    String v = body.getString(key);
    if (v == null || v.isBlank()) {
      throw AuthException.invalid("missing_field:" + key);
    }
    return v;
  }

  private static void okJson(RoutingContext ctx, JsonObject body) {
    ctx.response()
        .setStatusCode(200)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }

  private static void noContent(RoutingContext ctx) {
    ctx.response().setStatusCode(204).end();
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

  private static void handleFailure(RoutingContext ctx, Throwable err) {
    if (err instanceof AuthException ae) {
      int status = switch (ae.category()) {
        case INVALID       -> 400;
        case LOCKED        -> 423;
        case WRONG_STATE   -> 409;
        case WEAK_PASSWORD -> 422;
        case SECURITY      -> 403;
        case CONFLICT      -> 409;
      };
      AuditLog.securityException(ctx, ae.category().name().toLowerCase(), ae.detail());
      JsonObject out = new JsonObject()
          .put("error",         ae.category().name().toLowerCase())
          .put("detail",        ae.detail())
          .put("correlationId", RequestId.of(ctx));
      // Merge any extra conflict payload (e.g. transferRef, existingIp) into the response.
      if (ae.conflictData() != null) {
        out.mergeIn(ae.conflictData());
      }
      ctx.response()
          .setStatusCode(status)
          .putHeader("content-type", "application/json; charset=utf-8")
          .end(out.encode());
      return;
    }
    ctx.fail(err);
  }
}
