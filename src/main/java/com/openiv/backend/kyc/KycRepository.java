package com.openiv.backend.kyc;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class KycRepository {

  private final Pool pool;

  public KycRepository(Pool pool) {
    this.pool = pool;
  }

  // ── Config ────────────────────────────────────────────────────────────────

  public Future<Optional<KycConfig>> findConfig(long institutionId) {
    String sql =
        "SELECT id, institution_id, lookup_url, lookup_api_key, lookup_timeout,"
        + " listener_url, listener_api_key, created_at, updated_at"
        + " FROM kyc_config WHERE institution_id = $1";
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapConfig(it.next())) : Optional.empty();
        });
  }

  public Future<KycConfig> saveConfig(long institutionId,
      String lookupUrl, String lookupApiKey,
      Integer lookupTimeout,
      String listenerUrl, String listenerApiKey) {
    String sql =
        "INSERT INTO kyc_config (institution_id, lookup_url, lookup_api_key, lookup_timeout,"
        + " listener_url, listener_api_key)"
        + " VALUES ($1, $2, $3, COALESCE($4, 10), $5, $6)"
        + " ON CONFLICT (institution_id) DO UPDATE SET"
        + "   lookup_url       = COALESCE(EXCLUDED.lookup_url,    kyc_config.lookup_url),"
        + "   lookup_api_key   = COALESCE(EXCLUDED.lookup_api_key, kyc_config.lookup_api_key),"
        + "   lookup_timeout   = COALESCE(EXCLUDED.lookup_timeout, kyc_config.lookup_timeout),"
        + "   listener_url     = COALESCE(EXCLUDED.listener_url,   kyc_config.listener_url),"
        + "   listener_api_key = COALESCE(EXCLUDED.listener_api_key, kyc_config.listener_api_key),"
        + "   updated_at       = now()"
        + " RETURNING id, institution_id, lookup_url, lookup_api_key, lookup_timeout,"
        + "   listener_url, listener_api_key, created_at, updated_at";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, lookupUrl, lookupApiKey, lookupTimeout, listenerUrl, listenerApiKey))
        .map(rs -> mapConfig(rs.iterator().next()));
  }

  // ── Lookup log ────────────────────────────────────────────────────────────

  public Future<KycLookupLog> saveLog(long institutionId, String customerRef, String triggerSource,
      String status, Integer responseCode, Integer durationMs,
      Integer kycTier, String kycStatus, String errorMessage) {
    String sql =
        "INSERT INTO kyc_lookup_log"
        + " (institution_id, customer_ref, trigger_source, status, response_code,"
        + "  duration_ms, kyc_tier, kyc_status, error_message)"
        + " VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
        + " RETURNING id, institution_id, customer_ref, trigger_source, status,"
        + "   response_code, duration_ms, kyc_tier, kyc_status, error_message, performed_at";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, customerRef, triggerSource, status,
            responseCode, durationMs, kycTier, kycStatus, errorMessage))
        .map(rs -> mapLog(rs.iterator().next()));
  }

  public Future<List<KycLookupLog>> listLogs(long institutionId) {
    String sql =
        "SELECT id, institution_id, customer_ref, trigger_source, status,"
        + " response_code, duration_ms, kyc_tier, kyc_status, error_message, performed_at"
        + " FROM kyc_lookup_log WHERE institution_id = $1"
        + " ORDER BY performed_at DESC LIMIT 200";
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId))
        .map(rs -> {
          var list = new ArrayList<KycLookupLog>();
          rs.forEach(r -> list.add(mapLog(r)));
          return List.copyOf(list);
        });
  }

  // ── Mappers ───────────────────────────────────────────────────────────────

  private static KycConfig mapConfig(Row r) {
    return new KycConfig(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("lookup_url"),
        r.getString("lookup_api_key"),
        r.getInteger("lookup_timeout"),
        r.getString("listener_url"),
        r.getString("listener_api_key"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"));
  }

  private static KycLookupLog mapLog(Row r) {
    return new KycLookupLog(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("customer_ref"),
        r.getString("trigger_source"),
        r.getString("status"),
        r.getInteger("response_code"),
        r.getInteger("duration_ms"),
        r.getInteger("kyc_tier"),
        r.getString("kyc_status"),
        r.getString("error_message"),
        r.getOffsetDateTime("performed_at"));
  }
}
