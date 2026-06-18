package com.openiv.backend.webauthn;

import io.vertx.core.Future;
import io.vertx.core.buffer.Buffer;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class WebAuthnRepository {

  private static final String COLS =
      "id, user_id, credential_id, public_key_der, sign_count, aaguid, created_at, last_used_at";

  private final Pool pool;

  public WebAuthnRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Integer> countByUser(long userId) {
    return pool.preparedQuery("SELECT COUNT(*)::int FROM webauthn_credentials WHERE user_id = $1")
        .execute(Tuple.of(userId))
        .map(rows -> rows.iterator().next().getInteger(0));
  }

  public Future<List<WebAuthnCredential>> findByUserId(long userId) {
    return pool.preparedQuery(
            "SELECT " + COLS + " FROM webauthn_credentials WHERE user_id = $1 ORDER BY created_at")
        .execute(Tuple.of(userId))
        .map(rows -> {
          List<WebAuthnCredential> result = new ArrayList<>();
          for (Row row : rows) result.add(fromRow(row));
          return result;
        });
  }

  public Future<Optional<WebAuthnCredential>> findByCredentialId(byte[] credentialId) {
    return pool.preparedQuery(
            "SELECT " + COLS + " FROM webauthn_credentials WHERE credential_id = $1")
        .execute(Tuple.of(Buffer.buffer(credentialId)))
        .map(rows -> {
          var it = rows.iterator();
          return it.hasNext() ? Optional.of(fromRow(it.next())) : Optional.empty();
        });
  }

  public Future<Void> save(long userId, byte[] credentialId, byte[] publicKeyDer,
                           long signCount, String aaguid) {
    return pool.preparedQuery(
            "INSERT INTO webauthn_credentials (user_id, credential_id, public_key_der, sign_count, aaguid) "
                + "VALUES ($1, $2, $3, $4, $5)")
        .execute(Tuple.of(userId, Buffer.buffer(credentialId), Buffer.buffer(publicKeyDer),
            signCount, aaguid))
        .mapEmpty();
  }

  public Future<Void> updateSignCount(long id, long signCount) {
    return pool.preparedQuery(
            "UPDATE webauthn_credentials SET sign_count = $1, last_used_at = NOW() WHERE id = $2")
        .execute(Tuple.of(signCount, id))
        .mapEmpty();
  }

  /** Hard-deletes a credential. userId check prevents cross-user revocation. */
  public Future<Void> deleteById(long credentialId, long userId) {
    return pool.preparedQuery(
            "DELETE FROM webauthn_credentials WHERE id = $1 AND user_id = $2")
        .execute(Tuple.of(credentialId, userId))
        .mapEmpty();
  }

  private WebAuthnCredential fromRow(Row row) {
    Buffer credBuf = row.getBuffer("credential_id");
    Buffer keyBuf  = row.getBuffer("public_key_der");
    return new WebAuthnCredential(
        row.getLong("id"),
        row.getLong("user_id"),
        credBuf != null ? credBuf.getBytes() : new byte[0],
        keyBuf  != null ? keyBuf.getBytes()  : new byte[0],
        row.getLong("sign_count"),
        row.getString("aaguid"),
        row.getOffsetDateTime("created_at"),
        row.getOffsetDateTime("last_used_at"));
  }
}
