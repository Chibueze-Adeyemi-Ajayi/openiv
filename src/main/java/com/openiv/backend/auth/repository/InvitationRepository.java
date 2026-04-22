package com.openiv.backend.auth.repository;

import com.openiv.backend.auth.model.AccountType;
import com.openiv.backend.auth.model.Invitation;
import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.Optional;

public final class InvitationRepository {

  private static final String SELECT_COLS =
      "id, code_hash, email::text, role, account_type, institution_id, status, expires_at, "
      + "accepted_at, accepted_by_user_id, created_at";

  private final Pool pool;

  public InvitationRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Optional<Invitation>> findByCodeHash(String codeHash) {
    return pool.preparedQuery("SELECT " + SELECT_COLS + " FROM invitations WHERE code_hash = $1")
        .execute(Tuple.of(codeHash))
        .map(rs -> rs.rowCount() == 0 ? Optional.<Invitation>empty() : Optional.of(map(rs.iterator().next())));
  }

  public Future<Invitation> create(String codeHash, String email, String role,
      AccountType accountType, long institutionId, int expiresInDays) {
    String sql = "INSERT INTO invitations "
        + "(code_hash, email, role, account_type, institution_id, expires_at) "
        + "VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' days')::interval) RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(codeHash, email, role, accountType.dbValue(), institutionId,
            Integer.toString(expiresInDays)))
        .map(rs -> map(rs.iterator().next()));
  }

  public Future<Void> markAccepted(long invitationId, long userId) {
    return pool.preparedQuery(
            "UPDATE invitations SET status = 'accepted', accepted_at = now(), "
            + "accepted_by_user_id = $2 WHERE id = $1")
        .execute(Tuple.of(invitationId, userId))
        .mapEmpty();
  }

  public Future<Boolean> existsForEmail(String email) {
    return pool.preparedQuery("SELECT 1 FROM invitations WHERE email = $1 LIMIT 1")
        .execute(Tuple.of(email))
        .map(rs -> rs.rowCount() > 0);
  }

  public Future<java.util.List<Invitation>> listPendingByInstitution(long institutionId) {
    return pool.preparedQuery(
            "SELECT " + SELECT_COLS + " FROM invitations "
            + "WHERE institution_id = $1 AND status = 'pending' AND expires_at > now() "
            + "ORDER BY created_at DESC")
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          var list = new java.util.ArrayList<Invitation>();
          rs.forEach(row -> list.add(map(row)));
          return (java.util.List<Invitation>) list;
        });
  }

  public Future<Optional<Invitation>> findById(long id) {
    return pool.preparedQuery("SELECT " + SELECT_COLS + " FROM invitations WHERE id = $1")
        .execute(Tuple.of(id))
        .map(rs -> rs.rowCount() == 0
            ? Optional.<Invitation>empty()
            : Optional.of(map(rs.iterator().next())));
  }

  public Future<Void> revoke(long invitationId, long institutionId) {
    return pool.preparedQuery(
            "UPDATE invitations SET status = 'revoked' "
            + "WHERE id = $1 AND institution_id = $2 AND status = 'pending'")
        .execute(Tuple.of(invitationId, institutionId))
        .mapEmpty();
  }

  /** Replace the code_hash on a pending invitation (used by resend). */
  public Future<Void> rotateCode(long invitationId, String newCodeHash, int newExpiryDays) {
    return pool.preparedQuery(
            "UPDATE invitations SET code_hash = $1, "
            + "expires_at = now() + ($2 || ' days')::interval "
            + "WHERE id = $3 AND status = 'pending'")
        .execute(Tuple.of(newCodeHash, Integer.toString(newExpiryDays), invitationId))
        .mapEmpty();
  }

  public Future<Boolean> existsPendingForEmailInInstitution(String email, long institutionId) {
    return pool.preparedQuery(
            "SELECT 1 FROM invitations WHERE email = $1 AND institution_id = $2 "
            + "AND status = 'pending' LIMIT 1")
        .execute(Tuple.of(email, institutionId))
        .map(rs -> rs.rowCount() > 0);
  }

  private static Invitation map(Row r) {
    return new Invitation(
        r.getLong("id"),
        r.getString("code_hash"),
        r.getString("email"),
        r.getString("role"),
        AccountType.fromDb(r.getString("account_type")),
        r.getLong("institution_id"),
        r.getString("status"),
        r.getOffsetDateTime("expires_at"),
        r.getOffsetDateTime("accepted_at"),
        r.getLong("accepted_by_user_id"),
        r.getOffsetDateTime("created_at"));
  }
}
