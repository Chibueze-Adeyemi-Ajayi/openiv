package com.openiv.backend.superadmin;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.model.AccessRequest;
import com.openiv.backend.auth.model.Institution;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.security.RequestId;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.util.List;

public final class SuperAdminHandlers {

  private final SuperAdminService service;

  public SuperAdminHandlers(SuperAdminService service) {
    this.service = service;
  }

  // --- Access Requests ------------------------------------------------

  public Handler<RoutingContext> listRequests() {
    return ctx -> {
      String status = ctx.queryParam("status").stream().findFirst().orElse(null);
      service.listRequests(status)
          .onSuccess(list -> ok(ctx, new JsonObject().put("requests", toJsonArray(list, this::requestJson))))
          .onFailure(e -> handleError(ctx, e));
    };
  }

  public Handler<RoutingContext> getRequest() {
    return ctx -> {
      long id = parseLong(ctx, "id");
      if (id < 0) return;
      service.getRequest(id)
          .onSuccess(req -> ok(ctx, requestJson(req)))
          .onFailure(e -> handleError(ctx, e));
    };
  }

  public Handler<RoutingContext> approveRequest() {
    return ctx -> {
      long id = parseLong(ctx, "id");
      if (id < 0) return;
      JsonObject body = bodyOrEmpty(ctx);
      Session session = SessionAuthHandler.require(ctx);
      service.approveRequest(session, id, body.getString("notes"))
          .onSuccess(result -> ok(ctx, new JsonObject()
              .put("institutionId", result.institution().id())
              .put("institutionName", result.institution().name())
              .put("invitationId", result.invitationId())))
          .onFailure(e -> handleError(ctx, e));
    };
  }

  public Handler<RoutingContext> rejectRequest() {
    return ctx -> {
      long id = parseLong(ctx, "id");
      if (id < 0) return;
      JsonObject body = bodyOrEmpty(ctx);
      Session session = SessionAuthHandler.require(ctx);
      service.rejectRequest(session, id, body.getString("notes"))
          .onSuccess(req -> ok(ctx, requestJson(req)))
          .onFailure(e -> handleError(ctx, e));
    };
  }

  // --- Institutions ---------------------------------------------------

  public Handler<RoutingContext> listInstitutions() {
    return ctx -> service.listInstitutions()
        .onSuccess(list -> ok(ctx, new JsonObject().put("institutions", toJsonArray(list, this::institutionJson))))
        .onFailure(e -> handleError(ctx, e));
  }

  public Handler<RoutingContext> getInstitution() {
    return ctx -> {
      long id = parseLong(ctx, "id");
      if (id < 0) return;
      service.getInstitution(id)
          .onSuccess(inst -> ok(ctx, institutionJson(inst)))
          .onFailure(e -> handleError(ctx, e));
    };
  }

  public Handler<RoutingContext> updateInstitutionStatus() {
    return ctx -> {
      long id = parseLong(ctx, "id");
      if (id < 0) return;
      JsonObject body = bodyOrEmpty(ctx);
      String status = body.getString("status");
      if (status == null) { badRequest(ctx, "status_required"); return; }
      service.updateInstitutionStatus(id, status)
          .onSuccess(inst -> ok(ctx, institutionJson(inst)))
          .onFailure(e -> handleError(ctx, e));
    };
  }

  // --- Serialisation --------------------------------------------------

  private JsonObject requestJson(AccessRequest r) {
    JsonObject obj = new JsonObject()
        .put("id", r.id())
        .put("institutionName", r.institutionName())
        .put("institutionType", r.institutionType().name())
        .put("contactName", r.contactName())
        .put("contactEmail", r.contactEmail())
        .put("status", r.status())
        .put("createdAt", r.createdAt() != null ? r.createdAt().toString() : null);
    if (r.contactPhone() != null) obj.put("contactPhone", r.contactPhone());
    if (r.jobTitle() != null) obj.put("jobTitle", r.jobTitle());
    if (r.description() != null) obj.put("description", r.description());
    if (r.reviewNotes() != null) obj.put("reviewNotes", r.reviewNotes());
    if (r.reviewedAt() != null) obj.put("reviewedAt", r.reviewedAt().toString());
    return obj;
  }

  private JsonObject institutionJson(Institution i) {
    JsonObject obj = new JsonObject()
        .put("id", i.id())
        .put("name", i.name())
        .put("type", i.type().name())
        .put("status", i.status())
        .put("createdAt", i.createdAt() != null ? i.createdAt().toString() : null);
    if (i.cbnCode() != null) obj.put("cbnCode", i.cbnCode());
    if (i.address() != null) obj.put("address", i.address());
    if (i.contactPhone() != null) obj.put("contactPhone", i.contactPhone());
    return obj;
  }

  // --- Helpers --------------------------------------------------------

  private <T> JsonArray toJsonArray(List<T> list, java.util.function.Function<T, JsonObject> mapper) {
    JsonArray arr = new JsonArray();
    list.forEach(item -> arr.add(mapper.apply(item)));
    return arr;
  }

  private static long parseLong(RoutingContext ctx, String param) {
    try {
      return Long.parseLong(ctx.pathParam(param));
    } catch (NumberFormatException e) {
      badRequest(ctx, "invalid_id");
      return -1;
    }
  }

  private static JsonObject bodyOrEmpty(RoutingContext ctx) {
    try {
      JsonObject b = ctx.body().asJsonObject();
      return b != null ? b : new JsonObject();
    } catch (Exception e) {
      return new JsonObject();
    }
  }

  private static void ok(RoutingContext ctx, JsonObject body) {
    ctx.response()
        .setStatusCode(200)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }

  private static void badRequest(RoutingContext ctx, String detail) {
    ctx.response()
        .setStatusCode(400)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(new JsonObject().put("error", "invalid").put("detail", detail)
            .put("correlationId", RequestId.of(ctx)).encode());
  }

  private static void handleError(RoutingContext ctx, Throwable e) {
    if (e instanceof AuthException ae) {
      int status = ae.detail() != null && ae.detail().endsWith("_not_found") ? 404 : 400;
      ctx.response()
          .setStatusCode(status)
          .putHeader("content-type", "application/json; charset=utf-8")
          .end(new JsonObject()
              .put("error", ae.category().name().toLowerCase())
              .put("detail", ae.detail())
              .put("correlationId", RequestId.of(ctx))
              .encode());
      return;
    }
    ctx.fail(e);
  }
}
