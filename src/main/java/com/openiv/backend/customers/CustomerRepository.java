package com.openiv.backend.customers;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class CustomerRepository {

  // Used in RETURNING clauses (mutations). Scored columns return 0 — fresh reads recompute them live.
  private static final String SELECT_COLS =
      "id, institution_id, external_id, name, email, phone, risk_score,"
      + " 0 AS risk_profile_score, 0 AS transaction_risk_score,"
      + " bvn, nin, photo, account_number, subject_type, dob, address, created_at, updated_at,"
      + " watchlisted, watchlisted_at, watchlisted_reason, last_evaluated_at";

  // Average risk score of all cases for this customer, excluding closed+cleared (innocent) ones.
  private static final String RISK_PROFILE_SUBQ =
      " COALESCE(("
      + "   SELECT ROUND(AVG(cs.risk_score))::INT FROM cases cs"
      + "   WHERE cs.customer_id = c.external_id"
      + "     AND cs.institution_id = c.institution_id"
      + "     AND NOT (cs.status = 'closed' AND cs.resolution = 'cleared')"
      + " ), 0) AS risk_profile_score";

  // Flag rate × severity multiplier, capped at 100.
  // severity multiplier = avg risk of flagged transactions / 50  (anchored at medium risk).
  private static final String TXN_RISK_SUBQ =
      " COALESCE(("
      + "   SELECT LEAST(100, ROUND("
      + "     (COUNT(*) FILTER (WHERE t2.flagged_status IS NOT NULL)::float"
      + "      / GREATEST(COUNT(*), 1)) * 100.0"
      + "     * (COALESCE(AVG(t2.risk_score) FILTER (WHERE t2.flagged_status IS NOT NULL), 50.0) / 50.0)"
      + "   ))::INT"
      + "   FROM transactions t2"
      + "   WHERE t2.customer_id = c.external_id"
      + "     AND t2.institution_id = c.institution_id"
      + " ), 0) AS transaction_risk_score";

  private static final String READ_COLS =
      "c.id, c.institution_id, c.external_id, c.name, c.email, c.phone, c.risk_score,"
      + RISK_PROFILE_SUBQ + ","
      + TXN_RISK_SUBQ + ","
      + " c.bvn, c.nin, c.photo, c.account_number, c.subject_type, c.dob, c.address,"
      + " c.created_at, c.updated_at, c.watchlisted, c.watchlisted_at, c.watchlisted_reason,"
      + " c.last_evaluated_at";

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
    String sql = "SELECT " + READ_COLS + " FROM customers c"
        + " WHERE c.institution_id = $1 AND c.external_id = $2";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapRow(it.next())) : Optional.empty();
        });
  }

  public Future<List<Customer>> list(long institutionId, String q, int pageSize, int offset) {
    String sql = "SELECT " + READ_COLS + " FROM customers c"
        + " WHERE c.institution_id = $1"
        + "   AND ($2::text IS NULL OR c.name ILIKE '%' || $2 || '%'"
        + "                        OR c.external_id ILIKE '%' || $2 || '%'"
        + "                        OR c.email ILIKE '%' || $2 || '%')"
        + " ORDER BY c.risk_score DESC, c.name ASC"
        + " LIMIT $3 OFFSET $4";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, q, pageSize, offset))
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
      java.time.LocalDate dob, String address, Long photoDocumentId) {
    String sql = "UPDATE customers SET"
        + " bvn              = COALESCE($3,  bvn),"
        + " nin              = COALESCE($4,  nin),"
        + " photo            = COALESCE($5,  photo),"
        + " account_number   = COALESCE($6,  account_number),"
        + " subject_type     = COALESCE($7,  subject_type),"
        + " dob              = COALESCE($8,  dob),"
        + " address          = COALESCE($9,  address),"
        + " photo_document_id = COALESCE($10, photo_document_id),"
        + " updated_at       = now()"
        + " WHERE institution_id = $1 AND external_id = $2"
        + " RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId, bvn, nin, photo,
            accountNumber, subjectType, dob, address, photoDocumentId))
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
        r.getInteger("risk_profile_score"),
        r.getInteger("transaction_risk_score"),
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
        r.getString("watchlisted_reason"),
        r.getOffsetDateTime("last_evaluated_at")
    );
  }

  public Future<Void> updateLastEvaluated(long institutionId, String externalId) {
    return pool.preparedQuery(
            "UPDATE customers SET last_evaluated_at = now(), updated_at = now()"
            + " WHERE institution_id = $1 AND external_id = $2")
        .execute(Tuple.of(institutionId, externalId))
        .mapEmpty();
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

  public Future<Void> updateOverallRiskScore(long institutionId, String externalId, int score) {
    return pool.preparedQuery(
            "UPDATE customers SET overall_risk_score = $3, updated_at = now()"
            + " WHERE institution_id = $1 AND external_id = $2")
        .execute(Tuple.of(institutionId, externalId, score))
        .mapEmpty();
  }

  public Future<Void> refreshScore(long institutionId, String externalId) {
    String sql = "UPDATE customers SET"
        + " overall_risk_score = LEAST(100, ROUND("
        + "   risk_score * 0.20"
        + "   + COALESCE(("
        + "       SELECT ROUND(AVG(cs.risk_score))::INT FROM cases cs"
        + "       WHERE cs.customer_id = customers.external_id"
        + "         AND cs.institution_id = customers.institution_id"
        + "         AND NOT (cs.status = 'closed' AND cs.resolution = 'cleared')"
        + "     ), 0) * 0.55"
        + "   + COALESCE(("
        + "       SELECT LEAST(100, ROUND("
        + "         (COUNT(*) FILTER (WHERE t2.flagged_status IS NOT NULL)::float"
        + "          / GREATEST(COUNT(*), 1)) * 100.0"
        + "         * (COALESCE(AVG(t2.risk_score) FILTER (WHERE t2.flagged_status IS NOT NULL), 50.0) / 50.0)"
        + "       ))::INT"
        + "       FROM transactions t2"
        + "       WHERE t2.customer_id = customers.external_id"
        + "         AND t2.institution_id = customers.institution_id"
        + "     ), 0) * 0.25"
        + " ))::INT,"
        + " updated_at = now()"
        + " WHERE institution_id = $1 AND external_id = $2";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId))
        .mapEmpty();
  }

  public Future<Void> refreshAllScores(long institutionId) {
    String sql = "UPDATE customers SET"
        + " overall_risk_score = LEAST(100, ROUND("
        + "   risk_score * 0.20"
        + "   + COALESCE(("
        + "       SELECT ROUND(AVG(cs.risk_score))::INT FROM cases cs"
        + "       WHERE cs.customer_id = customers.external_id"
        + "         AND cs.institution_id = customers.institution_id"
        + "         AND NOT (cs.status = 'closed' AND cs.resolution = 'cleared')"
        + "     ), 0) * 0.55"
        + "   + COALESCE(("
        + "       SELECT LEAST(100, ROUND("
        + "         (COUNT(*) FILTER (WHERE t2.flagged_status IS NOT NULL)::float"
        + "          / GREATEST(COUNT(*), 1)) * 100.0"
        + "         * (COALESCE(AVG(t2.risk_score) FILTER (WHERE t2.flagged_status IS NOT NULL), 50.0) / 50.0)"
        + "       ))::INT"
        + "       FROM transactions t2"
        + "       WHERE t2.customer_id = customers.external_id"
        + "         AND t2.institution_id = customers.institution_id"
        + "     ), 0) * 0.25"
        + " ))::INT,"
        + " updated_at = now()"
        + " WHERE institution_id = $1";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId))
        .mapEmpty();
  }

  public Future<List<Customer>> listHighRisk(long institutionId, int limit, int offset) {
    String sql = "SELECT " + READ_COLS + " FROM customers c"
        + " WHERE c.institution_id = $1 AND c.overall_risk_score > 75"
        + " ORDER BY c.overall_risk_score DESC"
        + " LIMIT $2 OFFSET $3";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, limit, offset))
        .map(rs -> {
          List<Customer> list = new ArrayList<>();
          rs.forEach(r -> list.add(mapRow(r)));
          return list;
        });
  }

  public Future<Long> countHighRisk(long institutionId) {
    return pool.preparedQuery(
            "SELECT COUNT(*) FROM customers WHERE institution_id = $1 AND overall_risk_score > 75")
        .execute(Tuple.of(institutionId))
        .map(rs -> rs.iterator().next().getLong(0));
  }

  /** Recomputes overall_risk_score for a single customer from live transaction + case data. */
  public Future<Void> refreshCustomerScore(long institutionId, String externalId) {
    String sql = "UPDATE customers SET"
        + " overall_risk_score = LEAST(100, ROUND("
        + "   risk_score * 0.20"
        + "   + COALESCE(("
        + "       SELECT ROUND(AVG(cs.risk_score))::INT FROM cases cs"
        + "       WHERE cs.customer_id = customers.external_id"
        + "         AND cs.institution_id = customers.institution_id"
        + "         AND NOT (cs.status = 'closed' AND cs.resolution = 'cleared')"
        + "     ), 0) * 0.55"
        + "   + COALESCE(("
        + "       SELECT LEAST(100, ROUND("
        + "         (COUNT(*) FILTER (WHERE t2.flagged_status IS NOT NULL)::float"
        + "          / GREATEST(COUNT(*), 1)) * 100.0"
        + "         * (COALESCE(AVG(t2.risk_score) FILTER (WHERE t2.flagged_status IS NOT NULL), 50.0) / 50.0)"
        + "       ))::INT"
        + "       FROM transactions t2"
        + "       WHERE t2.customer_id = customers.external_id"
        + "         AND t2.institution_id = customers.institution_id"
        + "     ), 0) * 0.25"
        + " ))::INT,"
        + " updated_at = now()"
        + " WHERE institution_id = $1 AND external_id = $2";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, externalId))
        .mapEmpty();
  }

  /** Returns the stored overall_risk_score for a customer (0 if not found). */
  public Future<Integer> getOverallRiskScore(long institutionId, String externalId) {
    return pool.preparedQuery(
            "SELECT overall_risk_score FROM customers WHERE institution_id = $1 AND external_id = $2")
        .execute(Tuple.of(institutionId, externalId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? it.next().getInteger("overall_risk_score") : 0;
        });
  }

  public Future<List<Long>> distinctInstitutionIds() {
    return pool.preparedQuery("SELECT DISTINCT institution_id FROM customers")
        .execute(Tuple.tuple())
        .map(rs -> {
          List<Long> ids = new ArrayList<>();
          rs.forEach(r -> ids.add(r.getLong(0)));
          return ids;
        });
  }
}
