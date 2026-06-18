package com.openiv.backend.customers;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.cloudinary.CloudinaryService;
import com.openiv.backend.documents.DocumentRepository;
import io.vertx.core.Future;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.time.LocalDate;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

public final class CustomerHandlers {
  private final CustomerService    service;
  private final UserRepository     users;
  private final CloudinaryService  cloudinary;
  private final DocumentRepository documents;

  public CustomerHandlers(CustomerService service, UserRepository users,
      CloudinaryService cloudinary, DocumentRepository documents) {
    this.service   = service;
    this.users     = users;
    this.cloudinary = cloudinary;
    this.documents  = documents;
  }

  /** Returns true if the value looks like base64 (data URI or raw) rather than a URL. */
  private static boolean isBase64(String v) {
    return v != null && !v.startsWith("http") && v.length() > 200;
  }

  /**
   * Decode a base64 data-URI or raw base64 string, upload to Cloudinary,
   * save a documents row, and return the secure URL.
   */
  private Future<String[]> uploadPhotoToCloudinary(
      RoutingContext ctx, long institutionId, long userId, String externalId, String b64) {
    try {
      String data  = b64.contains(",") ? b64.substring(b64.indexOf(',') + 1) : b64;
      byte[] bytes = Base64.getDecoder().decode(data.replaceAll("\\s", ""));
      String ct    = b64.startsWith("data:image/png") ? "image/png"
                   : b64.startsWith("data:image/gif") ? "image/gif"
                   : "image/jpeg";
      String publicId = "customer_photo_" + externalId + "_" + UUID.randomUUID();
      return cloudinary.upload(bytes, "openiv", publicId, "image")
          .compose(result -> documents.saveDocument(
              institutionId, userId,
              result.publicId(), result.secureUrl(),
              "photo." + result.format(), ct, result.bytes(),
              result.resourceType(), result.format(),
              result.width(), result.height(),
              "customer_photo", externalId)
          .map(doc -> new String[]{ result.secureUrl(), String.valueOf(doc.id()) }));
    } catch (Exception e) {
      return Future.failedFuture("invalid photo data: " + e.getMessage());
    }
  }

  // GET /customers?q=&pageSize=&page=
  public Handler<RoutingContext> listCustomers() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      String q = ctx.queryParam("q").stream().findFirst().orElse(null);
      int pageSize;
      int page;
      try {
        pageSize = Integer.parseInt(ctx.queryParam("pageSize").stream().findFirst().orElse("10"));
      } catch (NumberFormatException e) {
        pageSize = 10;
      }
      try {
        page = Integer.parseInt(ctx.queryParam("page").stream().findFirst().orElse("1"));
      } catch (NumberFormatException e) {
        page = 1;
      }
      int finalPageSize = pageSize;
      int finalPage = page;

      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> AuthException.invalid("session"));
            return service.listCustomers(u.institutionId(), q, finalPageSize, finalPage);
          })
          .onSuccess(list -> {
            var arr = new io.vertx.core.json.JsonArray();
            list.forEach(c -> arr.add(toJson(c)));
            ctx.response().setStatusCode(200)
                .putHeader("Content-Type", "application/json")
                .end(new JsonObject()
                    .put("customers", arr)
                    .put("page", finalPage)
                    .put("pageSize", finalPageSize)
                    .put("hasMore", list.size() == finalPageSize)
                    .encode());
          })
          .onFailure(ctx::fail);
    };
  }

  // GET /customers/:id
  public Handler<RoutingContext> getCustomer() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      String externalId = ctx.pathParam("id");

      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> AuthException.invalid("session"));
            return service.getCustomer(u.institutionId(), externalId);
          })
          .onSuccess(cOpt -> {
            if (cOpt.isEmpty()) {
              ctx.response().setStatusCode(404)
                  .putHeader("Content-Type", "application/json")
                  .end(new JsonObject().put("error", "Customer not found").encode());
            } else {
              Customer c = cOpt.get();
              ctx.response().setStatusCode(200)
                  .putHeader("Content-Type", "application/json")
                  .end(toJson(c).encode());
            }
          })
          .onFailure(ctx::fail);
    };
  }

  // GET /customers/high-risk?page=&pageSize=
  public Handler<RoutingContext> highRisk() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      int page;
      int pageSize;
      try { page = Integer.parseInt(ctx.queryParam("page").stream().findFirst().orElse("1")); }
      catch (NumberFormatException e) { page = 1; }
      try { pageSize = Integer.parseInt(ctx.queryParam("pageSize").stream().findFirst().orElse("20")); }
      catch (NumberFormatException e) { pageSize = 20; }
      final int finalPage = Math.max(1, page);
      final int limit = Math.min(Math.max(1, pageSize), 100);
      final int offset = (finalPage - 1) * limit;

      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> AuthException.invalid("session"));
            long instId = u.institutionId();
            return service.countHighRisk(instId)
                .compose(total -> service.listHighRisk(instId, limit, offset)
                    .map(list -> Map.entry(total, list)));
          })
          .onSuccess(entry -> {
            long total = entry.getKey();
            var list = entry.getValue();
            var arr = new JsonArray();
            list.forEach(c -> arr.add(toJson(c)));
            ctx.response().setStatusCode(200)
                .putHeader("Content-Type", "application/json")
                .end(new JsonObject()
                    .put("customers", arr)
                    .put("total", total)
                    .put("page", finalPage)
                    .put("pageSize", limit)
                    .encode());
          })
          .onFailure(ctx::fail);
    };
  }

  // PATCH /customers/:id/profile
  public Handler<RoutingContext> updateProfile() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      String externalId = ctx.pathParam("id");

      JsonObject body;
      try {
        body = ctx.body().asJsonObject();
        if (body == null) body = new JsonObject();
      } catch (Exception e) {
        ctx.response().setStatusCode(400)
            .putHeader("Content-Type", "application/json")
            .end(new JsonObject().put("error", "Invalid JSON body").encode());
        return;
      }

      String bvn           = body.getString("bvn");
      String nin           = body.getString("nin");
      String photo         = body.getString("photo");
      String accountNumber = body.getString("accountNumber");
      String subjectType   = body.getString("subjectType");
      String dobStr        = body.getString("dob");
      String address       = body.getString("address");

      LocalDate dob = null;
      if (dobStr != null && !dobStr.isBlank()) {
        try { dob = LocalDate.parse(dobStr); } catch (Exception ignored) {}
      }

      final LocalDate finalDob = dob;
      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> AuthException.invalid("session"));
            // If the photo field is base64, upload to Cloudinary first
            if (isBase64(photo)) {
              return uploadPhotoToCloudinary(ctx, u.institutionId(), u.id(), externalId, photo)
                  .<Customer>compose(photoInfo -> service.updateProfile(
                      u.institutionId(), externalId,
                      bvn, nin, photoInfo[0], accountNumber, subjectType, finalDob, address,
                      Long.parseLong(photoInfo[1])));
            }
            return service.updateProfile(u.institutionId(), externalId,
                bvn, nin, photo, accountNumber, subjectType, finalDob, address, null);
          })
          .onSuccess(c -> ctx.response().setStatusCode(200)
              .putHeader("Content-Type", "application/json")
              .end(toJson(c).encode()))
          .onFailure(e -> {
            if (e.getMessage() != null && e.getMessage().contains("No rows")) {
              ctx.response().setStatusCode(404)
                  .putHeader("Content-Type", "application/json")
                  .end(new JsonObject().put("error", "Customer not found").encode());
            } else {
              ctx.fail(e);
            }
          });
    };
  }

  // PATCH /customers/:id/watchlist
  public Handler<RoutingContext> watchlistCustomer() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      String externalId = ctx.pathParam("id");
      JsonObject body;
      try { body = ctx.body().asJsonObject(); if (body == null) body = new JsonObject(); }
      catch (Exception e) { ctx.response().setStatusCode(400).putHeader("Content-Type","application/json").end(new JsonObject().put("error","invalid body").encode()); return; }
      String reason = body.getString("reason", "Watchlisted from case resolution");
      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> AuthException.invalid("session"));
            return service.watchlist(u.institutionId(), externalId, reason);
          })
          .onSuccess(c -> ctx.response().setStatusCode(200).putHeader("Content-Type","application/json").end(toJson(c).encode()))
          .onFailure(ctx::fail);
    };
  }

  // POST /customers/:id/resolve-step
  public Handler<RoutingContext> resolveStep() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      String externalId = ctx.pathParam("id");
      JsonObject body;
      try {
        body = ctx.body().asJsonObject();
        if (body == null) throw new IllegalArgumentException("Missing body");
      } catch (Exception e) {
        ctx.response().setStatusCode(400).putHeader("Content-Type", "application/json")
            .end(new JsonObject().put("error", "Invalid request body").encode());
        return;
      }
      String stepType   = body.getString("type");
      String resolution = body.getString("resolution");
      String note       = body.getString("note", "Manually reviewed and resolved by compliance officer");
      if (stepType == null || resolution == null) {
        ctx.response().setStatusCode(400).putHeader("Content-Type", "application/json")
            .end(new JsonObject().put("error", "'type' and 'resolution' are required").encode());
        return;
      }
      boolean markPass = "pass".equals(resolution);
      int score = body.getInteger("score", markPass ? 80 : 10);
      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> AuthException.invalid("session"));
            return service.resolveStep(u.institutionId(), externalId, stepType, markPass, score, note);
          })
          .onSuccess(c -> ctx.response().setStatusCode(200)
              .putHeader("Content-Type", "application/json").end(toJson(c).encode()))
          .onFailure(e -> {
            if (e.getMessage() != null && (e.getMessage().contains("not found") || e.getMessage().contains("not found"))) {
              ctx.response().setStatusCode(404).putHeader("Content-Type", "application/json")
                  .end(new JsonObject().put("error", e.getMessage()).encode());
            } else if (e instanceof IllegalArgumentException) {
              ctx.response().setStatusCode(400).putHeader("Content-Type", "application/json")
                  .end(new JsonObject().put("error", e.getMessage()).encode());
            } else {
              ctx.fail(e);
            }
          });
    };
  }

  // PATCH /customers/:id/unwatchlist
  public Handler<RoutingContext> unwatchlistCustomer() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      String externalId = ctx.pathParam("id");
      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> AuthException.invalid("session"));
            return service.unwatchlist(u.institutionId(), externalId);
          })
          .onSuccess(c -> ctx.response().setStatusCode(200).putHeader("Content-Type","application/json").end(toJson(c).encode()))
          .onFailure(ctx::fail);
    };
  }

  static JsonObject toJson(Customer c) {
    // risk_score in DB is always set to cdd_risk_score after workflow evaluation.
    int overallRiskScore = c.cddRiskScore() != null ? c.cddRiskScore() : c.riskScore();
    var obj = new JsonObject()
        .put("id",                   c.id())
        .put("institutionId",        c.institutionId())
        .put("externalId",           c.externalId())
        .put("name",                 c.name())
        .put("email",                c.email())
        .put("phone",                c.phone())
        .put("riskScore",            overallRiskScore)
        .put("overallRiskScore",     overallRiskScore)
        .put("bvn",           c.bvn())
        .put("nin",           c.nin())
        .put("photo",         c.photo())
        .put("accountNumber", c.accountNumber())
        .put("subjectType",   c.subjectType())
        .put("address",       c.address())
        .put("createdAt",     c.createdAt().toString())
        .put("updatedAt",     c.updatedAt().toString())
        .put("watchlisted",   c.watchlisted());
    if (c.dob() != null)             obj.put("dob",              c.dob().toString());
    if (c.watchlistedAt() != null)   obj.put("watchlistedAt",    c.watchlistedAt().toString());
    if (c.watchlistedReason() != null) obj.put("watchlistedReason", c.watchlistedReason());
    if (c.lastEvaluatedAt() != null) obj.put("lastEvaluatedAt",  c.lastEvaluatedAt().toString());
    if (c.cddRiskScore() != null)    obj.put("cddRiskScore",     c.cddRiskScore());
    if (c.cddConcerns() != null && !c.cddConcerns().isBlank()) {
      try { obj.put("cddConcerns", new io.vertx.core.json.JsonArray(c.cddConcerns())); }
      catch (Exception ignored) {}
    }
    if (c.cddStepScores() != null && !c.cddStepScores().isBlank()) {
      try { obj.put("cddStepScores", new io.vertx.core.json.JsonArray(c.cddStepScores())); }
      catch (Exception ignored) {}
    }
    if (c.selfiePhoto() != null)    obj.put("selfiePhoto",    c.selfiePhoto());
    if (c.identityPhoto() != null)  obj.put("identityPhoto",  c.identityPhoto());
    return obj;
  }
}
