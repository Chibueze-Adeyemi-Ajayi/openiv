package com.openiv.backend.geofence;

import com.openiv.backend.auth.crypto.Tokens;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.SessionState;
import com.openiv.backend.auth.repository.SessionRepository;
import com.openiv.backend.auth.repository.UserRepository;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.eventbus.DeliveryOptions;
import io.vertx.core.json.JsonObject;

// import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Geo-fence business logic.
 *
 * <p>
 * checkGate() is called from AuthService.verifyTotp() (after TOTP succeeds) to
 * decide whether the login should proceed normally (→ AUTHENTICATED) or be held
 * pending super-admin approval (→ GEO_BLOCKED).
 *
 * <p>
 * Admins are always exempt. Every other team member is subject to the fence
 * automatically whenever the institution's geo-fence is enabled and has a valid
 * polygon — no per-user opt-in required.
 */
public final class GeoFenceService {

  private final GeoFenceRepository repo;
  private final UserRepository users;
  private final SessionRepository sessions;
  private final Vertx vertx;

  public GeoFenceService(GeoFenceRepository repo, UserRepository users,
      SessionRepository sessions, Vertx vertx) {
    this.repo = repo;
    this.users = users;
    this.sessions = sessions;
    this.vertx = vertx;
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────

  /**
   * Returns an empty Optional if access is allowed (session should transition to
   * AUTHENTICATED).
   * Returns a populated GeoAccessRequest if the user is outside the fence and has
   * been blocked
   * (session already transitioned to GEO_BLOCKED by this call).
   */
  public Future<Optional<GeoAccessRequest>> checkGate(Session session) {
    return users.findById(session.userId()).compose(opt -> {
      var user = opt.orElseThrow();
      // Admins always bypass — every other role is subject to the fence
      if (user.role() != null && user.role().toLowerCase().contains("admin")) {
        return Future.succeededFuture(Optional.empty());
      }
      long institutionId = user.institutionId();
      return repo.findByInstitution(institutionId).compose(fenceOpt -> {
        if (fenceOpt.isEmpty() || !fenceOpt.get().enabled()) {
          return Future.succeededFuture(Optional.empty());
        }
        GeoFence fence = fenceOpt.get();
        if (fence.polygon().size() < 3) {
          // Polygon not yet drawn — allow through
          return Future.succeededFuture(Optional.empty());
        }
        // Apply calibration offset to user GPS
        Double adjLat = session.lat() == null ? null
            : session.lat() + fence.calLatOffset();
        Double adjLng = session.lon() == null ? null
            : session.lon() + fence.calLngOffset();

        if (adjLat == null || adjLng == null
            || isInsidePolygon(adjLat, adjLng, fence.polygon())) {
          return Future.succeededFuture(Optional.empty());
        }
        // Outside fence — block
        return blockSession(session, institutionId, user.id(), adjLat, adjLng);
      });
    });
  }

  private Future<Optional<GeoAccessRequest>> blockSession(Session session,
      long institutionId, long userId, Double adjLat, Double adjLng) {
    String watchToken = Tokens.generate();
    return sessions.transitionState(session.id(), SessionState.GEO_BLOCKED)
        .compose(v -> repo.createRequest(
            institutionId, userId, session.id(),
            adjLat, adjLng, session.ip(), session.userAgent(), session.deviceId(),
            watchToken))
        .map(req -> {
          // Notify admin dashboard in real-time
          publishNewRequest(req);
          return Optional.of(req);
        });
  }

  // ── Admin review ──────────────────────────────────────────────────────────

  public Future<Boolean> reviewRequest(long requestId, long institutionId,
      String status, long reviewedBy) {
    return repo.reviewRequest(requestId, institutionId, status, reviewedBy)
        .compose(updated -> {
          if (!updated)
            return Future.succeededFuture(false);
          return repo.findRequestById(requestId).compose(opt -> {
            if (opt.isEmpty())
              return Future.succeededFuture(false);
            GeoAccessRequest req = opt.get();
            if ("approved".equals(status)) {
              return sessions.transitionState(req.sessionId(), SessionState.AUTHENTICATED)
                  .map(v -> {
                    publishResolved(requestId, "approved");
                    return true;
                  });
            } else {
              return sessions.transitionState(req.sessionId(), SessionState.GEO_BLOCKED)
                  .map(v -> {
                    publishResolved(requestId, "rejected");
                    return true;
                  });
            }
          });
        });
  }

  // ── Config management ─────────────────────────────────────────────────────

  public Future<GeoFence> saveConfig(long institutionId, boolean enabled,
      List<GeoFence.Point> polygon, double calLatOffset, double calLngOffset) {
    return repo.upsert(institutionId, enabled, polygon, calLatOffset, calLngOffset);
  }

  public Future<Optional<GeoFence>> getConfig(long institutionId) {
    return repo.findByInstitution(institutionId);
  }

  public Future<Void> addFencedUser(long institutionId, long userId, long addedBy) {
    return repo.addFencedUser(institutionId, userId, addedBy);
  }

  public Future<Void> removeFencedUser(long institutionId, long userId) {
    return repo.removeFencedUser(institutionId, userId);
  }

  public Future<List<GeoFencedUser>> listFencedUsers(long institutionId) {
    return repo.listFencedUsers(institutionId);
  }

  public Future<List<GeoAccessRequest>> listPendingRequests(long institutionId) {
    return repo.listPendingRequests(institutionId);
  }

  public GeoFenceRepository repository() {
    return repo;
  }

  // ── Point-in-polygon (ray casting) ────────────────────────────────────────

  static boolean isInsidePolygon(double lat, double lng, List<GeoFence.Point> polygon) {
    int n = polygon.size();
    if (n < 3)
      return false;
    boolean inside = false;
    for (int i = 0, j = n - 1; i < n; j = i++) {
      double xi = polygon.get(i).lng(), yi = polygon.get(i).lat();
      double xj = polygon.get(j).lng(), yj = polygon.get(j).lat();
      boolean intersect = ((yi > lat) != (yj > lat))
          && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect)
        inside = !inside;
    }
    return inside;
  }

  // ── Haversine distance (km) ───────────────────────────────────────────────

  public static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
    final double R = 6371.0;
    double dLat = Math.toRadians(lat2 - lat1);
    double dLng = Math.toRadians(lng2 - lng1);
    double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
            * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ── EventBus publishing ───────────────────────────────────────────────────

  private void publishNewRequest(GeoAccessRequest req) {
    JsonObject msg = requestToJson(req);
    vertx.eventBus().publish(
        GeoFenceRepository.newRequestAddress(req.institutionId()), msg,
        new DeliveryOptions().setLocalOnly(true));
  }

  private void publishResolved(long requestId, String status) {
    JsonObject msg = new JsonObject()
        .put("requestId", requestId)
        .put("status", status);
    vertx.eventBus().publish(
        GeoFenceRepository.requestResolvedAddress(requestId), msg,
        new DeliveryOptions().setLocalOnly(true));
  }

  // ── JSON serialization ────────────────────────────────────────────────────

  public static JsonObject requestToJson(GeoAccessRequest r) {
    JsonObject o = new JsonObject()
        .put("id", r.id())
        .put("userId", r.userId())
        .put("userEmail", r.userEmail())
        .put("userFullName", r.userFullName())
        .put("rawLat", r.rawLat())
        .put("rawLng", r.rawLng())
        .put("ip", r.ip())
        .put("userAgent", r.userAgent())
        .put("deviceId", r.deviceId())
        .put("status", r.status())
        .put("expiresAt", r.expiresAt() == null ? null : r.expiresAt().toString())
        .put("createdAt", r.createdAt() == null ? null : r.createdAt().toString());
    return o;
  }

  public static JsonObject fenceToJson(GeoFence f) {
    io.vertx.core.json.JsonArray pts = new io.vertx.core.json.JsonArray();
    f.polygon().forEach(p -> pts.add(new JsonObject().put("lat", p.lat()).put("lng", p.lng())));
    return new JsonObject()
        .put("enabled", f.enabled())
        .put("polygon", pts)
        .put("calLatOffset", f.calLatOffset())
        .put("calLngOffset", f.calLngOffset())
        .put("updatedAt", f.updatedAt() == null ? null : f.updatedAt().toString());
  }
}
