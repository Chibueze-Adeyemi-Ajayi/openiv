package com.openiv.backend.documents;

import io.vertx.core.Future;
import io.vertx.core.buffer.Buffer;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.Optional;

public final class DocumentRepository {

  private final Pool pool;

  public DocumentRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Long> save(long institutionId, long uploadedBy,
      String filename, String contentType, byte[] data) {
    String sql =
        "INSERT INTO action_documents"
        + " (institution_id, uploaded_by, filename, content_type, size_bytes, data)"
        + " VALUES ($1,$2,$3,$4,$5,$6) RETURNING id";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, uploadedBy, filename, contentType,
            data.length, Buffer.buffer(data)))
        .map(rs -> rs.iterator().next().getLong("id"));
  }

  public Future<Optional<DocumentRecord>> findById(long institutionId, long id) {
    return pool.preparedQuery(
            "SELECT id, institution_id, uploaded_by, filename, content_type,"
            + " size_bytes, data, created_at"
            + " FROM action_documents WHERE id=$1 AND institution_id=$2")
        .execute(Tuple.of(id, institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(map(it.next())) : Optional.empty();
        });
  }

  private static DocumentRecord map(Row r) {
    return new DocumentRecord(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getLong("uploaded_by"),
        r.getString("filename"),
        r.getString("content_type"),
        r.getInteger("size_bytes"),
        r.getBuffer("data").getBytes(),
        r.getOffsetDateTime("created_at"));
  }
}
