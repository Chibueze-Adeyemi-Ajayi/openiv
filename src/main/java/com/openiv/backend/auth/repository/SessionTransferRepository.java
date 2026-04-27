package com.openiv.backend.auth.repository;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Tuple;
import java.util.Optional;

public final class SessionTransferRepository {

  private final Pool pool;

  public SessionTransferRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Void> create(long userId, String tokenHash, int ttlMinutes) {
    String sql = "INSERT INTO session_transfer_tokens (user_id, token_hash, expires_at) "
        + "VALUES ($1, $2, now() + ($3 || ' minutes')::interval)";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(userId, tokenHash, Integer.toString(ttlMinutes)))
        .mapEmpty();
  }

  /** Atomically marks the token used and returns the userId it belongs to. */
  public Future<Optional<Long>> consume(String tokenHash) {
    String sql = "UPDATE session_transfer_tokens "
        + "SET used_at = now() "
        + "WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() "
        + "RETURNING user_id";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(tokenHash))
        .map(rs -> rs.rowCount() == 0
            ? Optional.empty()
            : Optional.of(rs.iterator().next().getLong("user_id")));
  }
}
