package com.openiv.backend.beam;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class BeamRepository {

  private static final String RECORD_COLS =
      "id, institution_id, stream, idempotency_key, payload, status, received_at,"
      + " ip, user_agent, request_headers, response_code, response_body, duration_ms, bytes";

  private final Pool pool;

  public BeamRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Optional<Long>> findInstitutionByKeyHash(String hash) {
    return pool.preparedQuery(
            "SELECT institution_id FROM institution_beam_keys WHERE key_hash = $1")
        .execute(Tuple.of(hash))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(it.next().getLong("institution_id")) : Optional.empty();
        });
  }

  public void touchKeyLastUsed(long institutionId) {
    pool.preparedQuery(
            "UPDATE institution_beam_keys SET last_used_at = now() WHERE institution_id = $1")
        .execute(Tuple.of(institutionId));
  }

  public Future<Optional<BeamApiKey>> findApiKeyInfo(long institutionId) {
    return pool.preparedQuery(
            "SELECT id, institution_id, prefix, created_at, last_used_at"
            + " FROM institution_beam_keys WHERE institution_id = $1")
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapApiKey(it.next())) : Optional.empty();
        });
  }

  public Future<BeamApiKey> saveApiKey(long institutionId, String hash, String prefix) {
    String sql =
        "INSERT INTO institution_beam_keys (institution_id, key_hash, prefix)"
        + " VALUES ($1, $2, $3)"
        + " ON CONFLICT (institution_id) DO UPDATE"
        + " SET key_hash = EXCLUDED.key_hash, prefix = EXCLUDED.prefix, created_at = now(), last_used_at = NULL"
        + " RETURNING id, institution_id, prefix, created_at, last_used_at";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, hash, prefix))
        .map(rs -> mapApiKey(rs.iterator().next()));
  }

  public Future<Boolean> deleteApiKey(long institutionId) {
    return pool.preparedQuery(
            "DELETE FROM institution_beam_keys WHERE institution_id = $1")
        .execute(Tuple.of(institutionId))
        .map(rs -> rs.rowCount() > 0);
  }

  public Future<Optional<BeamRecord>> findByIdempotencyKey(long institutionId, String idempotencyKey) {
    return pool.preparedQuery(
            "SELECT " + RECORD_COLS
            + " FROM beam_records WHERE institution_id = $1 AND idempotency_key = $2")
        .execute(Tuple.of(institutionId, idempotencyKey))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapRecord(it.next())) : Optional.empty();
        });
  }

  public Future<BeamRecord> saveRecord(long institutionId, String stream,
      String idempotencyKey, String payload,
      String ip, String userAgent, String requestHeadersJson, int bytes, Integer durationMs) {
    String sql =
        "INSERT INTO beam_records"
        + " (institution_id, stream, idempotency_key, payload, ip, user_agent, request_headers, bytes, duration_ms)"
        + " VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)"
        + " RETURNING " + RECORD_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, stream, idempotencyKey, payload,
            ip, userAgent, requestHeadersJson, bytes, durationMs))
        .map(rs -> mapRecord(rs.iterator().next()));
  }

  public Future<List<BeamRecord>> listRecords(long institutionId, String stream, int limit) {
    return listRecords(institutionId, stream, null, null, 1, limit).map(BeamRecordsResult::records);
  }

  public Future<BeamRecordsResult> listRecords(long institutionId, String stream, String q, String range, int page, int pageSize) {
    StringBuilder where = new StringBuilder(" WHERE institution_id = $1");
    List<Object> params = new ArrayList<>();
    params.add(institutionId);

    int pIdx = 2;
    if (stream != null && !stream.isBlank() && !"transactions".equals(stream)) { // We often exclude transactions in the UI monitor
      where.append(" AND stream = $").append(pIdx++);
      params.add(stream);
    } else if (stream == null || stream.isBlank()) {
      where.append(" AND stream != 'transactions'"); // Keep interaction monitor clean from transactions by default if stream not specified
    }

    if (q != null && !q.isBlank()) {
      where.append(" AND (payload ILIKE $").append(pIdx);
      where.append(" OR id::text = $").append(pIdx).append(")");
      params.add("%" + q + "%");
      pIdx++;
    }

    if ("24h".equals(range)) {
      where.append(" AND received_at >= now() - interval '24 hours'");
    } else if ("7d".equals(range)) {
      where.append(" AND received_at >= now() - interval '7 days'");
    } else if ("30d".equals(range)) {
      where.append(" AND received_at >= now() - interval '30 days'");
    }

    String countSql = "SELECT COUNT(*) FROM beam_records" + where;
    
    int offset = (page - 1) * pageSize;
    String sql = "SELECT " + RECORD_COLS + " FROM beam_records" + where
        + " ORDER BY received_at DESC LIMIT $" + pIdx++ + " OFFSET $" + pIdx;
    
    List<Object> listParams = new ArrayList<>(params);
    listParams.add(pageSize);
    listParams.add(offset);

    return pool.preparedQuery(countSql).execute(Tuple.from(params))
        .compose(countRs -> {
          long total = countRs.iterator().hasNext() ? countRs.iterator().next().getLong(0) : 0;
          return pool.preparedQuery(sql).execute(Tuple.from(listParams))
              .map(rs -> {
                var list = new ArrayList<BeamRecord>();
                rs.forEach(r -> list.add(mapRecord(r)));
                return new BeamRecordsResult(List.copyOf(list), total);
              });
        });
  }

  public Future<double[][]> getHeatmap(long institutionId, String userId, String range) {
    String rangeClause = switch (range != null ? range : "90d") {
      case "24h" -> "received_at > now() - interval '24 hours'";
      case "7d"  -> "received_at > now() - interval '7 days'";
      case "30d" -> "received_at > now() - interval '30 days'";
      default    -> "received_at > now() - interval '90 days'";
    };
    String sql =
        "SELECT EXTRACT(DOW FROM received_at)::int as dow, EXTRACT(HOUR FROM received_at)::int as hour, COUNT(*) as count"
        + " FROM beam_records"
        + " WHERE institution_id = $1 AND (payload::jsonb->>'user_id' = $2 OR payload::jsonb->>'customer_id' = $2)"
        + " AND " + rangeClause
        + " GROUP BY 1, 2";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, userId))
        .map(rs -> {
          double[][] heatmap = new double[7][24];
          long max = 0;
          for (var row : rs) {
            int d = row.getInteger("dow");
            int h = row.getInteger("hour");
            long c = row.getLong("count");
            heatmap[d][h] = c;
            if (c > max) max = c;
          }
          if (max > 0) {
            for (int d = 0; d < 7; d++) {
              for (int h = 0; h < 24; h++) {
                heatmap[d][h] = heatmap[d][h] / max;
              }
            }
          }
          return heatmap;
        });
  }

  private static BeamRecord mapRecord(Row r) {
    // request_headers is JSONB; Vert.x reactive-pg returns it as JsonObject
    Object rh = r.getValue("request_headers");
    String requestHeaders = rh != null ? rh.toString() : "{}";

    Integer responseCode = r.getInteger("response_code");

    return new BeamRecord(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("stream"),
        r.getString("idempotency_key"),
        r.getString("payload"),
        r.getString("status"),
        r.getOffsetDateTime("received_at"),
        r.getString("ip"),
        r.getString("user_agent"),
        requestHeaders,
        responseCode != null ? responseCode : 201,
        r.getString("response_body"),
        r.getInteger("duration_ms"),
        r.getInteger("bytes")
    );
  }

  private static BeamApiKey mapApiKey(Row r) {
    return new BeamApiKey(
        r.getLong("id"), r.getLong("institution_id"),
        r.getString("prefix"),
        r.getOffsetDateTime("created_at"), r.getOffsetDateTime("last_used_at"));
  }
}
