package com.openiv.backend.auth.repository;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Tuple;

import java.util.Optional;

public final class TotpSecretRepository {

  private final Pool pool;

  public TotpSecretRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Optional<String>> findEnabledSecret(long userId) {
    return pool.preparedQuery(
            "SELECT secret FROM totp_secrets WHERE user_id = $1 AND enabled = TRUE")
        .execute(Tuple.of(userId))
        .map(rs -> rs.rowCount() == 0
            ? Optional.<String>empty()
            : Optional.of(rs.iterator().next().getString("secret")));
  }

  public Future<Optional<String>> findAnySecret(long userId) {
    return pool.preparedQuery(
            "SELECT secret FROM totp_secrets WHERE user_id = $1")
        .execute(Tuple.of(userId))
        .map(rs -> rs.rowCount() == 0
            ? Optional.<String>empty()
            : Optional.of(rs.iterator().next().getString("secret")));
  }

  public Future<Void> upsertDisabled(long userId, String secret) {
    String sql = "INSERT INTO totp_secrets (user_id, secret, enabled) VALUES ($1, $2, FALSE) "
        + "ON CONFLICT (user_id) DO UPDATE SET secret = EXCLUDED.secret, enabled = FALSE, "
        + "enabled_at = NULL";
    return pool.preparedQuery(sql).execute(Tuple.of(userId, secret)).mapEmpty();
  }

  public Future<Void> enable(long userId) {
    return pool.preparedQuery(
            "UPDATE totp_secrets SET enabled = TRUE, enabled_at = now() WHERE user_id = $1")
        .execute(Tuple.of(userId))
        .mapEmpty();
  }

  public Future<Boolean> isEnabled(long userId) {
    return pool.preparedQuery("SELECT enabled FROM totp_secrets WHERE user_id = $1")
        .execute(Tuple.of(userId))
        .map(rs -> rs.rowCount() > 0 && rs.iterator().next().getBoolean("enabled"));
  }
}
