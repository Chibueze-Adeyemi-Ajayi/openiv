package com.openiv.backend.auth.repository;

import com.openiv.backend.auth.model.AccountType;
import com.openiv.backend.auth.model.Institution;
import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.Optional;

public final class InstitutionRepository {

  private static final String SELECT_COLS =
      "id, name, type, status, created_at, updated_at";

  private final Pool pool;

  public InstitutionRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Optional<Institution>> findById(long id) {
    return pool.preparedQuery("SELECT " + SELECT_COLS + " FROM institutions WHERE id = $1")
        .execute(Tuple.of(id))
        .map(rs -> rs.rowCount() == 0
            ? Optional.<Institution>empty()
            : Optional.of(map(rs.iterator().next())));
  }

  public Future<Optional<Institution>> findDefault() {
    return findByName("OpenIV (default)");
  }

  public Future<Optional<Institution>> findByName(String name) {
    return pool.preparedQuery("SELECT " + SELECT_COLS + " FROM institutions WHERE name = $1 LIMIT 1")
        .execute(Tuple.of(name))
        .map(rs -> rs.rowCount() == 0
            ? Optional.<Institution>empty()
            : Optional.of(map(rs.iterator().next())));
  }

  public Future<Institution> create(String name, AccountType type) {
    String sql = "INSERT INTO institutions (name, type) VALUES ($1, $2) RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(name, type.dbValue()))
        .map(rs -> map(rs.iterator().next()));
  }

  private static Institution map(Row r) {
    return new Institution(
        r.getLong("id"),
        r.getString("name"),
        AccountType.fromDb(r.getString("type")),
        r.getString("status"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"));
  }
}
