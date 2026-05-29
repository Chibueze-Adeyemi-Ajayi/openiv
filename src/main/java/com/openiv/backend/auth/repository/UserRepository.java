package com.openiv.backend.auth.repository;

import com.openiv.backend.auth.model.AccountType;
import com.openiv.backend.auth.model.User;
import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.List;
import java.util.Optional;

public final class UserRepository {

  private static final String BASE_SELECT_COLS =
      "id, email::text, full_name, email_verified, password_hash, password_updated_at, "
      + "must_change_password, status, role, account_type, institution_id, "
      + "failed_login_attempts, locked_until, created_at, updated_at, eureka_companion_enabled"
      + ", job_title, avatar_url, theme";

  private static final String SELECT_COLS_JOINED =
      "u.id, u.email::text, u.full_name, u.email_verified, u.password_hash, u.password_updated_at, "
      + "u.must_change_password, u.status, u.role, u.account_type, u.institution_id, "
      + "u.failed_login_attempts, u.locked_until, u.created_at, u.updated_at, u.eureka_companion_enabled, a.timezone"
      + ", u.job_title, u.avatar_url, u.theme";

  private final Pool pool;

  public UserRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Optional<User>> findByEmail(String email) {
    return pool.preparedQuery("SELECT " + SELECT_COLS_JOINED + " FROM users u LEFT JOIN aml_settings a ON u.institution_id = a.institution_id WHERE u.email = $1")
        .execute(Tuple.of(email))
        .map(rs -> rs.rowCount() == 0 ? Optional.<User>empty() : Optional.of(map(rs.iterator().next())));
  }

  public Future<Optional<User>> findById(long id) {
    return pool.preparedQuery("SELECT " + SELECT_COLS_JOINED + " FROM users u LEFT JOIN aml_settings a ON u.institution_id = a.institution_id WHERE u.id = $1")
        .execute(Tuple.of(id))
        .map(rs -> rs.rowCount() == 0 ? Optional.<User>empty() : Optional.of(map(rs.iterator().next())));
  }

  /**
   * Users that belong to the given institution, excluding those marked disabled. Used by the
   * team management page.
   */
  public Future<List<User>> listActiveByInstitution(long institutionId) {
    return pool.preparedQuery(
            "SELECT " + SELECT_COLS_JOINED + " FROM users u "
            + "LEFT JOIN aml_settings a ON u.institution_id = a.institution_id "
            + "WHERE u.institution_id = $1 AND u.status <> 'disabled' "
            + "ORDER BY u.created_at")
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          var list = new java.util.ArrayList<User>();
          rs.forEach(row -> list.add(map(row)));
          return (List<User>) list;
        });
  }

  /** Users in this institution who were directly invited and have not yet completed setup. */
  public Future<List<User>> listPendingByInstitution(long institutionId) {
    return pool.preparedQuery(
            "SELECT " + SELECT_COLS_JOINED + " FROM users u "
            + "LEFT JOIN aml_settings a ON u.institution_id = a.institution_id "
            + "WHERE u.institution_id = $1 AND u.status = 'active' AND u.must_change_password = true "
            + "ORDER BY u.created_at")
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          var list = new java.util.ArrayList<User>();
          rs.forEach(row -> list.add(map(row)));
          return (List<User>) list;
        });
  }

  public Future<User> create(String email, String fullName, String passwordHash,
      boolean mustChangePassword, String role, AccountType accountType, long institutionId,
      boolean emailVerified) {
    String sql = "INSERT INTO users "
        + "(email, full_name, password_hash, must_change_password, status, role, "
        + " account_type, institution_id, email_verified) "
        + "VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8) RETURNING " + BASE_SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.tuple()
            .addString(email)
            .addString(fullName)
            .addString(passwordHash)
            .addBoolean(mustChangePassword)
            .addString(role)
            .addString(accountType.dbValue())
            .addLong(institutionId)
            .addBoolean(emailVerified))
        .map(rs -> mapBase(rs.iterator().next()));
  }

  /** Creates a direct team-invited user, recording who invited them. */
  public Future<User> createInvited(String email, String fullName, String passwordHash,
      String role, AccountType accountType, long institutionId, long invitedByUserId) {
    String sql = "INSERT INTO users "
        + "(email, full_name, password_hash, must_change_password, status, role, "
        + " account_type, institution_id, email_verified, invited_by_user_id) "
        + "VALUES ($1, $2, $3, true, 'active', $4, $5, $6, true, $7) RETURNING " + BASE_SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.tuple()
            .addString(email)
            .addString(fullName)
            .addString(passwordHash)
            .addString(role)
            .addString(accountType.dbValue())
            .addLong(institutionId)
            .addLong(invitedByUserId))
        .map(rs -> mapBase(rs.iterator().next()));
  }

  public Future<Void> markEmailVerified(long userId) {
    return pool.preparedQuery(
            "UPDATE users SET email_verified = TRUE, updated_at = now() WHERE id = $1")
        .execute(Tuple.of(userId))
        .mapEmpty();
  }

  public Future<Void> updatePassword(long userId, String newHash, boolean mustChange) {
    return pool.preparedQuery(
            "UPDATE users SET password_hash = $1, password_updated_at = now(), "
            + "must_change_password = $2, failed_login_attempts = 0, locked_until = NULL, "
            + "updated_at = now() WHERE id = $3")
        .execute(Tuple.of(newHash, mustChange, userId))
        .mapEmpty();
  }

  public Future<Void> recordFailedLogin(long userId, int threshold, int lockMinutes) {
    String sql = "UPDATE users SET failed_login_attempts = failed_login_attempts + 1, "
        + "locked_until = CASE WHEN failed_login_attempts + 1 >= $2 "
        + "                    THEN now() + ($3 || ' minutes')::interval "
        + "                    ELSE locked_until END, "
        + "updated_at = now() WHERE id = $1";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(userId, threshold, Integer.toString(lockMinutes)))
        .mapEmpty();
  }

  public Future<Void> resetFailedLogins(long userId) {
    return pool.preparedQuery(
            "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = now() "
            + "WHERE id = $1")
        .execute(Tuple.of(userId))
        .mapEmpty();
  }

  /** Soft-remove: flip status to 'disabled' and terminate any open sessions at call site. */
  public Future<Void> disable(long userId, long institutionId) {
    return pool.preparedQuery(
            "UPDATE users SET status = 'disabled', updated_at = now() "
            + "WHERE id = $1 AND institution_id = $2")
        .execute(Tuple.of(userId, institutionId))
        .mapEmpty();
  }

  public Future<Void> updateEurekaCompanion(long userId, boolean enabled) {
    return pool.preparedQuery(
            "UPDATE users SET eureka_companion_enabled = $1, updated_at = now() WHERE id = $2")
        .execute(Tuple.of(enabled, userId))
        .mapEmpty();
  }

  private static User map(Row r) {
    return new User(
        r.getLong("id"),
        r.getString("email"),
        r.getString("full_name"),
        r.getBoolean("email_verified"),
        r.getString("password_hash"),
        r.getOffsetDateTime("password_updated_at"),
        r.getBoolean("must_change_password"),
        r.getString("status"),
        r.getString("role"),
        AccountType.fromDb(r.getString("account_type")),
        r.getLong("institution_id"),
        r.getInteger("failed_login_attempts"),
        r.getOffsetDateTime("locked_until"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"),
        r.getBoolean("eureka_companion_enabled"),
        r.getString("timezone"),
        r.getString("job_title"),
        r.getString("avatar_url"),
        r.getString("theme"));
  }

  private static User mapBase(Row r) {
    return new User(
        r.getLong("id"),
        r.getString("email"),
        r.getString("full_name"),
        r.getBoolean("email_verified"),
        r.getString("password_hash"),
        r.getOffsetDateTime("password_updated_at"),
        r.getBoolean("must_change_password"),
        r.getString("status"),
        r.getString("role"),
        AccountType.fromDb(r.getString("account_type")),
        r.getLong("institution_id"),
        r.getInteger("failed_login_attempts"),
        r.getOffsetDateTime("locked_until"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"),
        r.getBoolean("eureka_companion_enabled"),
        "Africa/Lagos", // Default for new user/institution
        r.getString("job_title"),
        r.getString("avatar_url"),
        r.getString("theme"));
  }

  public Future<User> updateProfile(long userId, String fullName, String jobTitle) {
    return pool.preparedQuery(
            "UPDATE users SET full_name = COALESCE($1, full_name), "
            + "job_title = COALESCE($2, job_title), updated_at = now() "
            + "WHERE id = $3 RETURNING " + BASE_SELECT_COLS)
        .execute(Tuple.of(fullName, jobTitle, userId))
        .map(rs -> mapBase(rs.iterator().next()));
  }

  public Future<User> updateAvatarUrl(long userId, String avatarUrl, long documentId) {
    return pool.preparedQuery(
            "UPDATE users SET avatar_url = $1, avatar_document_id = $3, updated_at = now()"
            + " WHERE id = $2 RETURNING " + BASE_SELECT_COLS)
        .execute(Tuple.of(avatarUrl, userId, documentId))
        .map(rs -> mapBase(rs.iterator().next()));
  }

  public Future<Void> updateTheme(long userId, String theme) {
    return pool.preparedQuery(
            "UPDATE users SET theme = $1, updated_at = now() WHERE id = $2")
        .execute(Tuple.of(theme, userId))
        .mapEmpty();
  }
}
