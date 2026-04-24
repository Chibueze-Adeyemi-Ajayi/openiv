package com.openiv.backend.team;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.model.Invitation;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.security.RequestId;
import io.vertx.core.Future;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;

/**
 * HTTP layer for team management. Each handler resolves the caller's team context
 * (institution + role), delegates to {@link TeamService}, and maps result / errors to HTTP.
 */
public final class TeamHandlers {

  private final TeamService service;

  public TeamHandlers(TeamService service) {
    this.service = service;
  }

  public Handler<RoutingContext> listMembers() {
    return ctx -> withContext(ctx, tctx ->
        service.listMembers(tctx).map(list -> {
          JsonArray arr = new JsonArray();
          list.forEach(u -> arr.add(memberJson(u)));
          return new JsonObject().put("members", arr);
        }));
  }

  public Handler<RoutingContext> listPending() {
    return ctx -> withContext(ctx, tctx ->
        service.listPending(tctx).map(list -> {
          JsonArray arr = new JsonArray();
          list.forEach(inv -> arr.add(pendingJson(inv, tctx.caller().displayName())));
          return new JsonObject().put("pending", arr);
        }));
  }

  public Handler<RoutingContext> invite() {
    return ctx -> withContext(ctx, tctx -> {
      JsonObject body = safeBody(ctx);
      if (body == null) return Future.failedFuture(AuthException.invalid("invalid_body"));
      String email = body.getString("email");
      String role = body.getString("role", "analyst");
      return service.invite(tctx, email, role)
          .map(inv -> new JsonObject()
              .put("id", inv.id())
              .put("email", inv.email())
              .put("role", inv.role())
              .put("status", inv.status()));
    });
  }

  public Handler<RoutingContext> removeMember() {
    return ctx -> withContext(ctx, tctx -> {
      long id = longParam(ctx, "id");
      return service.removeMember(tctx, id)
          .map(v -> new JsonObject().put("ok", true));
    });
  }

  public Handler<RoutingContext> revokeInvitation() {
    return ctx -> withContext(ctx, tctx -> {
      long id = longParam(ctx, "id");
      return service.revokeInvitation(tctx, id)
          .map(v -> new JsonObject().put("ok", true));
    });
  }

  public Handler<RoutingContext> resendInvitation() {
    return ctx -> withContext(ctx, tctx -> {
      long id = longParam(ctx, "id");
      return service.resendInvitation(tctx, id)
          .map(inv -> new JsonObject()
              .put("id", inv.id())
              .put("email", inv.email())
              .put("role", inv.role())
              .put("status", inv.status())
              .put("expiresAt", inv.expiresAt() != null ? inv.expiresAt().toString() : null));
    });
  }

  public Handler<RoutingContext> roles() {
    return ctx -> withContext(ctx, tctx ->
        service.listCustomRoles(tctx).map(custom -> {
          JsonArray arr = TeamRoles.catalog().copy();
          custom.forEach(arr::add);
          return new JsonObject().put("roles", arr);
        }));
  }

  public Handler<RoutingContext> listCustomRoles() {
    return ctx -> withContext(ctx, tctx ->
        service.listCustomRoles(tctx).map(list -> {
          JsonArray arr = new JsonArray();
          list.forEach(arr::add);
          return new JsonObject().put("customRoles", arr);
        }));
  }

  public Handler<RoutingContext> saveCustomRole() {
    return ctx -> withContext(ctx, tctx -> {
      JsonObject body = safeBody(ctx);
      if (body == null) return Future.failedFuture(AuthException.invalid("invalid_body"));
      return service.saveCustomRole(tctx, body)
          .map(v -> new JsonObject().put("ok", true));
    });
  }

  public Handler<RoutingContext> deleteCustomRole() {
    return ctx -> withContext(ctx, tctx -> {
      String id = ctx.pathParam("id");
      return service.deleteCustomRole(tctx, id)
          .map(v -> new JsonObject().put("ok", true));
    });
  }

  // --- plumbing -----------------------------------------------------------

  private void withContext(RoutingContext ctx,
      java.util.function.Function<TeamService.TeamContext, Future<JsonObject>> op) {
    service.context(SessionAuthHandler.require(ctx))
        .compose(op::apply)
        .onSuccess(json -> ctx.response()
            .setStatusCode(200)
            .putHeader("content-type", "application/json; charset=utf-8")
            .end(json.encode()))
        .onFailure(err -> handleFailure(ctx, err));
  }

  private static JsonObject safeBody(RoutingContext ctx) {
    try {
      return ctx.body().asJsonObject();
    } catch (Exception e) {
      return null;
    }
  }

  private static long longParam(RoutingContext ctx, String name) {
    try {
      return Long.parseLong(ctx.pathParam(name));
    } catch (NumberFormatException e) {
      throw AuthException.invalid(name);
    }
  }

  private static void handleFailure(RoutingContext ctx, Throwable err) {
    if (err instanceof AuthException ae) {
      int status = switch (ae.detail()) {
        case "forbidden" -> 403;
        case "feature_locked" -> 403;
        case "session" -> 401;
        case "invitation_not_found" -> 404;
        case "already_invited" -> 409;
        case "cannot_remove_self" -> 409;
        case "invitation_not_pending" -> 409;
        default -> 400;
      };
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
    ctx.fail(err);
  }

  // --- JSON shapes (match what TeamPage expects) --------------------------

  private static JsonObject memberJson(User u) {
    return new JsonObject()
        .put("id", u.id())
        .put("email", u.email())
        .put("name", u.displayName())
        .put("initials", initialsOf(u.displayName()))
        .put("role", u.role())
        .put("status", u.status())
        .put("accountType", u.accountType().dbValue())
        .put("emailVerified", u.emailVerified())
        .put("lastActive", humanize(u.updatedAt()))
        .put("createdAt", u.createdAt().toString());
  }

  private static JsonObject pendingJson(Invitation inv, String invitedByName) {
    return new JsonObject()
        .put("id", inv.id())
        .put("email", inv.email())
        .put("role", inv.role())
        .put("invitedBy", invitedByName)
        .put("invitedOn", humanize(inv.createdAt()))
        .put("expiresAt", inv.expiresAt().toString());
  }

  private static String initialsOf(String name) {
    if (name == null || name.isBlank()) return "?";
    String[] parts = name.trim().split("\\s+");
    if (parts.length == 1) {
      String p = parts[0];
      return p.substring(0, Math.min(2, p.length())).toUpperCase();
    }
    return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
  }

  private static String humanize(OffsetDateTime when) {
    if (when == null) return "—";
    long minutes = ChronoUnit.MINUTES.between(when, OffsetDateTime.now());
    if (minutes < 1) return "Now";
    if (minutes < 60) return minutes + " min ago";
    long hours = minutes / 60;
    if (hours < 24) return hours + (hours == 1 ? " hr ago" : " hrs ago");
    long days = hours / 24;
    if (days < 30) return days + (days == 1 ? " day ago" : " days ago");
    long months = days / 30;
    if (months < 12) return months + (months == 1 ? " month ago" : " months ago");
    return (months / 12) + " yr ago";
  }
}
