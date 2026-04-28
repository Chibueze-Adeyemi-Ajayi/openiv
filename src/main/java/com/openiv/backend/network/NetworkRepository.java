package com.openiv.backend.network;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;

public final class NetworkRepository {

  private static final String UNION_SQL = """
      SELECT * FROM (
        SELECT
          'beam-' || id::text           AS id,
          'beam'                        AS source,
          'POST'                        AS method,
          '/api/v1/beam/' || stream     AS endpoint,
          stream                        AS stream,
          COALESCE(response_code, 201)  AS status_code,
          duration_ms,
          bytes,
          ip,
          COALESCE(request_headers::text, '{}') AS req_headers,
          payload                       AS req_body,
          NULL::text                    AS res_headers,
          response_body                 AS res_body,
          NULL::text                    AS error_message,
          received_at                   AS ts
        FROM beam_records
        WHERE institution_id = $1
          AND ($2 IS NULL OR received_at >= $2)

        UNION ALL

        SELECT
          'hook-' || d.id::text                            AS id,
          'webhook'                                        AS source,
          'POST'                                           AS method,
          COALESCE(e.url, 'unknown')                       AS endpoint,
          d.event_type                                     AS stream,
          COALESCE(d.response_code, 0)                     AS status_code,
          d.duration_ms,
          OCTET_LENGTH(COALESCE(d.response_body, ''))      AS bytes,
          NULL::text                                       AS ip,
          COALESCE(d.request_headers, '{}')                AS req_headers,
          d.request_body                                   AS req_body,
          COALESCE(d.response_headers, '{}')               AS res_headers,
          d.response_body                                  AS res_body,
          d.error_message,
          COALESCE(d.delivered_at, d.created_at)           AS ts
        FROM webhook_deliveries d
        JOIN webhook_endpoints  e ON e.id = d.endpoint_id
        WHERE d.institution_id = $1
          AND ($2 IS NULL OR COALESCE(d.delivered_at, d.created_at) >= $2)
      ) combined
      WHERE ($3 IS NULL OR source = $3)
        AND ($4 IS NULL OR (
              ($4 = '2xx' AND status_code >= 200 AND status_code < 300) OR
              ($4 = '4xx' AND status_code >= 400 AND status_code < 500) OR
              ($4 = '5xx' AND status_code >= 500)
            ))
        AND ($5 IS NULL OR LOWER(endpoint) LIKE '%' || LOWER($5) || '%'
                        OR LOWER(COALESCE(stream,'')) LIKE '%' || LOWER($5) || '%')
      ORDER BY ts DESC
      LIMIT $6 OFFSET $7
      """;

  private final Pool pool;

  public NetworkRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<List<NetworkEntry>> listLogs(long institutionId, NetworkFilter filter) {
    Tuple params = Tuple.of(
        institutionId,
        filter.since(),
        filter.source(),
        filter.statusClass(),
        filter.q(),
        filter.limit(),
        filter.offset()
    );
    return pool.preparedQuery(UNION_SQL).execute(params)
        .map(rs -> {
          var list = new ArrayList<NetworkEntry>();
          rs.forEach(r -> list.add(mapRow(r)));
          return List.copyOf(list);
        });
  }

  private static NetworkEntry mapRow(Row r) {
    return new NetworkEntry(
        r.getString("id"),
        r.getString("source"),
        r.getString("method"),
        r.getString("endpoint"),
        r.getString("stream"),
        r.getInteger("status_code"),
        r.getInteger("duration_ms"),
        r.getInteger("bytes"),
        r.getString("ip"),
        r.getString("req_headers"),
        r.getString("req_body"),
        r.getString("res_headers"),
        r.getString("res_body"),
        r.getString("error_message"),
        r.getOffsetDateTime("ts")
    );
  }
}
