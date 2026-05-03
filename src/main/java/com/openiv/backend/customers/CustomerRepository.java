package com.openiv.backend.customers;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.Optional;

public final class CustomerRepository {
  private final Pool pool;

  public CustomerRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Customer> upsert(long institutionId, String externalId, String name) {
    String sql = 
        "INSERT INTO customers (institution_id, external_id, name, updated_at)" +
        " VALUES ($1, $2, $3, now())" +
        " ON CONFLICT (institution_id, external_id) DO UPDATE" +
        " SET name = COALESCE(EXCLUDED.name, customers.name), updated_at = now()" +
        " RETURNING id, institution_id, external_id, name, email, phone, risk_score, created_at, updated_at";
    
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId, name))
        .map(rs -> mapRow(rs.iterator().next()));
  }

  public Future<Optional<Customer>> findByExternalId(long institutionId, String externalId) {
    String sql = "SELECT * FROM customers WHERE institution_id = $1 AND external_id = $2";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapRow(it.next())) : Optional.empty();
        });
  }

  public Future<Void> updateRiskScore(long institutionId, String externalId, int riskScore) {
    String sql = "UPDATE customers SET risk_score = $1, updated_at = now() WHERE institution_id = $2 AND external_id = $3";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(riskScore, institutionId, externalId))
        .mapEmpty();
  }

  private static Customer mapRow(Row r) {
    return new Customer(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("external_id"),
        r.getString("name"),
        r.getString("email"),
        r.getString("phone"),
        r.getInteger("risk_score"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at")
    );
  }
}
