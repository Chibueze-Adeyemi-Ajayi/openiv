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
      "id, user_id, token_hash, state, expires_at, revoked_at, last_used_at, created_at";

  private final Pool pool;

  public SessionRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Session> create(long userId, String tokenHash, SessionState state,
      int ttlMinutes, String ip, String userAgent) {
    String sql = "INSERT INTO sessions (user_id, token_hash, state, ip, user_agent, expires_at) "
        + "VALUES ($1, $2, $3, $4::inet, $5, now() + ($6 || ' minutes')::interval) "
        + "RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(userId, tokenHash, state.dbValue(), ip, userAgent, Integer.toString(ttlMinutes)))
        .map(rs -> map(rs.iterator().next()));
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
    return pool.preparedQuery("UPDATE sessions SET last_used_at = now() WHERE id = $1")
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

  private static Session map(Row r) {
    return new Session(
        r.getLong("id"),
        r.getLong("user_id"),
        r.getString("token_hash"),
        SessionState.fromDb(r.getString("state")),
        r.getOffsetDateTime("expires_at"),
        r.getOffsetDateTime("revoked_at"),
        r.getOffsetDateTime("last_used_at"),
        r.getOffsetDateTime("created_at"));
  }
}
