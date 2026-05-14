package com.openiv.backend.customers;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class CustomerRepository {

  private static final String SELECT_COLS =
      "id, institution_id, external_id, name, email, phone, risk_score,"
      + " bvn, nin, photo, account_number, subject_type, dob, address, created_at, updated_at,"
      + " watchlisted, watchlisted_at, watchlisted_reason";

  private final Pool pool;

  public CustomerRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Customer> upsert(long institutionId, String externalId, String name) {
    String sql =
        "INSERT INTO customers (institution_id, external_id, name, updated_at)"
        + " VALUES ($1, $2, $3, now())"
        + " ON CONFLICT (institution_id, external_id) DO UPDATE"
        + " SET name = COALESCE(EXCLUDED.name, customers.name), updated_at = now()"
        + " RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId, name))
        .map(rs -> mapRow(rs.iterator().next()));
  }

  public Future<Optional<Customer>> findByExternalId(long institutionId, String externalId) {
    return pool.preparedQuery("SELECT " + SELECT_COLS + " FROM customers WHERE institution_id = $1 AND external_id = $2")
        .execute(Tuple.of(institutionId, externalId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapRow(it.next())) : Optional.empty();
        });
  }

  public Future<List<Customer>> list(long institutionId, String q, int pageSize) {
    String sql = "SELECT " + SELECT_COLS + " FROM customers"
        + " WHERE institution_id = $1"
        + "   AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%'"
        + "                        OR external_id ILIKE '%' || $2 || '%'"
        + "                        OR email ILIKE '%' || $2 || '%')"
        + " ORDER BY risk_score DESC, name ASC"
        + " LIMIT $3";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, q, pageSize))
        .map(rs -> {
          List<Customer> list = new ArrayList<>();
          rs.forEach(r -> list.add(mapRow(r)));
          return list;
        });
  }

  public Future<Void> updateRiskScore(long institutionId, String externalId, int riskScore) {
    return pool.preparedQuery(
            "UPDATE customers SET risk_score = $1, updated_at = now()"
            + " WHERE institution_id = $2 AND external_id = $3")
        .execute(Tuple.of(riskScore, institutionId, externalId))
        .mapEmpty();
  }

  public Future<Customer> updateProfile(long institutionId, String externalId,
      String bvn, String nin, String photo, String accountNumber, String subjectType,
      java.time.LocalDate dob, String address) {
    String sql = "UPDATE customers SET"
        + " bvn            = COALESCE($3, bvn),"
        + " nin            = COALESCE($4, nin),"
        + " photo          = COALESCE($5, photo),"
        + " account_number = COALESCE($6, account_number),"
        + " subject_type   = COALESCE($7, subject_type),"
        + " dob            = COALESCE($8, dob),"
        + " address        = COALESCE($9, address),"
        + " updated_at     = now()"
        + " WHERE institution_id = $1 AND external_id = $2"
        + " RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId, bvn, nin, photo, accountNumber, subjectType, dob, address))
        .map(rs -> mapRow(rs.iterator().next()));
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
        r.getString("bvn"),
        r.getString("nin"),
        r.getString("photo"),
        r.getString("account_number"),
        r.getString("subject_type"),
        r.getLocalDate("dob"),
        r.getString("address"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"),
        Boolean.TRUE.equals(r.getBoolean("watchlisted")),
        r.getOffsetDateTime("watchlisted_at"),
        r.getString("watchlisted_reason")
    );
  }

  public Future<Customer> watchlist(long institutionId, String externalId, String reason) {
    String sql = "UPDATE customers SET watchlisted = TRUE, watchlisted_at = now(), watchlisted_reason = $3,"
        + " updated_at = now() WHERE institution_id = $1 AND external_id = $2"
        + " RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId, reason))
        .map(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) throw new RuntimeException("Customer not found");
          return mapRow(it.next());
        });
  }

  public Future<Customer> unwatchlist(long institutionId, String externalId) {
    String sql = "UPDATE customers SET watchlisted = FALSE, watchlisted_at = NULL, watchlisted_reason = NULL,"
        + " updated_at = now() WHERE institution_id = $1 AND external_id = $2"
        + " RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId))
        .map(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) throw new RuntimeException("Customer not found");
          return mapRow(it.next());
        });
  }
}
