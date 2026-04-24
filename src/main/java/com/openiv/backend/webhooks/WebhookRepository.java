package com.openiv.backend.webhooks;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

public final class WebhookRepository {

  private final Pool pool;

  public WebhookRepository(Pool pool) {
    this.pool = pool;
  }

  // ── Secret ────────────────────────────────────────────────────────────────

  public Future<WebhookSecret> findOrCreateSecret(long institutionId) {
    return pool.preparedQuery(
            "SELECT id, institution_id, secret, auto_rotate, next_rotation, created_at, updated_at"
            + " FROM webhook_secrets WHERE institution_id = $1")
        .execute(Tuple.of(institutionId))
        .compose(rs -> {
          if (rs.iterator().hasNext()) {
            return Future.succeededFuture(mapSecret(rs.iterator().next()));
          }
          String newSecret = generateSecret();
          String insertSql =
              "INSERT INTO webhook_secrets (institution_id, secret)"
              + " VALUES ($1, $2)"
              + " ON CONFLICT (institution_id) DO NOTHING"
              + " RETURNING id, institution_id, secret, auto_rotate, next_rotation, created_at, updated_at";
          return pool.preparedQuery(insertSql)
              .execute(Tuple.of(institutionId, newSecret))
              .compose(ins -> {
                if (ins.iterator().hasNext()) {
                  return Future.succeededFuture(mapSecret(ins.iterator().next()));
                }
                // Rare race — another thread inserted first; re-fetch
                return pool.preparedQuery(
                        "SELECT id, institution_id, secret, auto_rotate, next_rotation, created_at, updated_at"
                        + " FROM webhook_secrets WHERE institution_id = $1")
                    .execute(Tuple.of(institutionId))
                    .map(rs2 -> mapSecret(rs2.iterator().next()));
              });
        });
  }

  public Future<WebhookSecret> rotateSecret(long institutionId) {
    String newSecret = generateSecret();
    String sql =
        "UPDATE webhook_secrets"
        + " SET secret = $1, next_rotation = now() + interval '90 days', updated_at = now()"
        + " WHERE institution_id = $2"
        + " RETURNING id, institution_id, secret, auto_rotate, next_rotation, created_at, updated_at";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(newSecret, institutionId))
        .map(rs -> mapSecret(rs.iterator().next()));
  }

  public Future<WebhookSecret> updateAutoRotate(long institutionId, boolean autoRotate) {
    String sql =
        "UPDATE webhook_secrets SET auto_rotate = $1, updated_at = now()"
        + " WHERE institution_id = $2"
        + " RETURNING id, institution_id, secret, auto_rotate, next_rotation, created_at, updated_at";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(autoRotate, institutionId))
        .map(rs -> mapSecret(rs.iterator().next()));
  }

  // ── Endpoints ─────────────────────────────────────────────────────────────

  private static final String LIST_SQL =
      "SELECT we.id, we.institution_id, we.url, we.description, we.events, "
      + "we.status, we.created_by, we.created_at, we.updated_at, "
      + "COUNT(wd.id) FILTER (WHERE wd.status = 'delivered') AS success_count, "
      + "COUNT(wd.id) FILTER (WHERE wd.status = 'failed')   AS failure_count, "
      + "MAX(wd.delivered_at)                                AS last_delivered_at "
      + "FROM webhook_endpoints we "
      + "LEFT JOIN webhook_deliveries wd ON wd.endpoint_id = we.id "
      + "WHERE we.institution_id = $1 "
      + "GROUP BY we.id "
      + "ORDER BY we.created_at DESC";

  public Future<List<WebhookEndpoint>> listEndpoints(long institutionId) {
    return pool.preparedQuery(LIST_SQL).execute(Tuple.of(institutionId))
        .map(rs -> {
          var list = new ArrayList<WebhookEndpoint>();
          rs.forEach(r -> list.add(mapEndpoint(r)));
          return List.copyOf(list);
        });
  }

  public Future<Optional<WebhookEndpoint>> findEndpoint(long id, long institutionId) {
    String findSql =
        "SELECT we.id, we.institution_id, we.url, we.description, we.events, "
        + "we.status, we.created_by, we.created_at, we.updated_at, "
        + "COUNT(wd.id) FILTER (WHERE wd.status = 'delivered') AS success_count, "
        + "COUNT(wd.id) FILTER (WHERE wd.status = 'failed')   AS failure_count, "
        + "MAX(wd.delivered_at)                                AS last_delivered_at "
        + "FROM webhook_endpoints we "
        + "LEFT JOIN webhook_deliveries wd ON wd.endpoint_id = we.id "
        + "WHERE we.id = $1 AND we.institution_id = $2 "
        + "GROUP BY we.id";
    return pool.preparedQuery(findSql).execute(Tuple.of(id, institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapEndpoint(it.next())) : Optional.empty();
        });
  }

  public Future<WebhookEndpoint> createEndpoint(long institutionId, String url,
      String description, List<String> events, long createdBy) {
    String sql =
        "INSERT INTO webhook_endpoints (institution_id, url, description, events, created_by)"
        + " VALUES ($1,$2,$3,$4,$5) RETURNING id";
    String eventsStr = String.join(",", events);
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, url, description, eventsStr, createdBy))
        .compose(rs -> {
          long newId = rs.iterator().next().getLong("id");
          return findEndpoint(newId, institutionId)
              .map(opt -> opt.orElseThrow());
        });
  }

  public Future<Optional<WebhookEndpoint>> updateEndpoint(long id, long institutionId,
      String status, List<String> events, String description) {
    var where = new StringBuilder();
    var params = new ArrayList<Object>();

    if (status != null)      { where.append("status = $").append(params.size() + 1).append(", "); params.add(status); }
    if (events != null)      { where.append("events = $").append(params.size() + 1).append(", "); params.add(String.join(",", events)); }
    if (description != null) { where.append("description = $").append(params.size() + 1).append(", "); params.add(description); }

    if (where.isEmpty()) return findEndpoint(id, institutionId);

    String setClause = where.toString();
    if (setClause.endsWith(", ")) setClause = setClause.substring(0, setClause.length() - 2);

    params.add(id);
    params.add(institutionId);
    String sql = "UPDATE webhook_endpoints SET " + setClause + ", updated_at = now()"
        + " WHERE id = $" + (params.size() - 1) + " AND institution_id = $" + params.size();

    Tuple t = Tuple.tuple();
    params.forEach(t::addValue);
    return pool.preparedQuery(sql).execute(t)
        .compose(rs -> rs.rowCount() > 0
            ? findEndpoint(id, institutionId)
            : Future.succeededFuture(Optional.empty()));
  }

  public Future<Boolean> deleteEndpoint(long id, long institutionId) {
    return pool.preparedQuery(
            "DELETE FROM webhook_endpoints WHERE id = $1 AND institution_id = $2")
        .execute(Tuple.of(id, institutionId))
        .map(rs -> rs.rowCount() > 0);
  }

  // ── Auto-rotation ────────────────────────────────────────────────────────

  public Future<Integer> rotateExpiredSecrets() {
    return pool.preparedQuery(
            "SELECT institution_id FROM webhook_secrets"
            + " WHERE auto_rotate = true AND next_rotation <= now()")
        .execute()
        .compose(rs -> {
          var toRotate = new ArrayList<Long>();
          rs.forEach(r -> toRotate.add(r.getLong("institution_id")));
          if (toRotate.isEmpty()) return Future.succeededFuture(0);
          Future<Void> chain = Future.succeededFuture();
          for (long institutionId : toRotate) {
            final long id = institutionId;
            chain = chain.compose(v -> rotateSecret(id).mapEmpty());
          }
          return chain.map(v -> toRotate.size());
        });
  }

  // ── Deliveries ────────────────────────────────────────────────────────────

  public Future<WebhookDelivery> recordDelivery(long endpointId, long institutionId,
      String eventType, String status, Integer responseCode) {
    String sql =
        "INSERT INTO webhook_deliveries (endpoint_id, institution_id, event_type, status, response_code, delivered_at)"
        + " VALUES ($1,$2,$3,$4,$5, CASE WHEN $4 = 'delivered' THEN now() ELSE NULL END)"
        + " RETURNING id, endpoint_id, institution_id, event_type, status, response_code,"
        + " attempt_count, delivered_at, created_at";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(endpointId, institutionId, eventType, status, responseCode))
        .map(rs -> mapDelivery(rs.iterator().next()));
  }

  public Future<List<WebhookDelivery>> listDeliveries(long endpointId, long institutionId) {
    String sql =
        "SELECT id, endpoint_id, institution_id, event_type, status, response_code,"
        + " attempt_count, delivered_at, created_at"
        + " FROM webhook_deliveries"
        + " WHERE endpoint_id = $1 AND institution_id = $2"
        + " ORDER BY created_at DESC LIMIT 50";
    return pool.preparedQuery(sql).execute(Tuple.of(endpointId, institutionId))
        .map(rs -> {
          var list = new ArrayList<WebhookDelivery>();
          rs.forEach(r -> list.add(mapDelivery(r)));
          return List.copyOf(list);
        });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  static String generateSecret() {
    byte[] bytes = new byte[36];
    new SecureRandom().nextBytes(bytes);
    return "whsec_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private static WebhookSecret mapSecret(Row r) {
    return new WebhookSecret(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("secret"),
        r.getBoolean("auto_rotate"),
        r.getOffsetDateTime("next_rotation"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"));
  }

  private static WebhookEndpoint mapEndpoint(Row r) {
    String eventsStr = r.getString("events");
    List<String> events = (eventsStr == null || eventsStr.isBlank())
        ? List.of()
        : List.of(eventsStr.split(","));
    return new WebhookEndpoint(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("url"),
        r.getString("description"),
        events,
        r.getString("status"),
        r.getLong("created_by"),
        r.getLong("success_count"),
        r.getLong("failure_count"),
        r.getOffsetDateTime("last_delivered_at"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"));
  }

  private static WebhookDelivery mapDelivery(Row r) {
    return new WebhookDelivery(
        r.getLong("id"),
        r.getLong("endpoint_id"),
        r.getLong("institution_id"),
        r.getString("event_type"),
        r.getString("status"),
        r.getInteger("response_code"),
        r.getInteger("attempt_count"),
        r.getOffsetDateTime("delivered_at"),
        r.getOffsetDateTime("created_at"));
  }
}
