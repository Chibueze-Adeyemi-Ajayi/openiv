package com.openiv.backend.institution;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.model.Institution;
import com.openiv.backend.auth.repository.InstitutionRepository;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.cloudinary.CloudinaryService;
import com.openiv.backend.documents.Document;
import com.openiv.backend.documents.DocumentRepository;
import io.vertx.core.Future;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.FileUpload;
import io.vertx.ext.web.RoutingContext;

import java.util.Base64;
import java.util.List;
import java.util.UUID;

public final class InstitutionHandlers {

  private final InstitutionRepository institutions;
  private final UserRepository         users;
  private final CloudinaryService      cloudinary;
  private final DocumentRepository     documents;

  public InstitutionHandlers(InstitutionRepository institutions, UserRepository users,
      CloudinaryService cloudinary, DocumentRepository documents) {
    this.institutions = institutions;
    this.users        = users;
    this.cloudinary   = cloudinary;
    this.documents    = documents;
  }

  // GET /institution/profile
  public Handler<RoutingContext> getProfile() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      users.findById(session.userId())
          .compose(uOpt -> institutions.findById(uOpt.orElseThrow().institutionId()))
          .onSuccess(opt -> {
            if (opt.isEmpty()) { ctx.fail(404); return; }
            ok(ctx, toJson(opt.get()));
          })
          .onFailure(ctx::fail);
    };
  }

  // GET /institution/signing-credentials
  public Handler<RoutingContext> getSigningCredentials() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      users.findById(session.userId())
          .compose(uOpt -> institutions.findById(uOpt.orElseThrow().institutionId()))
          .onSuccess(opt -> {
            if (opt.isEmpty()) { ctx.fail(404); return; }
            var inst = opt.get();
            ok(ctx, new JsonObject()
                .put("officialStamp",     inst.officialStamp())
                .put("officialSignature", inst.officialSignature())
                .put("stampDocumentId",     inst.stampDocumentId())
                .put("signatureDocumentId", inst.signatureDocumentId()));
          })
          .onFailure(ctx::fail);
    };
  }

  /**
   * PATCH /institution/signing-credentials
   *
   * Accepts either:
   *   a) multipart/form-data with fields "stamp" and/or "signature" (preferred)
   *   b) JSON body with "officialStamp" / "officialSignature" as base64 data-URI
   *      strings (backward-compat; kept so the existing frontend still works)
   *
   * Both paths upload to Cloudinary and store the resulting secure URL —
   * never raw binary or base64 — in the institutions table.
   */
  public Handler<RoutingContext> updateSigningCredentials() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);

      users.findById(session.userId())
          .compose(uOpt -> {
            var user   = uOpt.orElseThrow();
            long instId = user.institutionId();

            List<FileUpload> uploads = ctx.fileUploads();
            boolean isMultipart = uploads != null && !uploads.isEmpty();

            if (isMultipart) {
              return handleMultipartCredentials(ctx, session.userId(), instId, uploads);
            } else {
              return handleJsonCredentials(ctx, session.userId(), instId);
            }
          })
          .onSuccess(inst -> ok(ctx, toJson(inst)))
          .onFailure(ctx::fail);
    };
  }

  private Future<Institution> handleMultipartCredentials(
      RoutingContext ctx, long userId, long instId, List<FileUpload> uploads) {

    FileUpload stampUpload     = null;
    FileUpload signatureUpload = null;
    for (var fu : uploads) {
      if ("stamp".equals(fu.name()))     stampUpload     = fu;
      if ("signature".equals(fu.name())) signatureUpload = fu;
    }

    final FileUpload stamp = stampUpload;
    final FileUpload sig   = signatureUpload;

    Future<Document> stampDocFuture = stamp == null ? Future.succeededFuture(null)
        : uploadCredentialFile(ctx, userId, instId, stamp, "stamp");
    Future<Document> sigDocFuture   = sig == null   ? Future.succeededFuture(null)
        : uploadCredentialFile(ctx, userId, instId, sig, "signature");

    return stampDocFuture.compose(stampDoc ->
        sigDocFuture.compose(sigDoc ->
            institutions.findById(instId)
                .compose(opt -> {
                  opt.orElseThrow();
                  String newStamp    = stampDoc   != null ? stampDoc.url()   : null;
                  Long   stampDocId  = stampDoc   != null ? stampDoc.id()    : null;
                  String newSig      = sigDoc     != null ? sigDoc.url()     : null;
                  Long   sigDocId    = sigDoc     != null ? sigDoc.id()      : null;
                  return institutions.updateSigningCredentials(
                      instId, newStamp, stampDocId, newSig, sigDocId);
                })));
  }

  private Future<Document> uploadCredentialFile(
      RoutingContext ctx, long userId, long instId,
      FileUpload fu, String entityType) {
    String ct = fu.contentType() != null ? fu.contentType() : "image/png";
    String publicId = entityType + "_" + instId + "_" + UUID.randomUUID();
    return ctx.vertx().fileSystem().readFile(fu.uploadedFileName())
        .compose(buf -> cloudinary.upload(buf.getBytes(), "openiv", publicId, "image"))
        .compose(result -> documents.saveDocument(
            instId, userId,
            result.publicId(), result.secureUrl(),
            fu.fileName() != null ? fu.fileName() : entityType, ct, result.bytes(),
            result.resourceType(), result.format(),
            result.width(), result.height(),
            entityType, String.valueOf(instId)));
  }

  private Future<Institution> handleJsonCredentials(
      RoutingContext ctx, long userId, long instId) {
    JsonObject body;
    try {
      body = ctx.body().asJsonObject();
      if (body == null) return Future.failedFuture("invalid body");
    } catch (Exception e) {
      return Future.failedFuture("invalid body");
    }
    String stampB64 = body.getString("officialStamp");
    String sigB64   = body.getString("officialSignature");

    Future<Document> stampDocFuture = stampB64 == null ? Future.succeededFuture(null)
        : uploadBase64Credential(ctx, userId, instId, stampB64, "stamp");
    Future<Document> sigDocFuture   = sigB64 == null   ? Future.succeededFuture(null)
        : uploadBase64Credential(ctx, userId, instId, sigB64, "signature");

    return stampDocFuture.compose(stampDoc ->
        sigDocFuture.compose(sigDoc -> {
          String newStamp   = stampDoc != null ? stampDoc.url() : null;
          Long   stampDocId = stampDoc != null ? stampDoc.id()  : null;
          String newSig     = sigDoc   != null ? sigDoc.url()   : null;
          Long   sigDocId   = sigDoc   != null ? sigDoc.id()    : null;
          return institutions.updateSigningCredentials(
              instId, newStamp, stampDocId, newSig, sigDocId);
        }));
  }

  /** Decode a base64 data-URI or raw base64 string and upload to Cloudinary. */
  private Future<Document> uploadBase64Credential(
      RoutingContext ctx, long userId, long instId,
      String b64, String entityType) {
    try {
      String data = b64.contains(",") ? b64.substring(b64.indexOf(',') + 1) : b64;
      byte[] bytes = Base64.getDecoder().decode(data.replaceAll("\\s", ""));
      String ct = b64.startsWith("data:image/png") ? "image/png"
                : b64.startsWith("data:image/gif") ? "image/gif"
                : "image/jpeg";
      String publicId = entityType + "_" + instId + "_" + UUID.randomUUID();
      return cloudinary.upload(bytes, "openiv", publicId, "image")
          .compose(result -> documents.saveDocument(
              instId, userId,
              result.publicId(), result.secureUrl(),
              entityType + "." + result.format(), ct, result.bytes(),
              result.resourceType(), result.format(),
              result.width(), result.height(),
              entityType, String.valueOf(instId)));
    } catch (Exception e) {
      return Future.failedFuture("invalid base64 for " + entityType + ": " + e.getMessage());
    }
  }

  // PATCH /institution/profile
  public Handler<RoutingContext> updateProfile() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body;
      try {
        body = ctx.body().asJsonObject();
        if (body == null) { ctx.fail(400); return; }
      } catch (Exception e) { ctx.fail(400); return; }

      String cbnCode      = body.getString("cbnCode");
      String address      = body.getString("address");
      String contactPhone = body.getString("contactPhone");

      users.findById(session.userId())
          .compose(uOpt -> institutions.updateProfile(
              uOpt.orElseThrow().institutionId(), cbnCode, address, contactPhone))
          .onSuccess(inst -> ok(ctx, toJson(inst)))
          .onFailure(ctx::fail);
    };
  }

  private static JsonObject toJson(Institution i) {
    return new JsonObject()
        .put("id",                  i.id())
        .put("name",                i.name())
        .put("type",                i.type().name())
        .put("status",              i.status())
        .put("cbnCode",             i.cbnCode())
        .put("address",             i.address())
        .put("contactPhone",        i.contactPhone())
        .put("officialStamp",       i.officialStamp())
        .put("officialSignature",   i.officialSignature())
        .put("stampDocumentId",     i.stampDocumentId())
        .put("signatureDocumentId", i.signatureDocumentId());
  }

  private static void ok(RoutingContext ctx, JsonObject body) {
    ctx.response().setStatusCode(200)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }
}
