package com.openiv.backend.beam;

import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;

public final class OtpAlertRepository {

  private final Pool  pool;
  private final Vertx vertx;

  public OtpAlertRepository(Pool pool, Vertx vertx) {
    this.pool  = pool;
    this.vertx = vertx;
  }

  /** Event-bus address for real-time push to connected SSE clients. */
  public static String busAddress(long institutionId) {
    return "otp-alert." + institutionId;
  }

  // ── Cooldown / window helpers ─────────────────────────────────────────────

  public Future<Boolean> isInCooldown(long institutionId, String rule,
                                      String customerId, int cooldownMinutes) {
    String sql = """
        SELECT 1 FROM otp_alerts
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

  public Future<Integer> countRecent(long institutionId, String customerId,
                                     String outcomeFilter, int windowMinutes) {
    String sql = outcomeFilter != null
        ? """
          SELECT COUNT(*)::int FROM beam_records
          WHERE institution_id = $1 AND stream = 'otps'
            AND payload::jsonb->>'customerId' = $2
            AND payload::jsonb->>'outcome' IN ('failed', 'expired')
            AND received_at > now() - ($3 || ' minutes')::interval
          """
        : """
          SELECT COUNT(*)::int FROM beam_records
          WHERE institution_id = $1 AND stream = 'otps'
            AND payload::jsonb->>'customerId' = $2
            AND received_at > now() - ($3 || ' minutes')::interval
          """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, customerId, String.valueOf(windowMinutes)))
        .map(rows -> rows.iterator().next().getInteger(0));
  }

  public Future<int[]> institutionFailureRate(long institutionId, int windowMinutes) {
    String sql = """
        SELECT
          COUNT(*)::int FILTER (WHERE payload::jsonb->>'outcome' IN ('failed','expired')) AS failed,
          COUNT(*)::int AS total
        FROM beam_records
        WHERE institution_id = $1 AND stream = 'otps'
          AND received_at > now() - ($2 || ' minutes')::interval
        """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, String.valueOf(windowMinutes)))
        .map(rows -> {
          Row r = rows.iterator().next();
          return new int[]{ r.getInteger("failed"), r.getInteger("total") };
        });
  }

  public Future<Boolean> isNewDevice(long institutionId, String customerId, String deviceId) {
    String sql = """
        SELECT 1 FROM beam_records
        WHERE institution_id = $1 AND stream = 'otps'
          AND payload::jsonb->>'customerId' = $2
          AND payload::jsonb->>'deviceId'   = $3
          AND received_at < now() - interval '24 hours'
        LIMIT 1
        """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, customerId, deviceId))
        .map(rows -> !rows.iterator().hasNext());
  }

  public Future<Boolean> hasOtpHistory(long institutionId, String customerId) {
    String sql = """
        SELECT 1 FROM beam_records
        WHERE institution_id = $1 AND stream = 'otps'
          AND payload::jsonb->>'customerId' = $2
        LIMIT 1
        """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, customerId))
        .map(rows -> rows.iterator().hasNext());
  }

  /** Look up the customer's most-recent GPS location from the location beam stream. */
  public Future<double[]> lookupCustomerLocation(long institutionId, String customerId) {
    String sql = """
        SELECT payload::jsonb->>'lat' AS lat, payload::jsonb->>'lng' AS lng
        FROM beam_records
        WHERE institution_id = $1 AND stream = 'location'
          AND payload::jsonb->>'user_id' = $2
          AND payload::jsonb->>'lat' IS NOT NULL
        ORDER BY received_at DESC
        LIMIT 1
        """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, customerId))
        .map(rows -> {
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
        });
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  public Future<OtpAlert> save(long institutionId, String rule, String severity,
                               String customerId, String deviceId, String channel,
                               String otpType, int eventCount, String detail,
                               OtpPayload payload, int riskScore, String[] reasons,
                               Double customerLat, Double customerLng, Integer distanceKm) {
    String sql = """
        INSERT INTO otp_alerts
          (institution_id, rule, severity, customer_id, device_id,
           channel, otp_type, event_count, detail,
           customer_name, msisdn, ip, txn_lat, txn_lng,
           amount, beneficiary_account, device_model, transaction_id,
           risk_score, reasons, expires_at,
           customer_lat, customer_lng, distance_km)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
                $10,$11,$12,$13,$14,
                $15,$16,$17,$18,
                $19,$20, now() + interval '5 minutes',
                $21,$22,$23)
        RETURNING *
        """;

    Object[] arr = reasons != null ? reasons : new String[0];
    // Build Tuple manually to handle TEXT[] properly
    Tuple tup = Tuple.tuple();
    tup.addLong(institutionId);
    tup.addString(rule);
    tup.addString(severity);
    tup.addValue(customerId);
    tup.addValue(deviceId);
    tup.addValue(channel);
    tup.addValue(otpType);
    tup.addInteger(eventCount);
    tup.addString(detail);
    tup.addValue(payload != null ? payload.customerName()       : null);
    tup.addValue(payload != null ? payload.msisdn()             : null);
    tup.addValue(payload != null ? payload.ip()                 : null);
    tup.addValue(payload != null ? payload.lat()                : null);
    tup.addValue(payload != null ? payload.lng()                : null);
    tup.addValue(payload != null ? payload.amount()             : null);
    tup.addValue(payload != null ? payload.beneficiaryAccount() : null);
    tup.addValue(payload != null ? payload.deviceModel()        : null);
    tup.addValue(payload != null ? payload.transactionId()      : null);
    tup.addInteger(riskScore);
    tup.addValue(arr);
    tup.addValue(customerLat);
    tup.addValue(customerLng);
    tup.addValue(distanceKm);

    return pool.preparedQuery(sql)
        .execute(tup)
        .map(rows -> {
          OtpAlert alert = mapAlert(rows.iterator().next());
          // Real-time push to connected SSE clients
          vertx.eventBus().publish(busAddress(institutionId), alertToJson(alert));
          return alert;
        });
  }

  // ── Status update (agent action: release / decline) ───────────────────────

  public Future<Boolean> updateStatus(long id, long institutionId, String status) {
    return pool.preparedQuery("""
            UPDATE otp_alerts SET status = $1
            WHERE id = $2 AND institution_id = $3
              AND status IN ('pending','held')
            """)
        .execute(Tuple.of(status, id, institutionId))
        .map(rs -> rs.rowCount() > 0);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  public Future<List<OtpAlert>> recent(long institutionId) {
    return pool.preparedQuery(SELECT_ALL + " WHERE institution_id = $1 ORDER BY id DESC LIMIT 30")
        .execute(Tuple.of(institutionId))
        .map(rows -> {
          var list = new ArrayList<OtpAlert>(rows.size());
          rows.forEach(r -> list.add(mapAlert(r)));
          return list;
        });
  }

  public Future<List<OtpAlert>> since(long institutionId, long lastId) {
    return pool.preparedQuery(SELECT_ALL + " WHERE institution_id = $1 AND id > $2 ORDER BY id DESC LIMIT 50")
        .execute(Tuple.of(institutionId, lastId))
        .map(rows -> {
          var list = new ArrayList<OtpAlert>(rows.size());
          rows.forEach(r -> list.add(mapAlert(r)));
          return list;
        });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static final String SELECT_ALL = """
      SELECT id, institution_id, rule, severity, customer_id, device_id,
             channel, otp_type, event_count, detail, fired_at,
             customer_name, msisdn, ip, txn_lat, txn_lng,
             amount, beneficiary_account, device_model, transaction_id,
             risk_score, reasons, status, expires_at,
             customer_lat, customer_lng, distance_km
      FROM otp_alerts
      """;

  public static OtpAlert mapAlert(Row r) {
    String[] reasons = r.getArrayOfStrings("reasons");
    return new OtpAlert(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("rule"),
        r.getString("severity"),
        r.getString("customer_id"),
        r.getString("device_id"),
        r.getString("channel"),
        r.getString("otp_type"),
        r.getInteger("event_count"),
        r.getString("detail"),
        r.getOffsetDateTime("fired_at"),
        r.getString("customer_name"),
        r.getString("msisdn"),
        r.getString("ip"),
        r.getDouble("txn_lat"),
        r.getDouble("txn_lng"),
        r.getLong("amount"),
        r.getString("beneficiary_account"),
        r.getString("device_model"),
        r.getString("transaction_id"),
        r.getInteger("risk_score") != null ? r.getInteger("risk_score") : 50,
        reasons != null ? reasons : new String[0],
        r.getString("status"),
        r.getOffsetDateTime("expires_at"),
        r.getDouble("customer_lat"),
        r.getDouble("customer_lng"),
        r.getInteger("distance_km")
    );
  }

  public static JsonObject alertToJson(OtpAlert a) {
    var reasonsArr = new JsonArray();
    if (a.reasons() != null) for (String s : a.reasons()) reasonsArr.add(s);
    return new JsonObject()
        .put("id",                 a.id())
        .put("rule",               a.rule())
        .put("severity",           a.severity())
        .put("customerId",         a.customerId())
        .put("deviceId",           a.deviceId())
        .put("channel",            a.channel())
        .put("otpType",            a.otpType())
        .put("eventCount",         a.eventCount())
        .put("detail",             a.detail())
        .put("firedAt",            a.firedAt().toString())
        .put("customerName",       a.customerName())
        .put("msisdn",             a.msisdn())
        .put("ip",                 a.ip())
        .put("txnLat",             a.txnLat())
        .put("txnLng",             a.txnLng())
        .put("amount",             a.amount())
        .put("beneficiaryAccount", a.beneficiaryAccount())
        .put("deviceModel",        a.deviceModel())
        .put("transactionId",      a.transactionId())
        .put("riskScore",          a.riskScore())
        .put("reasons",            reasonsArr)
        .put("status",             a.status())
        .put("expiresAt",          a.expiresAt() != null ? a.expiresAt().toString() : null)
        .put("customerLat",        a.customerLat())
        .put("customerLng",        a.customerLng())
        .put("distanceKm",         a.distanceKm());
  }
}
