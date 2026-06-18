package com.openiv.backend.auth.repository;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.SessionState;
import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;
import java.util.Optional;

public final class SessionRepository {

  private static final String SELECT_COLS =
      "id, user_id, token_hash, state, expires_at, revoked_at, last_used_at, created_at, lat, lon, accuracy, device_id, ip, user_agent, socket_active, socket_id, socket_connected_at";

  private final Pool pool;

  public SessionRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Session> create(long userId, String tokenHash, SessionState state,
      int ttlMinutes, String deviceId, String ip, String userAgent, Double lat, Double lon, Double accuracy) {
    String sql = "INSERT INTO sessions (user_id, token_hash, state, device_id, ip, user_agent, expires_at, lat, lon, accuracy) "
        + "VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 || ' minutes')::interval, $8, $9, $10) "
        + "RETURNING " + SELECT_COLS;

    return pool.preparedQuery(sql)
        .execute(Tuple.of(userId, tokenHash, state.dbValue(), deviceId, ip, userAgent,
            Integer.toString(ttlMinutes), lat, lon, accuracy))
        .map(rs -> map(rs.iterator().next()));
  }

  /** Returns active AUTHENTICATED sessions for a user, newest first. */
  public Future<java.util.List<Session>> findActiveAuthenticated(long userId) {
    String sql = "SELECT " + SELECT_COLS + " FROM sessions "
        + "WHERE user_id = $1 AND state = 'authenticated' "
        + "  AND revoked_at IS NULL AND expires_at > now() "
        + "ORDER BY last_used_at DESC LIMIT 5";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(userId))
        .map(rs -> {
          var list = new java.util.ArrayList<Session>();
          rs.forEach(r -> list.add(map(r)));
          return list;
        });
  }

  public Future<Optional<Session>> findByTokenHash(String tokenHash) {
    return pool.preparedQuery(
            "SELECT " + SELECT_COLS + " FROM sessions WHERE token_hash = $1")
        .execute(Tuple.of(tokenHash))
        .map(rs -> rs.rowCount() == 0 ? Optional.<Session>empty() : Optional.of(map(rs.iterator().next())));
  }

  public Future<Void> transitionState(long sessionId, SessionState newState) {
    return pool.preparedQuery(
            "UPDATE sessions SET state = $2, last_used_at = now() WHERE id = $1")
        .execute(Tuple.of(sessionId, newState.dbValue()))
        .mapEmpty();
  }

  public Future<Void> touch(long sessionId) {
    return pool.preparedQuery(
            "UPDATE sessions SET last_used_at = now(), expires_at = now() + interval '1440 minutes' "
            + "WHERE id = $1 AND revoked_at IS NULL")
        .execute(Tuple.of(sessionId))
        .mapEmpty();
  }

  public Future<Void> revoke(long sessionId) {
    return pool.preparedQuery(
            "UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL")
        .execute(Tuple.of(sessionId))
        .mapEmpty();
  }

  public Future<Void> revokeAllForUser(long userId) {
    return pool.preparedQuery(
            "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL")
        .execute(Tuple.of(userId))
        .mapEmpty();
  }

  public Future<Void> markSocketConnected(long sessionId, String socketId) {
    return pool.preparedQuery(
            "UPDATE sessions SET socket_active = TRUE, socket_id = $2, socket_connected_at = now() WHERE id = $1")
        .execute(Tuple.of(sessionId, socketId))
        .mapEmpty();
  }

  public Future<Void> markSocketDisconnected(String socketId) {
    return pool.preparedQuery(
            "UPDATE sessions SET socket_active = FALSE WHERE socket_id = $1 AND revoked_at IS NULL")
        .execute(Tuple.of(socketId))
        .mapEmpty();
  }

  /** Called once at server startup — clears any socket_active flags left over from the previous process. */
  public Future<Void> clearStaleSocketActive() {
    return pool.preparedQuery("UPDATE sessions SET socket_active = FALSE WHERE socket_active = TRUE")
        .execute(Tuple.tuple())
        .mapEmpty();
  }

  public Future<Optional<Session>> findBySocketId(String socketId) {
    return pool.preparedQuery(
            "SELECT " + SELECT_COLS + " FROM sessions WHERE socket_id = $1 AND revoked_at IS NULL")
        .execute(Tuple.of(socketId))
        .map(rs -> rs.rowCount() == 0 ? Optional.<Session>empty() : Optional.of(map(rs.iterator().next())));
  }

  private static Session map(Row r) {
    return new Session(
        r.getLong("id"),
        r.getLong("user_id"),
        r.getString("token_hash"),
        SessionState.fromDb(r.getString("state")),
        r.getOffsetDateTime("expires_at"),
        r.getOffsetDateTime("revoked_at"),
        r.getOffsetDateTime("last_used_at"),
        r.getOffsetDateTime("created_at"),
        r.getDouble("lat"),
        r.getDouble("lon"),
        r.getDouble("accuracy"),
        r.getString("device_id"),
        r.getValue("ip") == null ? null : r.getValue("ip").toString(),
        r.getString("user_agent"),
        Boolean.TRUE.equals(r.getBoolean("socket_active")),
        r.getString("socket_id"),
        r.getOffsetDateTime("socket_connected_at"));
  }
}
