package com.openiv.backend.auth.repository;

import com.openiv.backend.auth.model.AccessRequest;
import com.openiv.backend.auth.model.AccountType;
import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

public final class AccessRequestRepository {

  private static final String SELECT_COLS =
      "id, institution_name, institution_type, contact_name, contact_email::text, "
      + "contact_phone, description, status, review_notes, reviewed_at, reviewed_by_user_id, created_at";

  private final Pool pool;

  public AccessRequestRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<AccessRequest> create(String institutionName, AccountType institutionType,
      String contactName, String contactEmail, String contactPhone, String description) {
    String sql = "INSERT INTO access_requests "
        + "(institution_name, institution_type, contact_name, contact_email, contact_phone, description) "
        + "VALUES ($1, $2, $3, $4, $5, $6) RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionName, institutionType.dbValue(),
            contactName, contactEmail, contactPhone, description))
        .map(rs -> map(rs.iterator().next()));
  }

  /** Used to throttle a single contact email from spamming requests. */
  public Future<Integer> countRecentByEmail(String contactEmail, int withinMinutes) {
    return pool.preparedQuery(
            "SELECT COUNT(*)::int AS n FROM access_requests "
            + "WHERE contact_email = $1 AND created_at > now() - ($2 || ' minutes')::interval")
        .execute(Tuple.of(contactEmail, Integer.toString(withinMinutes)))
        .map(rs -> rs.iterator().next().getInteger("n"));
  }

  private static AccessRequest map(Row r) {
    return new AccessRequest(
        r.getLong("id"),
        r.getString("institution_name"),
        AccountType.fromDb(r.getString("institution_type")),
        r.getString("contact_name"),
        r.getString("contact_email"),
        r.getString("contact_phone"),
        r.getString("description"),
        r.getString("status"),
        r.getString("review_notes"),
        r.getOffsetDateTime("reviewed_at"),
        r.getLong("reviewed_by_user_id"),
        r.getOffsetDateTime("created_at"));
  }
}
