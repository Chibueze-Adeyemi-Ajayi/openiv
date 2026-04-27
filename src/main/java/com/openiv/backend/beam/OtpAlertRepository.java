package com.openiv.backend.beam;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;

public final class OtpAlertRepository {

  private final Pool pool;

  public OtpAlertRepository(Pool pool) {
    this.pool = pool;
  }

  /**
   * True if the same rule + customer was already alerted within {@code cooldownMinutes}.
   * Pass {@code null} customerId for institution-wide rules (e.g. VELOCITY_SPIKE).
   */
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

  /**
   * Count OTP beam records for a customer in the last {@code windowMinutes}.
   * Pass {@code "failed"} for {@code outcomeFilter} to count only failures,
   * or {@code null} to count all outcomes.
   */
  public Future<Integer> countRecent(long institutionId, String customerId,
                                     String outcomeFilter, int windowMinutes) {
    String sql = outcomeFilter != null
        ? """
          SELECT COUNT(*)::int
          FROM beam_records
          WHERE institution_id = $1
            AND stream = 'otps'
            AND payload::jsonb->>'customerId' = $2
            AND payload::jsonb->>'outcome' IN ('failed', 'expired')
            AND received_at > now() - ($3 || ' minutes')::interval
          """
        : """
          SELECT COUNT(*)::int
          FROM beam_records
          WHERE institution_id = $1
            AND stream = 'otps'
            AND payload::jsonb->>'customerId' = $2
            AND received_at > now() - ($3 || ' minutes')::interval
          """;

    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, customerId, String.valueOf(windowMinutes)))
        .map(rows -> rows.iterator().next().getInteger(0));
  }

  /**
   * Returns [failedCount, totalCount] for the institution in the last {@code windowMinutes}.
   */
  public Future<int[]> institutionFailureRate(long institutionId, int windowMinutes) {
    String sql = """
        SELECT
          COUNT(*)::int FILTER (WHERE payload::jsonb->>'outcome' IN ('failed','expired')) AS failed,
          COUNT(*)::int AS total
        FROM beam_records
        WHERE institution_id = $1
          AND stream = 'otps'
          AND received_at > now() - ($2 || ' minutes')::interval
        """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, String.valueOf(windowMinutes)))
        .map(rows -> {
          Row r = rows.iterator().next();
          return new int[]{ r.getInteger("failed"), r.getInteger("total") };
        });
  }

  /**
   * True if this deviceId has NOT been seen for this customer before the 24-hour lookback window
   * (i.e. it is truly new and not just new-today).
   */
  public Future<Boolean> isNewDevice(long institutionId, String customerId, String deviceId) {
    String sql = """
        SELECT 1 FROM beam_records
        WHERE institution_id = $1
          AND stream = 'otps'
          AND payload::jsonb->>'customerId' = $2
          AND payload::jsonb->>'deviceId'   = $3
          AND received_at < now() - interval '24 hours'
        LIMIT 1
        """;
    // Row found = device existed before → NOT new. No rows = genuinely new device.
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, customerId, deviceId))
        .map(rows -> !rows.iterator().hasNext());
  }

  /**
   * True if this customer has any prior OTP history at all (skip alert for brand-new customers).
   */
  public Future<Boolean> hasOtpHistory(long institutionId, String customerId) {
    String sql = """
        SELECT 1 FROM beam_records
        WHERE institution_id = $1
          AND stream = 'otps'
          AND payload::jsonb->>'customerId' = $2
        LIMIT 1
        """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, customerId))
        .map(rows -> rows.iterator().hasNext());
  }

  public Future<OtpAlert> save(long institutionId, String rule, String severity,
                               String customerId, String deviceId, String channel,
                               String otpType, int eventCount, String detail) {
    String sql = """
        INSERT INTO otp_alerts
          (institution_id, rule, severity, customer_id, device_id,
           channel, otp_type, event_count, detail)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, institution_id, rule, severity, customer_id, device_id,
                  channel, otp_type, event_count, detail, fired_at
        """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, rule, severity, customerId, deviceId,
            channel, otpType, eventCount, detail))
        .map(rows -> mapAlert(rows.iterator().next()));
  }

  public Future<List<OtpAlert>> recent(long institutionId) {
    String sql = """
        SELECT id, institution_id, rule, severity, customer_id, device_id,
               channel, otp_type, event_count, detail, fired_at
        FROM otp_alerts
        WHERE institution_id = $1
        ORDER BY id DESC
        LIMIT 30
        """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId))
        .map(rows -> {
          var list = new ArrayList<OtpAlert>(rows.size());
          rows.forEach(r -> list.add(mapAlert(r)));
          return list;
        });
  }

  public Future<List<OtpAlert>> since(long institutionId, long lastId) {
    String sql = """
        SELECT id, institution_id, rule, severity, customer_id, device_id,
               channel, otp_type, event_count, detail, fired_at
        FROM otp_alerts
        WHERE institution_id = $1 AND id > $2
        ORDER BY id DESC
        LIMIT 50
        """;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, lastId))
        .map(rows -> {
          var list = new ArrayList<OtpAlert>(rows.size());
          rows.forEach(r -> list.add(mapAlert(r)));
          return list;
        });
  }

  private static OtpAlert mapAlert(Row r) {
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
        r.getOffsetDateTime("fired_at")
    );
  }
}
