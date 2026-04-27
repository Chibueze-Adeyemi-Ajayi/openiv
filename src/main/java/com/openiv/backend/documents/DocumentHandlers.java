package com.openiv.backend.documents;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import io.vertx.core.Handler;
import io.vertx.core.Vertx;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.util.Set;

public final class DocumentHandlers {

  private static final long MAX_BYTES = 10L * 1024 * 1024;   // 10 MB
  private static final Set<String> ALLOWED = Set.of(
      "application/pdf",
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain"
  );

  private final DocumentRepository repository;
  private final UserRepository users;
  private final Vertx vertx;

  public DocumentHandlers(DocumentRepository repository, UserRepository users, Vertx vertx) {
    this.repository = repository;
    this.users = users;
    this.vertx = vertx;
  }

  /** POST /api/v1/documents/upload  (multipart/form-data, field name "file") */
  public Handler<RoutingContext> upload() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      var uploads = ctx.fileUploads();
      if (uploads == null || uploads.isEmpty()) { badRequest(ctx, "no file uploaded"); return; }
      var upload = uploads.iterator().next();

      if (upload.size() > MAX_BYTES) { badRequest(ctx, "file too large — max 10 MB"); return; }
      String rawCt = upload.contentType();
      String ct    = rawCt != null ? rawCt.split(";")[0].trim().toLowerCase() : "application/octet-stream";
      if (!ALLOWED.contains(ct)) { badRequest(ctx, "unsupported file type"); return; }

      String filename = upload.fileName() != null ? upload.fileName() : "document";

      users.findById(session.userId())
          .compose(opt -> {
            var user = opt.orElseThrow(() -> AuthException.invalid("session"));
            return vertx.fileSystem().readFile(upload.uploadedFileName())
                .compose(buf -> repository.save(
                    user.institutionId(), user.id(), filename, ct, buf.getBytes()));
          })
          .onSuccess(id -> ok(ctx, new JsonObject().put("id", id).put("filename", filename)))
          .onFailure(ctx::fail);
    };
  }

  /** GET /api/v1/documents/:id */
  public Handler<RoutingContext> download() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long docId;
      try { docId = Long.parseLong(ctx.pathParam("id")); }
      catch (NumberFormatException e) { ctx.fail(404); return; }

      users.findById(session.userId())
          .compose(opt -> {
            var user = opt.orElseThrow(() -> AuthException.invalid("session"));
            return repository.findById(user.institutionId(), docId);
          })
          .onSuccess(opt -> {
            if (opt.isEmpty()) { ctx.fail(404); return; }
            var doc = opt.get();
            ctx.response()
                .setStatusCode(200)
                .putHeader("content-type", doc.contentType())
                .putHeader("content-disposition",
                    "attachment; filename=\"" + doc.filename().replace("\"", "'") + "\"")
                .putHeader("content-length", String.valueOf(doc.sizeBytes()))
                .end(Buffer.buffer(doc.data()));
          })
          .onFailure(ctx::fail);
    };
  }

  private static void ok(RoutingContext ctx, JsonObject body) {
    ctx.response().setStatusCode(200)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }

  private static void badRequest(RoutingContext ctx, String msg) {
    ctx.response().setStatusCode(400)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(new JsonObject().put("error", msg).encode());
  }
}
