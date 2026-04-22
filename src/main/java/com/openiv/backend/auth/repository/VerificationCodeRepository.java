package com.openiv.backend.auth.repository;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Tuple;

public final class VerificationCodeRepository {

  private final Pool pool;

  public VerificationCodeRepository(Pool pool) {
    this.pool = pool;
  }

  /**
   * Invalidate any outstanding codes for (email, purpose), then insert a fresh one with the
   * given TTL. Single-flight by design: a new code shreds the old to prevent code stacking.
   */
  public Future<Void> replace(long userId, String email, String codeHash, String purpose, int ttlMinutes) {
    String invalidate = "UPDATE verification_codes SET consumed_at = now() "
        + "WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL";
    String insert = "INSERT INTO verification_codes (user_id, email, code_hash, purpose, expires_at) "
        + "VALUES ($1, $2, $3, $4, now() + ($5 || ' minutes')::interval)";
    return pool.preparedQuery(invalidate)
        .execute(Tuple.of(email, purpose))
        .compose(ignored -> pool.preparedQuery(insert)
            .execute(Tuple.of(userId, email, codeHash, purpose, Integer.toString(ttlMinutes))))
        .mapEmpty();
  }

  /**
   * Atomic consume: matches on (email, purpose, code_hash) where still active; sets consumed_at.
   * Returns the user_id if a row was updated, empty otherwise. Also bumps the attempt counter on
   * any active row so operators can see brute-force patterns.
   */
  public Future<java.util.Optional<Long>> consume(String email, String codeHash, String purpose) {
    String sql = "UPDATE verification_codes SET consumed_at = now() "
        + "WHERE email = $1 AND purpose = $2 AND code_hash = $3 "
        + "  AND consumed_at IS NULL AND expires_at > now() "
        + "RETURNING user_id";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(email, purpose, codeHash))
        .map(rs -> {
          if (rs.rowCount() == 0) {
            return java.util.Optional.<Long>empty();
          }
          Long uid = rs.iterator().next().getLong("user_id");
          return java.util.Optional.ofNullable(uid);
        })
        .compose(result -> recordAttempt(email, purpose).map(v -> result));
  }

  private Future<Void> recordAttempt(String email, String purpose) {
    return pool.preparedQuery(
            "UPDATE verification_codes SET attempts = attempts + 1 "
            + "WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL")
        .execute(Tuple.of(email, purpose))
        .mapEmpty();
  }
}
