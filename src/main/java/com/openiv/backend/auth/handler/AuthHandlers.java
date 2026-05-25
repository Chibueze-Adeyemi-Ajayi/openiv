package com.openiv.backend.auth.handler;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.auth.service.AuthService;
import com.openiv.backend.billing.SubscriptionRepository;
import com.openiv.backend.billing.UsageRepository;
import com.openiv.backend.cloudinary.CloudinaryService;
import com.openiv.backend.customers.CustomerService;
import com.openiv.backend.documents.DocumentRepository;
import com.openiv.backend.security.AuditLog;
import com.openiv.backend.security.RequestId;
import io.vertx.core.Future;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.function.Function;
import java.util.List;
import java.util.UUID;
import io.vertx.ext.web.FileUpload;

/**
 * Thin HTTP handlers. Each: parses/validates the JSON body, delegates to
 * {@link AuthService},
 * translates success/failure to HTTP. No business logic lives here.
 */
public final class AuthHandlers {

  private static final Logger log = LoggerFactory.getLogger(AuthHandlers.class);

  /**
   * Matches AuthService SESSION_TTL_MINUTES (24h); used as the cookie's Max-Age.
   */
  private static final int SESSION_COOKIE_SECONDS = 24 * 60 * 60;

  private final AuthService            auth;
  private final boolean                productionCookies;
  private final CustomerService        customerService;
  private final CloudinaryService      cloudinary;
  private final DocumentRepository     documents;
  private final SubscriptionRepository subscriptions;
  private final UsageRepository        usage;

  public AuthHandlers(AuthService auth, boolean productionCookies,
      CustomerService customerService, CloudinaryService cloudinary,
      DocumentRepository documents, SubscriptionRepository subscriptions,
      UsageRepository usage) {
    this.auth              = auth;
    this.productionCookies = productionCookies;
    this.customerService   = customerService;
    this.cloudinary        = cloudinary;
    this.documents         = documents;
    this.subscriptions     = subscriptions;
    this.usage             = usage;
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
        customerService.refreshAllScores(result.institutionId())
            .onFailure(e -> log.warn("[Login] Background risk refresh failed for institution {}: {}",
                result.institutionId(), e.getMessage()));
        return new JsonObject()
            .put("state",       result.state().dbValue())
            .put("accountType", result.accountType().dbValue())
            .put("fullName",    result.fullName());
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
            customerService.refreshAllScores(result.institutionId())
                .onFailure(e -> log.warn("[TransferSession] Background risk refresh failed for institution {}: {}",
                    result.institutionId(), e.getMessage()));
            return new JsonObject()
                .put("state",       result.state().dbValue())
                .put("accountType", result.accountType().dbValue())
                .put("fullName",    result.fullName());
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
      return auth.verifyTotp(session, code).map(result -> {
        JsonObject out = new JsonObject().put("state", result.state().dbValue());
        if (result.geoRequest() != null) {
          var req = result.geoRequest();
          out.put("requestId",  req.id())
             .put("watchToken", req.watchToken())
             .put("expiresAt",  req.expiresAt() == null ? null : req.expiresAt().toString());
        }
        return out;
      });
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
      return auth.changePassword(session, current, next).map(r -> {
        JsonObject json = new JsonObject().put("ok", true);
        if (r.nextState() != null) json.put("nextState", r.nextState().dbValue());
        return json;
      });
    });
  }

  public Handler<RoutingContext> getProfile() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      auth.getProfile(session).compose(u ->
          auth.getInstitutionId(session).compose(instId ->
              Future.all(
                  auth.getInstitutionName(session),
                  subscriptions.getByInstitution(instId),
                  usage.getSummary(instId)
              ).map(cf -> {
                String instName = cf.resultAt(0);
                var subOpt = cf.<java.util.Optional<com.openiv.backend.billing.InstitutionSubscription>>resultAt(1);
                var usageSummary = cf.<com.openiv.backend.billing.UsageRepository.UsageSummary>resultAt(2);
                var json = new JsonObject()
                    .put("id",                u.id())
                    .put("email",             u.email())
                    .put("fullName",          u.fullName())
                    .put("jobTitle",          u.jobTitle())
                    .put("role",              u.role())
                    .put("accountType",       u.accountType().dbValue())
                    .put("passwordUpdatedAt", u.passwordUpdatedAt() != null ? u.passwordUpdatedAt().toString() : null)
                    .put("createdAt",         u.createdAt().toString())
                    .put("avatarUrl",         u.avatarUrl())
                    .put("institutionName",   instName)
                    .put("monthlyTxnUsed",    usageSummary.monthlyTxnUsed())
                    .put("monthlyKycUsed",    usageSummary.monthlyKycUsed())
                    .put("usagePeriodStart",  usageSummary.usagePeriodStart() != null
                        ? usageSummary.usagePeriodStart().toString() : null);
                subOpt.ifPresent(sub -> {
                  var p = sub.plan();
                  json.put("planSlug",                p.slug())
                      .put("planName",                p.name())
                      .put("aiFeaturesEnabled",       p.aiFeaturesEnabled())
                      .put("featureKycEnabled",       p.featureKycEnabled())
                      .put("featureWebhooksEnabled",  p.featureWebhooksEnabled())
                      .put("featureNetworkEnabled",   p.featureNetworkEnabled())
                      .put("featureBehavioralEnabled",p.featureBehavioralEnabled())
                      .put("featureReportsExport",    p.featureReportsExport())
                      .put("maxAmlRules",             p.maxAmlRules())
                      .put("maxActiveCases",          p.maxActiveCases())
                      .put("maxMonthlyTransactions",  p.maxMonthlyTransactions())
                      .put("maxMonthlyKycLookups",    p.maxMonthlyKycLookups())
                      .put("maxUsers",                p.maxUsers())
                      .put("subscriptionStatus",      sub.status())
                      .put("trialEndsAt",             sub.trialEndsAt() != null ? sub.trialEndsAt().toString() : null)
                      .put("subscriptionRenewsAt",    sub.renewsAt()    != null ? sub.renewsAt().toString()    : null);
                });
                return json;
              })))
          .onSuccess(json -> ctx.response().setStatusCode(200)
              .putHeader("Content-Type", "application/json")
              .end(json.encode()))
          .onFailure(err -> ctx.fail(401));
    };
  }

  public Handler<RoutingContext> updateProfile() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      JsonObject body = ctx.body().asJsonObject();
      if (body == null) { ctx.fail(400); return; }
      String fullName = body.getString("fullName");
      String jobTitle = body.getString("jobTitle");
      auth.updateProfile(session, fullName, jobTitle)
          .map(u -> new JsonObject()
              .put("ok", true)
              .put("fullName", u.fullName())
              .put("jobTitle", u.jobTitle())
              .put("avatarUrl", u.avatarUrl()))
          .onSuccess(json -> ctx.response().setStatusCode(200)
              .putHeader("Content-Type", "application/json")
              .end(json.encode()))
          .onFailure(ctx::fail);
    };
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
            if (info.role() != null)
              body.put("role", info.role());
            body.put("userId", info.userId());
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

  public Handler<RoutingContext> uploadAvatar() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      List<FileUpload> uploads = ctx.fileUploads();
      if (uploads == null || uploads.isEmpty()) {
        ctx.response().setStatusCode(400)
            .putHeader("Content-Type", "application/json")
            .end("{\"error\":\"no_file\",\"detail\":\"No file uploaded\"}");
        return;
      }
      FileUpload fu = uploads.iterator().next();
      String ct = fu.contentType() != null ? fu.contentType() : "";
      if (!ct.startsWith("image/jpeg") && !ct.startsWith("image/png")
          && !ct.startsWith("image/webp") && !ct.startsWith("image/gif")) {
        ctx.response().setStatusCode(400)
            .putHeader("Content-Type", "application/json")
            .end("{\"error\":\"invalid_type\",\"detail\":\"Only JPEG, PNG, WebP and GIF are accepted\"}");
        return;
      }
      if (fu.size() > 5 * 1024 * 1024) {
        ctx.response().setStatusCode(400)
            .putHeader("Content-Type", "application/json")
            .end("{\"error\":\"file_too_large\",\"detail\":\"Maximum avatar size is 5 MB\"}");
        return;
      }
      String publicId = "user_" + session.userId() + "_" + UUID.randomUUID();
      auth.getProfile(session)
          .compose(user -> documents.findAvatarDocument(session.userId())
              .compose(oldDocOpt -> ctx.vertx().fileSystem().readFile(fu.uploadedFileName())
                  .compose(buf -> cloudinary.upload(buf.getBytes(), "openiv", publicId, "image"))
                  .compose(result -> documents.saveDocument(
                      user.institutionId(), session.userId(),
                      result.publicId(), result.secureUrl(),
                      fu.fileName() != null ? fu.fileName() : "avatar", ct, result.bytes(),
                      result.resourceType(), result.format(),
                      result.width(), result.height(),
                      "avatar", String.valueOf(session.userId()))
                      .compose(doc -> auth.updateAvatarUrl(session, result.secureUrl(), doc.id()))
                      .andThen(ar -> {
                        if (ar.succeeded()) {
                          oldDocOpt.ifPresent(oldDoc -> {
                            if (oldDoc.cloudinaryPublicId() != null) {
                              cloudinary.delete(oldDoc.cloudinaryPublicId(), "image")
                                  .onFailure(e -> log.warn("[Avatar] Old image delete failed: {}", e.getMessage()));
                            }
                          });
                        }
                      })
                      .map(u -> new JsonObject().put("ok", true).put("avatarUrl", u.avatarUrl())))))
          .onSuccess(json -> ctx.response().setStatusCode(200)
              .putHeader("Content-Type", "application/json")
              .end(json.encode()))
          .onFailure(err -> ctx.fail(500, err));
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
