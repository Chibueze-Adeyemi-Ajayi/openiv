package com.openiv.backend.geofence;

import io.vertx.core.Future;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class GeoFenceRepository {

  private final Pool pool;

  public GeoFenceRepository(Pool pool) {
    this.pool = pool;
  }

  // ── geo_fence ─────────────────────────────────────────────────────────────

  public Future<Optional<GeoFence>> findByInstitution(long institutionId) {
    return pool.preparedQuery(
            "SELECT id, institution_id, enabled, polygon, cal_lat_offset, cal_lng_offset, created_at, updated_at "
            + "FROM geo_fence WHERE institution_id = $1")
        .execute(Tuple.of(institutionId))
        .map(rs -> rs.rowCount() == 0
            ? Optional.empty()
            : Optional.of(mapFence(rs.iterator().next())));
  }

  public Future<GeoFence> upsert(long institutionId, boolean enabled,
      List<GeoFence.Point> polygon, double calLatOffset, double calLngOffset) {
    JsonArray arr = new JsonArray();
    for (GeoFence.Point p : polygon) {
      arr.add(new JsonObject().put("lat", p.lat()).put("lng", p.lng()));
    }
    // Pass JsonArray directly — the PG reactive client has a native codec for it.
    // Avoid $n::jsonb casts: the client sends String params as OID-25 (text) which
    // has no implicit cast to jsonb and causes a prepared-statement type error.
    String sql =
        "INSERT INTO geo_fence (institution_id, enabled, polygon, cal_lat_offset, cal_lng_offset) "
        + "VALUES ($1, $2, $3, $4, $5) "
        + "ON CONFLICT (institution_id) DO UPDATE "
        + "  SET enabled = EXCLUDED.enabled, polygon = EXCLUDED.polygon, "
        + "      cal_lat_offset = EXCLUDED.cal_lat_offset, "
        + "      cal_lng_offset = EXCLUDED.cal_lng_offset, "
        + "      updated_at = now() "
        + "RETURNING id, institution_id, enabled, polygon, cal_lat_offset, cal_lng_offset, created_at, updated_at";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, enabled, arr, calLatOffset, calLngOffset))
        .map(rs -> mapFence(rs.iterator().next()));
  }

  // ── geo_fenced_users ──────────────────────────────────────────────────────

  public Future<List<GeoFencedUser>> listFencedUsers(long institutionId) {
    return pool.preparedQuery(
            "SELECT institution_id, user_id, added_by, added_at "
            + "FROM geo_fenced_users WHERE institution_id = $1 ORDER BY added_at DESC")
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          List<GeoFencedUser> out = new ArrayList<>();
          rs.forEach(r -> out.add(mapFencedUser(r)));
          return out;
        });
  }

  public Future<Void> addFencedUser(long institutionId, long userId, long addedBy) {
    return pool.preparedQuery(
            "INSERT INTO geo_fenced_users (institution_id, user_id, added_by) "
            + "VALUES ($1, $2, $3) ON CONFLICT DO NOTHING")
        .execute(Tuple.of(institutionId, userId, addedBy))
        .mapEmpty();
  }

  public Future<Void> removeFencedUser(long institutionId, long userId) {
    return pool.preparedQuery(
            "DELETE FROM geo_fenced_users WHERE institution_id = $1 AND user_id = $2")
        .execute(Tuple.of(institutionId, userId))
        .mapEmpty();
  }

  public Future<Boolean> isUserFenced(long institutionId, long userId) {
    return pool.preparedQuery(
            "SELECT 1 FROM geo_fenced_users WHERE institution_id = $1 AND user_id = $2")
        .execute(Tuple.of(institutionId, userId))
        .map(rs -> rs.rowCount() > 0);
  }

  // ── geo_access_requests ───────────────────────────────────────────────────

  private static final String REQUEST_COLS =
      "r.id, r.institution_id, r.user_id, r.session_id, r.raw_lat, r.raw_lng, "
      + "r.ip, r.user_agent, r.device_id, r.watch_token, r.status, "
      + "r.reviewed_by, r.reviewed_at, r.expires_at, r.created_at, "
      + "u.email AS user_email, u.full_name AS user_full_name";

  private static final String REQUEST_JOIN =
      "FROM geo_access_requests r JOIN users u ON u.id = r.user_id ";

  public Future<GeoAccessRequest> createRequest(long institutionId, long userId,
      long sessionId, Double rawLat, Double rawLng, String ip, String userAgent,
      String deviceId, String watchToken) {
    String sql =
        "INSERT INTO geo_access_requests "
        + "(institution_id, user_id, session_id, raw_lat, raw_lng, ip, user_agent, device_id, watch_token) "
        + "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) "
        + "RETURNING id, institution_id, user_id, session_id, raw_lat, raw_lng, "
        + "  ip, user_agent, device_id, watch_token, status, "
        + "  reviewed_by, reviewed_at, expires_at, created_at, "
        + "  null::text AS user_email, null::text AS user_full_name";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, userId, sessionId, rawLat, rawLng,
            ip, userAgent, deviceId, watchToken))
        .map(rs -> mapRequest(rs.iterator().next()));
  }

  public Future<Optional<GeoAccessRequest>> findRequestById(long id) {
    return pool.preparedQuery("SELECT " + REQUEST_COLS + REQUEST_JOIN + "WHERE r.id = $1")
        .execute(Tuple.of(id))
        .map(rs -> rs.rowCount() == 0
            ? Optional.empty()
            : Optional.of(mapRequest(rs.iterator().next())));
  }

  public Future<Optional<GeoAccessRequest>> findRequestByWatchToken(String watchToken) {
    return pool.preparedQuery("SELECT " + REQUEST_COLS + REQUEST_JOIN + "WHERE r.watch_token = $1")
        .execute(Tuple.of(watchToken))
        .map(rs -> rs.rowCount() == 0
            ? Optional.empty()
            : Optional.of(mapRequest(rs.iterator().next())));
  }

  public Future<List<GeoAccessRequest>> listPendingRequests(long institutionId) {
    return pool.preparedQuery(
            "SELECT " + REQUEST_COLS + REQUEST_JOIN
            + "WHERE r.institution_id = $1 AND r.status = 'pending' "
            + "  AND r.expires_at > now() ORDER BY r.created_at DESC")
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          List<GeoAccessRequest> out = new ArrayList<>();
          rs.forEach(r -> out.add(mapRequest(r)));
          return out;
        });
  }

  public Future<Boolean> reviewRequest(long id, long institutionId,
      String status, long reviewedBy) {
    return pool.preparedQuery(
            "UPDATE geo_access_requests SET status=$3, reviewed_by=$4, reviewed_at=now() "
            + "WHERE id=$1 AND institution_id=$2 AND status='pending' AND expires_at > now()")
        .execute(Tuple.of(id, institutionId, status, reviewedBy))
        .map(rs -> rs.rowCount() > 0);
  }

  /** Address on which new pending requests for an institution are published. */
  public static String newRequestAddress(long institutionId) {
    return "geo-access.new." + institutionId;
  }

  /** Address on which a specific request's resolution is published. */
  public static String requestResolvedAddress(long requestId) {
    return "geo-access.resolved." + requestId;
  }

  // ── Mappers ───────────────────────────────────────────────────────────────

  private static GeoFence mapFence(Row r) {
    // getJsonArray() uses the typed accessor; getValue() may return String for JSONB
    // depending on the PG client version, which would cause a ClassCastException.
    JsonArray arr = r.getJsonArray("polygon");
    if (arr == null) {
      // Fallback: some driver versions surface JSONB as raw String
      String raw = r.getString("polygon");
      arr = (raw != null && !raw.isBlank()) ? new JsonArray(raw) : new JsonArray();
    }
    List<GeoFence.Point> points = new ArrayList<>();
    for (int i = 0; i < arr.size(); i++) {
      JsonObject o = arr.getJsonObject(i);
      points.add(new GeoFence.Point(o.getDouble("lat"), o.getDouble("lng")));
    }
    return new GeoFence(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getBoolean("enabled"),
        points,
        r.getDouble("cal_lat_offset"),
        r.getDouble("cal_lng_offset"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"));
  }

  private static GeoFencedUser mapFencedUser(Row r) {
    return new GeoFencedUser(
        r.getLong("institution_id"),
        r.getLong("user_id"),
        r.getLong("added_by"),
        r.getOffsetDateTime("added_at"));
  }

  private static GeoAccessRequest mapRequest(Row r) {
    return new GeoAccessRequest(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getLong("user_id"),
        r.getLong("session_id"),
        r.getDouble("raw_lat"),
        r.getDouble("raw_lng"),
        r.getString("ip"),
        r.getString("user_agent"),
        r.getString("device_id"),
        r.getString("watch_token"),
        r.getString("status"),
        r.getLong("reviewed_by"),
        r.getOffsetDateTime("reviewed_at"),
        r.getOffsetDateTime("expires_at"),
        r.getOffsetDateTime("created_at"),
        r.getString("user_email"),
        r.getString("user_full_name"));
  }
}
