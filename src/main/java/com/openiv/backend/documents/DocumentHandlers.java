package com.openiv.backend.documents;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.billing.BillingService;
import com.openiv.backend.cloudinary.CloudinaryService;
import io.vertx.core.Handler;
import io.vertx.core.Vertx;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.util.List;
import java.util.UUID;

public final class DocumentHandlers {

  private static final long MAX_BYTES = 10L * 1024 * 1024;
  private static final List<String> ALLOWED = List.of(
      "application/pdf",
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain"
  );

  private final DocumentRepository repository;
  private final UserRepository      users;
  private final CloudinaryService   cloudinary;
  private final BillingService      billing;

  public DocumentHandlers(DocumentRepository repository, UserRepository users,
      Vertx vertx, BillingService billing, CloudinaryService cloudinary) {
    this.repository = repository;
    this.users      = users;
    this.cloudinary = cloudinary;
    this.billing    = billing;
  }

  /** POST /api/v1/documents/upload */
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
      String resourceType = ct.startsWith("image/") ? "image" : "raw";

      users.findById(session.userId())
          .compose(opt -> {
            var user = opt.orElseThrow(() -> AuthException.invalid("session"));
            return ctx.vertx().fileSystem().readFile(upload.uploadedFileName())
                .compose(buf -> cloudinary.upload(
                    buf.getBytes(),
                    "openiv",
                    user.institutionId() + "_" + UUID.randomUUID(),
                    resourceType))
                .compose(result -> repository.saveDocument(
                    user.institutionId(), user.id(),
                    result.publicId(), result.secureUrl(),
                    filename, ct, result.bytes(),
                    result.resourceType(), result.format(),
                    result.width(), result.height(),
                    "action_document", null)
                .compose(doc -> repository.saveActionDocRef(
                    user.institutionId(), user.id(), filename, ct, doc.id())
                .map(actionId -> new JsonObject()
                    .put("id",       actionId)
                    .put("url",      result.secureUrl())
                    .put("filename", filename))));
          })
          .onSuccess(json -> {
            ok(ctx, json);
            billing.chargeDocumentUploadAsync(session);
          })
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
          .onSuccess(optDoc -> {
            if (optDoc.isEmpty()) { ctx.fail(404); return; }
            var doc = optDoc.get();
            // New Cloudinary-backed documents: redirect to the secure URL.
            if (doc.documentUrl() != null) {
              ctx.response().setStatusCode(302)
                  .putHeader("Location", doc.documentUrl())
                  .end();
              return;
            }
            // Legacy documents: serve binary from DB.
            if (doc.data() == null) { ctx.fail(404); return; }
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
