package com.openiv.backend.geofence;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.auth.service.AuthService;
import com.openiv.backend.security.AuditLog;
import com.openiv.backend.security.RequestId;
import io.vertx.core.Future;
import io.vertx.core.Handler;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

/**
 * HTTP handlers for geo-fence configuration and geo-access-request management.
 */
public final class GeoFenceHandlers {

  private final GeoFenceService geoFence;
  private final AuthService auth;
  private final UserRepository users;
  private final Vertx vertx;

  public GeoFenceHandlers(GeoFenceService geoFence, AuthService auth,
      UserRepository users, Vertx vertx) {
    this.geoFence = geoFence;
    this.auth     = auth;
    this.users    = users;
    this.vertx    = vertx;
  }

  // ── Geo fence config (super admin only) ─────────────────────────────────

  public Handler<RoutingContext> getConfig() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      users.findById(session.userId()).compose(opt -> {
        var user = opt.orElseThrow();
        requireAdmin(user.role());
        return geoFence.getConfig(user.institutionId());
      }).onSuccess(opt -> {
        if (opt.isEmpty()) {
          okJson(ctx, new JsonObject()
              .put("enabled", false)
              .put("polygon", new JsonArray())
              .put("calLatOffset", 0.0)
              .put("calLngOffset", 0.0));
        } else {
          okJson(ctx, GeoFenceService.fenceToJson(opt.get()));
        }
      }).onFailure(err -> handleFailure(ctx, err));
    };
  }

  /** PUT /settings/geo-fence — requires TOTP step-up code in body. */
  public Handler<RoutingContext> saveConfig() {
    return ctx -> withJson(ctx, body -> {
      Session session = SessionAuthHandler.require(ctx);
      String totpCode = required(body, "totpCode");
      return auth.verifyTotpStepUp(session, totpCode)
          .compose(v -> users.findById(session.userId()))
          .compose(opt -> {
            var user = opt.orElseThrow();
            requireAdmin(user.role());
            boolean enabled      = body.getBoolean("enabled", false);
            double calLatOffset  = body.getDouble("calLatOffset", 0.0);
            double calLngOffset  = body.getDouble("calLngOffset", 0.0);
            JsonArray rawPoly    = body.getJsonArray("polygon", new JsonArray());
            List<GeoFence.Point> polygon = new ArrayList<>();
            for (int i = 0; i < rawPoly.size(); i++) {
              JsonObject pt = rawPoly.getJsonObject(i);
              polygon.add(new GeoFence.Point(pt.getDouble("lat"), pt.getDouble("lng")));
            }
            return geoFence.saveConfig(user.institutionId(), enabled, polygon,
                calLatOffset, calLngOffset);
          }).map(GeoFenceService::fenceToJson);
    });
  }

  // ── Fenced-user management ───────────────────────────────────────────────

  public Handler<RoutingContext> listFencedUsers() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      users.findById(session.userId()).compose(opt -> {
        var user = opt.orElseThrow();
        requireAdmin(user.role());
        return geoFence.listFencedUsers(user.institutionId());
      }).onSuccess(list -> {
        JsonArray arr = new JsonArray();
        list.forEach(u -> arr.add(new JsonObject()
            .put("userId",  u.userId())
            .put("addedBy", u.addedBy())
            .put("addedAt", u.addedAt() == null ? null : u.addedAt().toString())));
        okJson(ctx, new JsonObject().put("users", arr));
      }).onFailure(err -> handleFailure(ctx, err));
    };
  }

  public Handler<RoutingContext> addFencedUser() {
    return ctx -> withJson(ctx, body -> {
      Session session = SessionAuthHandler.require(ctx);
      long targetUserId = Long.parseLong(required(body, "userId"));
      return users.findById(session.userId()).compose(opt -> {
        var user = opt.orElseThrow();
        requireAdmin(user.role());
        return geoFence.addFencedUser(user.institutionId(), targetUserId, user.id());
      }).map(v -> new JsonObject().put("ok", true));
    });
  }

  public Handler<RoutingContext> removeFencedUser() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      long targetUserId = Long.parseLong(ctx.pathParam("userId"));
      users.findById(session.userId()).compose(opt -> {
        var user = opt.orElseThrow();
        requireAdmin(user.role());
        return geoFence.removeFencedUser(user.institutionId(), targetUserId);
      }).onSuccess(v -> okJson(ctx, new JsonObject().put("ok", true)))
        .onFailure(err -> handleFailure(ctx, err));
    };
  }

  // ── Geo access requests (admin review) ───────────────────────────────────

  public Handler<RoutingContext> listPendingRequests() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      users.findById(session.userId()).compose(opt -> {
        var user = opt.orElseThrow();
        requireAdmin(user.role());
        return geoFence.listPendingRequests(user.institutionId());
      }).onSuccess(list -> {
        JsonArray arr = new JsonArray();
        list.forEach(r -> arr.add(GeoFenceService.requestToJson(r)));
        okJson(ctx, new JsonObject().put("requests", arr));
      }).onFailure(err -> handleFailure(ctx, err));
    };
  }

  /** PATCH /geo-access/requests/:id — approve or reject with TOTP. */
  public Handler<RoutingContext> reviewRequest() {
    return ctx -> withJson(ctx, body -> {
      Session session = SessionAuthHandler.require(ctx);
      long requestId  = Long.parseLong(ctx.pathParam("id"));
      String status   = required(body, "status");
      String totpCode = required(body, "totpCode");
      if (!Set.of("approved", "rejected").contains(status)) {
        throw AuthException.invalid("status");
      }
      return auth.verifyTotpStepUp(session, totpCode)
          .compose(v -> users.findById(session.userId()))
          .compose(opt -> {
            var user = opt.orElseThrow();
            requireAdmin(user.role());
            return geoFence.reviewRequest(requestId, user.institutionId(), status, user.id());
          }).map(updated -> new JsonObject().put("ok", updated));
    });
  }

  // ── Watch SSE — no session auth; guarded by watchToken ──────────────────

  public Handler<RoutingContext> watchRequest() {
    return ctx -> {
      long requestId    = Long.parseLong(ctx.pathParam("id"));
      String watchToken = ctx.request().getParam("watchToken");
      if (watchToken == null || watchToken.isBlank()) {
        ctx.response().setStatusCode(400).end();
        return;
      }
      geoFence.repository().findRequestByWatchToken(watchToken).onSuccess(opt -> {
        if (opt.isEmpty() || opt.get().id() != requestId) {
          ctx.response().setStatusCode(403).end();
          return;
        }
        GeoAccessRequest req = opt.get();
        ctx.response()
            .putHeader("Content-Type", "text/event-stream")
            .putHeader("Cache-Control", "no-cache")
            .putHeader("Connection", "keep-alive")
            .setChunked(true);

        if (!"pending".equals(req.status())) {
          sendSseEvent(ctx, req.status());
          ctx.response().end();
          return;
        }

        var consumer = vertx.eventBus().<JsonObject>consumer(
            GeoFenceRepository.requestResolvedAddress(requestId));
        consumer.handler(msg -> {
          String evtStatus = msg.body().getString("status", "rejected");
          sendSseEvent(ctx, evtStatus);
          consumer.unregister();
          ctx.response().end();
        });
        ctx.request().connection().closeHandler(v -> consumer.unregister());
      }).onFailure(err -> ctx.response().setStatusCode(500).end());
    };
  }

  // ── Plumbing ─────────────────────────────────────────────────────────────

  private void withJson(RoutingContext ctx, Function<JsonObject, Future<JsonObject>> fn) {
    JsonObject body;
    try {
      body = ctx.body().asJsonObject();
      if (body == null) { badRequest(ctx, "invalid_body"); return; }
    } catch (Exception e) {
      badRequest(ctx, "invalid_json"); return;
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
    if (v == null || v.isBlank()) throw AuthException.invalid("missing_field:" + key);
    return v;
  }

  private static void okJson(RoutingContext ctx, JsonObject body) {
    ctx.response().setStatusCode(200)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }

  private static void badRequest(RoutingContext ctx, String error) {
    ctx.response().setStatusCode(400)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(new JsonObject().put("error", error)
            .put("correlationId", RequestId.of(ctx)).encode());
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
      ctx.response().setStatusCode(status)
          .putHeader("content-type", "application/json; charset=utf-8")
          .end(new JsonObject()
              .put("error",         ae.category().name().toLowerCase())
              .put("detail",        ae.detail())
              .put("correlationId", RequestId.of(ctx)).encode());
      return;
    }
    ctx.response().setStatusCode(500)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(new JsonObject().put("error", "internal").encode());
  }

  private static void sendSseEvent(RoutingContext ctx, String status) {
    JsonObject data = new JsonObject().put("status", status);
    ctx.response().write("data: " + data.encode() + "\n\n");
  }

  private static void requireAdmin(String role) {
    if (role == null || !role.toLowerCase().contains("admin")) {
      throw AuthException.security("admin_required");
    }
  }
}
