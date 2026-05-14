package com.openiv.backend.beam;

import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Persistence layer for {@link BehavioralAlert}.
 *
 * <p>Also provides window-query helpers consumed by {@link BehavioralBeamAnalyzer} to
 * evaluate rules (cooldown checks, event counts, device-sharing queries, etc.).
 */
public final class BehavioralAlertRepository {

    private final Pool  pool;
    private final Vertx vertx;

    /** Event-bus address for real-time push to connected SSE clients. */
    public static String busAddress(long institutionId) {
        return "behavioral-alert." + institutionId;
    }

    public BehavioralAlertRepository(Pool pool, Vertx vertx) {
        this.pool  = pool;
        this.vertx = vertx;
    }

    // ── Cooldown / dedup ─────────────────────────────────────────────────────

    public Future<Boolean> isInCooldown(long institutionId, String rule,
                                        String customerId, int cooldownMinutes) {
        String sql = """
            SELECT 1 FROM behavioral_alerts
            WHERE institution_id = $1
              AND rule = $2
              AND (customer_id = $3 OR ($3::text IS NULL AND customer_id IS NULL))
              AND fired_at > now() - ($4 || ' minutes')::interval
            LIMIT 1
            """;
        return pool.preparedQuery(sql)
            .execute(Tuple.of(institutionId, rule, customerId, String.valueOf(cooldownMinutes)))
            .map(rows -> rows.iterator().hasNext());
    }

    // ── Rule params (institution-tunable) ────────────────────────────────────

    /**
     * Load all rule params for an institution whose rule_id matches the given prefix.
     * Returns a map of ruleId → params JsonObject. Missing rules mean "use defaults".
     */
    public Future<Map<String, JsonObject>> loadRuleParams(long institutionId, String ruleIdPrefix) {
        String sql = """
            SELECT rule_id, params FROM behavioral_rules
            WHERE institution_id = $1
              AND rule_id LIKE $2
              AND is_active = true
            """;
        return pool.preparedQuery(sql)
            .execute(Tuple.of(institutionId, ruleIdPrefix + "%"))
            .map(rows -> {
                Map<String, JsonObject> map = new HashMap<>();
                rows.forEach(r -> {
                    String ruleId = r.getString("rule_id");
                    Object params = r.getValue("params");
                    if (params instanceof JsonObject jo) {
                        map.put(ruleId, jo);
                    } else if (params != null) {
                        try { map.put(ruleId, new JsonObject(params.toString())); } catch (Exception ignored) {}
                    }
                });
                return map;
            });
    }

    // ── Event-count helpers (query beam_records for recent events) ────────────

    /** Count beam events for a customer in the given stream within the window. */
    public Future<Integer> countStreamEvents(long institutionId, String stream,
                                             String customerId, int windowMinutes) {
        String sql = """
            SELECT COUNT(*)::int FROM beam_records
            WHERE institution_id = $1
              AND stream = $2
              AND payload::jsonb->>'customerId' = $3
              AND received_at > now() - ($4 || ' minutes')::interval
            """;
        return pool.preparedQuery(sql)
            .execute(Tuple.of(institutionId, stream, customerId, String.valueOf(windowMinutes)))
            .map(rows -> rows.iterator().next().getInteger(0));
    }

    /** Count login attempts (all outcomes) for a customer within the window. */
    public Future<Integer> countRecentLogins(long institutionId, String customerId, int windowMinutes) {
        return countStreamEvents(institutionId, "logins", customerId, windowMinutes);
    }

    /** Count activity events for a customer within the window. */
    public Future<Integer> countRecentActivity(long institutionId, String customerId, int windowMinutes) {
        return countStreamEvents(institutionId, "activity", customerId, windowMinutes);
    }

    /** Count location pings for a customer within the window. */
    public Future<Integer> countRecentLocationPings(long institutionId, String customerId, int windowMinutes) {
        return countStreamEvents(institutionId, "location", customerId, windowMinutes);
    }

    // ── Geo helpers ───────────────────────────────────────────────────────────

    /** Last known login location for a customer (lat/lng from the login beam). */
    public Future<double[]> getLastLoginLocation(long institutionId, String customerId) {
        String sql = """
            SELECT payload::jsonb->>'lat' AS lat, payload::jsonb->>'lng' AS lng,
                   received_at
            FROM beam_records
            WHERE institution_id = $1
              AND stream = 'logins'
              AND payload::jsonb->>'customerId' = $2
              AND payload::jsonb->>'lat' IS NOT NULL
            ORDER BY received_at DESC
            OFFSET 1   -- skip the current event; we want the PREVIOUS location
            LIMIT 1
            """;
        return pool.preparedQuery(sql)
            .execute(Tuple.of(institutionId, customerId))
            .map(rows -> parseLatLng(rows));
    }

    /** Last known location from the dedicated location stream for a customer. */
    public Future<double[]> getLastLocationPing(long institutionId, String customerId) {
        String sql = """
            SELECT payload::jsonb->>'lat' AS lat, payload::jsonb->>'lng' AS lng,
                   received_at
            FROM beam_records
            WHERE institution_id = $1
              AND stream = 'location'
              AND payload::jsonb->>'customerId' = $2
              AND payload::jsonb->>'lat' IS NOT NULL
            ORDER BY received_at DESC
            OFFSET 1
            LIMIT 1
            """;
        return pool.preparedQuery(sql)
            .execute(Tuple.of(institutionId, customerId))
            .map(rows -> parseLatLng(rows));
    }

    /**
     * Returns the received_at of the previous location ping for travel-speed calculation.
     * Returns null if no prior location exists.
     */
    public Future<OffsetDateTime> getPreviousLocationTime(long institutionId, String customerId) {
        String sql = """
            SELECT received_at FROM beam_records
            WHERE institution_id = $1
              AND stream = 'location'
              AND payload::jsonb->>'customerId' = $2
            ORDER BY received_at DESC
            OFFSET 1
            LIMIT 1
            """;
        return pool.preparedQuery(sql)
            .execute(Tuple.of(institutionId, customerId))
            .map(rows -> {
                if (!rows.iterator().hasNext()) return null;
                return rows.iterator().next().getOffsetDateTime("received_at");
            });
    }

    public Future<OffsetDateTime> getPreviousLoginTime(long institutionId, String customerId) {
        String sql = """
            SELECT received_at FROM beam_records
            WHERE institution_id = $1
              AND stream = 'logins'
              AND payload::jsonb->>'customerId' = $2
            ORDER BY received_at DESC
            OFFSET 1
            LIMIT 1
            """;
        return pool.preparedQuery(sql)
            .execute(Tuple.of(institutionId, customerId))
            .map(rows -> {
                if (!rows.iterator().hasNext()) return null;
                return rows.iterator().next().getOffsetDateTime("received_at");
            });
    }

    // ── Country-history helper ────────────────────────────────────────────────

    /** Returns all distinct country codes seen for a customer in the lookback window. */
    public Future<List<String>> getSeenCountries(long institutionId, String customerId,
                                                  String stream, int lookbackDays) {
        String sql = """
            SELECT DISTINCT payload::jsonb->>'country' AS country
            FROM beam_records
            WHERE institution_id = $1
              AND stream = $2
              AND payload::jsonb->>'customerId' = $3
              AND payload::jsonb->>'country' IS NOT NULL
              AND received_at > now() - ($4 || ' days')::interval
            """;
        return pool.preparedQuery(sql)
            .execute(Tuple.of(institutionId, stream, customerId, String.valueOf(lookbackDays)))
            .map(rows -> {
                List<String> countries = new ArrayList<>();
                rows.forEach(r -> {
                    String c = r.getString("country");
                    if (c != null) countries.add(c.toUpperCase());
                });
                return countries;
            });
    }

    // ── Device helpers ────────────────────────────────────────────────────────

    /** Count how many distinct customer IDs have used this device in the window. */
    public Future<Integer> countDistinctCustomersForDevice(long institutionId, String deviceId,
                                                            int windowHours) {
        String sql = """
            SELECT COUNT(DISTINCT payload::jsonb->>'customerId')::int
            FROM beam_records
            WHERE institution_id = $1
              AND payload::jsonb->>'deviceId' = $2
              AND payload::jsonb->>'customerId' IS NOT NULL
              AND received_at > now() - ($3 || ' hours')::interval
            """;
        return pool.preparedQuery(sql)
            .execute(Tuple.of(institutionId, deviceId, String.valueOf(windowHours)))
            .map(rows -> rows.iterator().next().getInteger(0));
    }

    /** Count how many distinct device IDs a customer has used in the window. */
    public Future<Integer> countRecentDeviceChanges(long institutionId, String customerId,
                                                     int windowMinutes) {
        String sql = """
            SELECT COUNT(DISTINCT payload::jsonb->>'deviceId')::int
            FROM beam_records
            WHERE institution_id = $1
              AND (
                  payload::jsonb->>'customerId' = $2
                  OR payload::jsonb->>'userId' = $2
                  OR payload::jsonb->>'user_id' = $2
              )
              AND payload::jsonb->>'deviceId' IS NOT NULL
              AND received_at > now() - ($3 || ' minutes')::interval
            """;
        return pool.preparedQuery(sql)
            .execute(Tuple.of(institutionId, customerId, String.valueOf(windowMinutes)))
            .map(rows -> rows.iterator().next().getInteger(0));
    }

    /**
     * For DEVICE_CLONED: check if the same device appears in two distinct geo-locations
     * within the time window. Returns [lat1,lng1,lat2,lng2] if found, else null.
     */
    public Future<double[]> findConcurrentDeviceLocations(long institutionId, String deviceId,
                                                           int windowMinutes, int minDistanceKm) {
        String sql = """
            WITH recent AS (
                SELECT payload::jsonb->>'lat' AS lat, payload::jsonb->>'lng' AS lng,
                       received_at
                FROM beam_records
                WHERE institution_id = $1
                  AND payload::jsonb->>'deviceId' = $2
                  AND payload::jsonb->>'lat' IS NOT NULL
                  AND received_at > now() - ($3 || ' minutes')::interval
            )
            SELECT a.lat::double precision AS lat1, a.lng::double precision AS lng1,
                   b.lat::double precision AS lat2, b.lng::double precision AS lng2
            FROM recent a
            JOIN recent b ON true
            WHERE a.ctid < b.ctid
              AND (
                  6371 * 2 * asin(sqrt(
                      power(sin(radians((b.lat::double precision - a.lat::double precision)/2)),2) +
                      cos(radians(a.lat::double precision)) * cos(radians(b.lat::double precision)) *
                      power(sin(radians((b.lng::double precision - a.lng::double precision)/2)),2)
                  ))
              ) >= $4
            LIMIT 1
            """;
        return pool.preparedQuery(sql)
            .execute(Tuple.of(institutionId, deviceId, String.valueOf(windowMinutes), (double) minDistanceKm))
            .map(rows -> {
                if (!rows.iterator().hasNext()) return null;
                Row r = rows.iterator().next();
                return new double[]{ r.getDouble("lat1"), r.getDouble("lng1"),
                                     r.getDouble("lat2"), r.getDouble("lng2") };
            });
    }

    // ── Activity session helpers ───────────────────────────────────────────────

    /**
     * Returns the device ID and IP of the most recent activity event for a customer's
     * current session, to detect mid-session device/IP shifts.
     */
    public Future<String[]> getSessionContext(long institutionId, String customerId,
                                               String sessionId) {
        String sql = """
            SELECT payload::jsonb->>'deviceId' AS device_id,
                   payload::jsonb->>'ip' AS ip
            FROM beam_records
            WHERE institution_id = $1
              AND stream = 'activity'
              AND payload::jsonb->>'customerId' = $2
              AND ($3::text IS NULL OR payload::jsonb->>'sessionId' = $3)
            ORDER BY received_at DESC
            OFFSET 1
            LIMIT 1
            """;
        return pool.preparedQuery(sql)
            .execute(Tuple.of(institutionId, customerId, sessionId))
            .map(rows -> {
                if (!rows.iterator().hasNext()) return null;
                Row r = rows.iterator().next();
                return new String[]{ r.getString("device_id"), r.getString("ip") };
            });
    }

    // ── Usual customer location (from location stream) ────────────────────────

    public Future<double[]> lookupCustomerUsualLocation(long institutionId, String customerId) {
        String sql = """
            SELECT payload::jsonb->>'lat' AS lat, payload::jsonb->>'lng' AS lng
            FROM beam_records
            WHERE institution_id = $1
              AND stream = 'location'
              AND payload::jsonb->>'customerId' = $2
              AND payload::jsonb->>'lat' IS NOT NULL
            ORDER BY received_at DESC
            LIMIT 1
            """;
        return pool.preparedQuery(sql)
            .execute(Tuple.of(institutionId, customerId))
            .map(rows -> parseLatLng(rows));
    }

    // ── Persist alert ─────────────────────────────────────────────────────────

    public Future<BehavioralAlert> save(
        long           institutionId,
        String         beam,
        String         rule,
        String         severity,
        String         customerId,
        String         deviceId,
        String         ip,
        String         channel,
        int            eventCount,
        String         detail,
        int            riskScore,
        String[]       reasons,
        Double         lat,
        Double         lng,
        Double         customerLat,
        Double         customerLng,
        Integer        distanceKm,
        OffsetDateTime occurredAt
    ) {
        String sql = """
            INSERT INTO behavioral_alerts
              (institution_id, beam, rule, severity, customer_id, device_id,
               ip, channel, event_count, detail, risk_score, reasons,
               lat, lng, customer_lat, customer_lng, distance_km, occurred_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            RETURNING *
            """;

        Tuple tup = Tuple.tuple();
        tup.addLong(institutionId);
        tup.addString(beam);
        tup.addString(rule);
        tup.addString(severity);
        tup.addValue(customerId);
        tup.addValue(deviceId);
        tup.addValue(ip);
        tup.addValue(channel);
        tup.addInteger(eventCount);
        tup.addString(detail);
        tup.addInteger(riskScore);
        tup.addValue(reasons != null ? reasons : new String[0]);
        tup.addValue(lat);
        tup.addValue(lng);
        tup.addValue(customerLat);
        tup.addValue(customerLng);
        tup.addValue(distanceKm);
        tup.addValue(occurredAt);

        return pool.preparedQuery(sql)
            .execute(tup)
            .map(rows -> {
                BehavioralAlert alert = mapAlert(rows.iterator().next());
                vertx.eventBus().publish(busAddress(institutionId), toJson(alert));
                return alert;
            });
    }

    // ── SSE queries ───────────────────────────────────────────────────────────

    public Future<List<BehavioralAlert>> recent(long institutionId) {
        return pool.preparedQuery(SELECT_ALL + " WHERE institution_id=$1 ORDER BY id DESC LIMIT 30")
            .execute(Tuple.of(institutionId))
            .map(rows -> {
                var list = new ArrayList<BehavioralAlert>(rows.size());
                rows.forEach(r -> list.add(mapAlert(r)));
                return list;
            });
    }

    public Future<List<BehavioralAlert>> since(long institutionId, long lastId) {
        return pool.preparedQuery(SELECT_ALL + " WHERE institution_id=$1 AND id>$2 ORDER BY id DESC LIMIT 50")
            .execute(Tuple.of(institutionId, lastId))
            .map(rows -> {
                var list = new ArrayList<BehavioralAlert>(rows.size());
                rows.forEach(r -> list.add(mapAlert(r)));
                return list;
            });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static final String SELECT_ALL = """
        SELECT id, institution_id, beam, rule, severity, customer_id, device_id,
               ip, channel, event_count, detail, risk_score, reasons, status,
               lat, lng, customer_lat, customer_lng, distance_km,
               occurred_at, fired_at, expires_at
        FROM behavioral_alerts
        """;

    public static BehavioralAlert mapAlert(Row r) {
        return new BehavioralAlert(
            r.getLong("id"),
            r.getLong("institution_id"),
            r.getString("beam"),
            r.getString("rule"),
            r.getString("severity"),
            r.getString("customer_id"),
            r.getString("device_id"),
            r.getString("ip"),
            r.getString("channel"),
            r.getInteger("event_count") != null ? r.getInteger("event_count") : 1,
            r.getString("detail"),
            r.getInteger("risk_score") != null ? r.getInteger("risk_score") : 0,
            r.getArrayOfStrings("reasons"),
            r.getString("status"),
            r.getDouble("lat"),
            r.getDouble("lng"),
            r.getDouble("customer_lat"),
            r.getDouble("customer_lng"),
            r.getInteger("distance_km"),
            r.getOffsetDateTime("occurred_at"),
            r.getOffsetDateTime("fired_at"),
            r.getOffsetDateTime("expires_at")
        );
    }

    public static JsonObject toJson(BehavioralAlert a) {
        var reasonsArr = new JsonArray();
        if (a.reasons() != null) for (String s : a.reasons()) reasonsArr.add(s);
        return new JsonObject()
            .put("id",          a.id())
            .put("beam",        a.beam())
            .put("rule",        a.rule())
            .put("severity",    a.severity())
            .put("customerId",  a.customerId())
            .put("deviceId",    a.deviceId())
            .put("ip",          a.ip())
            .put("channel",     a.channel())
            .put("eventCount",  a.eventCount())
            .put("detail",      a.detail())
            .put("riskScore",   a.riskScore())
            .put("reasons",     reasonsArr)
            .put("status",      a.status())
            .put("lat",         a.lat())
            .put("lng",         a.lng())
            .put("distanceKm",  a.distanceKm())
            .put("occurredAt",  a.occurredAt() != null ? a.occurredAt().toString() : null)
            .put("firedAt",     a.firedAt() != null ? a.firedAt().toString() : null);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private static double[] parseLatLng(io.vertx.sqlclient.RowSet<Row> rows) {
        if (!rows.iterator().hasNext()) return null;
        Row r = rows.iterator().next();
        String latStr = r.getString("lat");
        String lngStr = r.getString("lng");
        if (latStr == null || lngStr == null) return null;
        try {
            return new double[]{ Double.parseDouble(latStr), Double.parseDouble(lngStr) };
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
