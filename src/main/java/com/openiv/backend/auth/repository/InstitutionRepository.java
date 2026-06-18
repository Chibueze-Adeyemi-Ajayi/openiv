package com.openiv.backend.auth.repository;

import com.openiv.backend.auth.model.AccountType;
import com.openiv.backend.auth.model.Institution;
import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class InstitutionRepository {

  private static final String SELECT_COLS =
      "id, name, type, status, cbn_code, address, contact_phone,"
      + " official_stamp, official_signature,"
      + " stamp_document_id, signature_document_id,"
      + " logo_url, industry, created_at, updated_at";

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

  public Future<List<Institution>> listAll() {
    return pool.preparedQuery("SELECT " + SELECT_COLS + " FROM institutions ORDER BY created_at DESC")
        .execute()
        .map(rs -> {
          List<Institution> list = new ArrayList<>();
          rs.forEach(row -> list.add(map(row)));
          return list;
        });
  }

  public Future<Institution> updateStatus(long id, String status) {
    return pool.preparedQuery(
            "UPDATE institutions SET status = $2, updated_at = now() WHERE id = $1 RETURNING " + SELECT_COLS)
        .execute(Tuple.of(id, status))
        .map(rs -> map(rs.iterator().next()));
  }

  public Future<Institution> create(String name, AccountType type) {
    return pool.preparedQuery(
            "INSERT INTO institutions (name, type) VALUES ($1, $2) RETURNING " + SELECT_COLS)
        .execute(Tuple.of(name, type.dbValue()))
        .map(rs -> map(rs.iterator().next()));
  }

  public Future<Institution> updateProfile(long id, String cbnCode, String address, String contactPhone, String industry) {
    String sql = "UPDATE institutions SET"
        + " cbn_code      = COALESCE($2, cbn_code),"
        + " address       = COALESCE($3, address),"
        + " contact_phone = COALESCE($4, contact_phone),"
        + " industry      = COALESCE($5, industry),"
        + " updated_at    = now()"
        + " WHERE id = $1 RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(id, cbnCode, address, contactPhone, industry))
        .map(rs -> map(rs.iterator().next()));
  }

  /** Update stamp/signature URLs and their document table references. */
  public Future<Institution> updateSigningCredentials(
      long id,
      String officialStamp,     Long stampDocumentId,
      String officialSignature, Long signatureDocumentId) {
    String sql = "UPDATE institutions SET"
        + " official_stamp       = COALESCE($2, official_stamp),"
        + " official_signature   = COALESCE($3, official_signature),"
        + " stamp_document_id    = COALESCE($4, stamp_document_id),"
        + " signature_document_id = COALESCE($5, signature_document_id),"
        + " updated_at           = now()"
        + " WHERE id = $1 RETURNING " + SELECT_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(id, officialStamp, officialSignature, stampDocumentId, signatureDocumentId))
        .map(rs -> map(rs.iterator().next()));
  }

  public Future<Institution> updateLogo(long id, String logoUrl) {
    return pool.preparedQuery(
            "UPDATE institutions SET logo_url = $2, updated_at = now() WHERE id = $1 RETURNING " + SELECT_COLS)
        .execute(io.vertx.sqlclient.Tuple.of(id, logoUrl))
        .map(rs -> map(rs.iterator().next()));
  }

  private static Institution map(Row r) {
    return new Institution(
        r.getLong("id"),
        r.getString("name"),
        AccountType.fromDb(r.getString("type")),
        r.getString("status"),
        r.getString("cbn_code"),
        r.getString("address"),
        r.getString("contact_phone"),
        r.getString("official_stamp"),
        r.getString("official_signature"),
        r.getLong("stamp_document_id"),
        r.getLong("signature_document_id"),
        r.getString("logo_url"),
        r.getString("industry"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"));
  }
}
