package com.openiv.backend.documents;

import io.vertx.core.Future;
import io.vertx.core.buffer.Buffer;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.Optional;

public final class DocumentRepository {

  private static final String DOC_COLS =
      "id, institution_id, uploaded_by, cloudinary_public_id, url, filename,"
      + " content_type, size_bytes, resource_type, format, width, height,"
      + " entity_type, entity_id, created_at";

  private final Pool pool;

  public DocumentRepository(Pool pool) {
    this.pool = pool;
  }

  // ── documents table ──────────────────────────────────────────────────────

  /** Persist a Cloudinary upload result and return the full Document row. */
  public Future<Document> saveDocument(
      long institutionId, Long uploadedBy,
      String cloudinaryPublicId, String url,
      String filename, String contentType, long sizeBytes,
      String resourceType, String format, int width, int height,
      String entityType, String entityId) {
    String sql =
        "INSERT INTO documents"
        + " (institution_id, uploaded_by, cloudinary_public_id, url, filename,"
        + "  content_type, size_bytes, resource_type, format, width, height,"
        + "  entity_type, entity_id)"
        + " VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)"
        + " RETURNING " + DOC_COLS;
    return pool.preparedQuery(sql)
        .execute(Tuple.of(
            institutionId, uploadedBy, cloudinaryPublicId, url,
            filename, contentType, sizeBytes,
            resourceType, format, width, height,
            entityType, entityId))
        .map(rs -> mapDoc(rs.iterator().next()));
  }

  public Future<Optional<Document>> findDocumentById(long institutionId, long id) {
    return pool.preparedQuery(
            "SELECT " + DOC_COLS + " FROM documents WHERE id=$1 AND institution_id=$2")
        .execute(Tuple.of(id, institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapDoc(it.next())) : Optional.empty();
        });
  }

  public Future<Optional<Document>> findAvatarDocument(long userId) {
    return pool.preparedQuery(
            "SELECT " + DOC_COLS + " FROM documents"
            + " WHERE entity_type = 'avatar' AND entity_id = $1"
            + " ORDER BY created_at DESC LIMIT 1")
        .execute(Tuple.of(String.valueOf(userId)))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapDoc(it.next())) : Optional.empty();
        });
  }

  private static Document mapDoc(Row r) {
    return new Document(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getLong("uploaded_by"),
        r.getString("cloudinary_public_id"),
        r.getString("url"),
        r.getString("filename"),
        r.getString("content_type"),
        r.getLong("size_bytes"),
        r.getString("resource_type"),
        r.getString("format"),
        r.getInteger("width"),
        r.getInteger("height"),
        r.getString("entity_type"),
        r.getString("entity_id"),
        r.getOffsetDateTime("created_at"));
  }

  // ── action_documents table ───────────────────────────────────────────────

  /**
   * Insert a row in action_documents that references a documents row instead
   * of storing binary data (data = NULL, document_id set).
   */
  public Future<Long> saveActionDocRef(
      long institutionId, long uploadedBy,
      String filename, String contentType, long documentId) {
    String sql =
        "INSERT INTO action_documents"
        + " (institution_id, uploaded_by, filename, content_type, size_bytes, document_id)"
        + " VALUES ($1,$2,$3,$4,0,$5) RETURNING id";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, uploadedBy, filename, contentType, documentId))
        .map(rs -> rs.iterator().next().getLong("id"));
  }

  /** Legacy: save raw bytes directly (kept for backward-compat tooling). */
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

  /**
   * Fetch an action_documents row.  For new rows the {@code data} field is
   * null; callers should redirect to {@code documentUrl} instead.
   */
  public Future<Optional<DocumentRecord>> findById(long institutionId, long id) {
    return pool.preparedQuery(
            "SELECT ad.id, ad.institution_id, ad.uploaded_by, ad.filename,"
            + " ad.content_type, ad.size_bytes, ad.data, ad.created_at, d.url AS document_url"
            + " FROM action_documents ad"
            + " LEFT JOIN documents d ON d.id = ad.document_id"
            + " WHERE ad.id=$1 AND ad.institution_id=$2")
        .execute(Tuple.of(id, institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapActionDoc(it.next())) : Optional.empty();
        });
  }

  private static DocumentRecord mapActionDoc(Row r) {
    var buf = r.getBuffer("data");
    return new DocumentRecord(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getLong("uploaded_by"),
        r.getString("filename"),
        r.getString("content_type"),
        r.getInteger("size_bytes") != null ? r.getInteger("size_bytes") : 0,
        buf != null ? buf.getBytes() : null,
        r.getOffsetDateTime("created_at"),
        r.getString("document_url"));
  }
}
