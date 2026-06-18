package com.openiv.backend.webauthn;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.handler.SessionCookie;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.SessionState;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public class WebAuthnHandlers {

  private final WebAuthnService service;
  private final UserRepository users;
  private final boolean productionMode;

  public WebAuthnHandlers(WebAuthnService service, UserRepository users, boolean productionMode) {
    this.service        = service;
    this.users          = users;
    this.productionMode = productionMode;
  }

  /** GET /auth/webauthn/status — is the current user enrolled? */
  public Handler<RoutingContext> status() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      service.isEnrolled(session.userId())
          .onSuccess(enrolled -> ctx.response()
              .putHeader("Content-Type", "application/json")
              .end(new JsonObject().put("enrolled", enrolled).encode()))
          .onFailure(ctx::fail);
    };
  }

  /** POST /auth/webauthn/register/start — returns PublicKeyCredentialCreationOptions JSON */
  public Handler<RoutingContext> registerStart() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      if (session.state() != SessionState.PENDING_BIOMETRIC_SETUP
          && session.state() != SessionState.AUTHENTICATED) {
        ctx.fail(AuthException.wrongState());
        return;
      }
      users.findById(session.userId()).compose(opt -> {
        var user = opt.orElseThrow();
        return service.startRegistration(session.userId(), user.displayName(), user.email());
      })
      .onSuccess(options -> ctx.response()
          .putHeader("Content-Type", "application/json")
          .end(options.encode()))
      .onFailure(ctx::fail);
    };
  }

  /** POST /auth/webauthn/register/finish — verifies attestation, stores key, transitions session */
  public Handler<RoutingContext> registerFinish() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      if (session.state() != SessionState.PENDING_BIOMETRIC_SETUP
          && session.state() != SessionState.AUTHENTICATED) {
        ctx.fail(AuthException.wrongState());
        return;
      }
      JsonObject body = ctx.body().asJsonObject();
      service.finishRegistration(session,
          body.getString("id"),
          body.getString("clientDataJSON"),
          body.getString("attestationObject"))
          .onSuccess(v -> ctx.response()
              .putHeader("Content-Type", "application/json")
              .end(new JsonObject().put("ok", true).put("nextState", "authenticated").encode()))
          .onFailure(ctx::fail);
    };
  }

  /** POST /auth/webauthn/authenticate/start — returns PublicKeyCredentialRequestOptions JSON */
  public Handler<RoutingContext> authenticateStart() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      service.startAuthentication(session.userId())
          .onSuccess(options -> ctx.response()
              .putHeader("Content-Type", "application/json")
              .end(options.encode()))
          .onFailure(ctx::fail);
    };
  }

  /** POST /auth/webauthn/authenticate/finish — verifies assertion signature (step-up) */
  public Handler<RoutingContext> authenticateFinish() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      JsonObject body = ctx.body().asJsonObject();
      service.finishAuthentication(session,
          body.getString("id"),
          body.getString("authenticatorData"),
          body.getString("clientDataJSON"),
          body.getString("signature"))
          .onSuccess(v -> ctx.response()
              .putHeader("Content-Type", "application/json")
              .end(new JsonObject().put("ok", true).encode()))
          .onFailure(ctx::fail);
    };
  }

  /** POST /auth/webauthn/challenge/start — get assertion options during login */
  public Handler<RoutingContext> challengeStart() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      if (session.state() != SessionState.PENDING_BIOMETRIC_CHALLENGE) {
        ctx.fail(AuthException.wrongState());
        return;
      }
      service.startAuthentication(session.userId())
          .onSuccess(options -> ctx.response()
              .putHeader("Content-Type", "application/json")
              .end(options.encode()))
          .onFailure(ctx::fail);
    };
  }

  /** POST /auth/webauthn/challenge/finish — verify assertion, transition → AUTHENTICATED */
  public Handler<RoutingContext> challengeFinish() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      if (session.state() != SessionState.PENDING_BIOMETRIC_CHALLENGE) {
        ctx.fail(AuthException.wrongState());
        return;
      }
      JsonObject body = ctx.body().asJsonObject();
      service.finishLoginChallenge(session,
          body.getString("id"),
          body.getString("authenticatorData"),
          body.getString("clientDataJSON"),
          body.getString("signature"))
          .onSuccess(v -> {
            // Upgrade the 10-min challenge cookie to a 30-day authenticated cookie.
            String token = SessionCookie.read(ctx);
            if (token != null) SessionCookie.set(ctx, token, 30 * 24 * 60 * 60, productionMode);
            ctx.response()
                .putHeader("Content-Type", "application/json")
                .end(new JsonObject().put("ok", true).put("nextState", "authenticated").encode());
          })
          .onFailure(ctx::fail);
    };
  }

  /**
   * POST /auth/webauthn/login/start — unauthenticated.
   * Takes { email }, creates PENDING_BIOMETRIC_CHALLENGE session, returns assertion options.
   * Same error shape whether user missing or not enrolled (avoids enumeration).
   */
  public Handler<RoutingContext> loginStart() {
    return ctx -> {
      JsonObject body = ctx.body().asJsonObject();
      if (body == null) { ctx.fail(400); return; }
      String email = body.getString("email", "").trim();
      if (email.isEmpty()) { ctx.fail(400); return; }
      String deviceId  = ctx.request().getHeader("X-Device-Id");
      String ip        = ctx.request().remoteAddress().host();
      String userAgent = ctx.request().getHeader("User-Agent");
      service.loginStart(email, deviceId, ip, userAgent)
          .onSuccess(result -> {
            String token   = result.getString("_token");
            JsonObject opts = result.getJsonObject("options");
            SessionCookie.set(ctx, token, 10 * 60, productionMode);
            ctx.response()
                .putHeader("Content-Type", "application/json")
                .end(opts.encode());
          })
          .onFailure(err -> ctx.response()
              .setStatusCode(400)
              .putHeader("Content-Type", "application/json")
              .end(new JsonObject().put("error", "biometric_login_unavailable").encode()));
    };
  }

  /** GET /team/members/:userId/credentials — CCO/admin views a member's registered biometric keys */
  public Handler<RoutingContext> listMemberCredentials() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      long targetUserId;
      try { targetUserId = Long.parseLong(ctx.pathParam("userId")); }
      catch (NumberFormatException e) { ctx.fail(400); return; }
      service.listMemberCredentials(session, targetUserId)
          .onSuccess(arr -> ctx.response()
              .putHeader("Content-Type", "application/json")
              .end(new JsonObject().put("credentials", arr).encode()))
          .onFailure(ctx::fail);
    };
  }

  /** DELETE /team/members/:userId/credentials/:credId — CCO/admin revokes a specific biometric key */
  public Handler<RoutingContext> revokeMemberCredential() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      long targetUserId, credDbId;
      try {
        targetUserId = Long.parseLong(ctx.pathParam("userId"));
        credDbId     = Long.parseLong(ctx.pathParam("credId"));
      } catch (NumberFormatException e) { ctx.fail(400); return; }
      service.revokeCredential(session, targetUserId, credDbId)
          .onSuccess(v -> ctx.response()
              .putHeader("Content-Type", "application/json")
              .end(new JsonObject().put("ok", true).encode()))
          .onFailure(ctx::fail);
    };
  }
}
