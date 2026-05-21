package com.openiv.backend.auth.repository;

import com.openiv.backend.auth.model.AccessRequest;
import com.openiv.backend.auth.model.AccountType;
import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class AccessRequestRepository {

  private static final String SELECT_COLS =
      "id, institution_name, institution_type, contact_name, contact_email::text, "
      + "contact_phone, job_title, description, status, review_notes, reviewed_at, "
      + "reviewed_by_user_id, created_at";

  private final Pool pool;

  public AccessRequestRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<AccessRequest> create(String institutionName, AccountType institutionType,
      String contactName, String contactEmail, String contactPhone, String jobTitle,
      String description) {
    String sql = "INSERT INTO access_requests "
        + "(institution_name, institution_type, contact_name, contact_email, contact_phone, "
        + "job_title, description) "
        + "VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionName, institutionType.dbValue(),
            contactName, contactEmail, contactPhone, jobTitle, description))
        .map(rs -> map(rs.iterator().next()));
  }

  public Future<Optional<AccessRequest>> findById(long id) {
    return pool.preparedQuery("SELECT " + SELECT_COLS + " FROM access_requests WHERE id = $1")
        .execute(Tuple.of(id))
        .map(rs -> rs.rowCount() == 0 ? Optional.empty() : Optional.of(map(rs.iterator().next())));
  }

  public Future<List<AccessRequest>> listByStatus(String status) {
    if (status == null) {
      return pool.preparedQuery("SELECT " + SELECT_COLS + " FROM access_requests ORDER BY created_at DESC")
          .execute()
          .map(rs -> {
            List<AccessRequest> list = new ArrayList<>();
            rs.forEach(row -> list.add(map(row)));
            return list;
          });
    }
    return pool.preparedQuery("SELECT " + SELECT_COLS + " FROM access_requests WHERE status = $1 ORDER BY created_at DESC")
        .execute(Tuple.of(status))
        .map(rs -> {
          List<AccessRequest> list = new ArrayList<>();
          rs.forEach(row -> list.add(map(row)));
          return list;
        });
  }

  public Future<AccessRequest> markApproved(long id, long reviewerId, String notes) {
    String sql = "UPDATE access_requests SET status = 'approved', reviewed_by_user_id = $2, "
        + "reviewed_at = now(), review_notes = $3 WHERE id = $1 RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(id, reviewerId, notes))
        .map(rs -> map(rs.iterator().next()));
  }

  public Future<AccessRequest> markRejected(long id, long reviewerId, String notes) {
    String sql = "UPDATE access_requests SET status = 'rejected', reviewed_by_user_id = $2, "
        + "reviewed_at = now(), review_notes = $3 WHERE id = $1 RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(id, reviewerId, notes))
        .map(rs -> map(rs.iterator().next()));
  }

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
        r.getString("job_title"),
        r.getString("description"),
        r.getString("status"),
        r.getString("review_notes"),
        r.getOffsetDateTime("reviewed_at"),
        r.getLong("reviewed_by_user_id"),
        r.getOffsetDateTime("created_at"));
  }
}
