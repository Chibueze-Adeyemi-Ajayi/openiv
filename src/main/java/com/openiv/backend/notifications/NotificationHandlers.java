package com.openiv.backend.notifications;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.repository.UserRepository;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.ext.web.RoutingContext;

public class NotificationHandlers {

  private final NotificationService service;
  private final UserRepository      users;

  public NotificationHandlers(NotificationService service, UserRepository users) {
    this.service = service;
    this.users   = users;
  }

  // GET /notifications?limit=50
  public Handler<RoutingContext> list() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      int limit = 50;
      try { limit = Integer.parseInt(ctx.queryParam("limit").stream().findFirst().orElse("50")); }
      catch (NumberFormatException ignored) {}
      final int lim = Math.min(limit, 200);
      users.findById(session.userId()).compose(opt -> {
        if (opt.isEmpty()) { ctx.response().setStatusCode(401).end(); return io.vertx.core.Future.succeededFuture(); }
        var u = opt.get();
        return service.listRecent(u.institutionId(), session.userId(), u.role(), lim)
            .onSuccess(list -> {
              var arr = new JsonArray();
              list.forEach(n -> arr.add(NotificationService.toJson(n)));
              ctx.response().putHeader("content-type", "application/json").end(arr.encode());
            });
      }).onFailure(ctx::fail);
    };
  }

  // PATCH /notifications/read-all
  public Handler<RoutingContext> markAllRead() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      users.findById(session.userId()).compose(opt -> {
        if (opt.isEmpty()) { ctx.response().setStatusCode(401).end(); return io.vertx.core.Future.succeededFuture(); }
        var u = opt.get();
        return service.markAllRead(u.institutionId(), session.userId(), u.role())
            .onSuccess(count -> ctx.response().putHeader("content-type", "application/json")
                .end("{\"marked\":" + count + "}"));
      }).onFailure(ctx::fail);
    };
  }

  // PATCH /notifications/read-category/:category
  public Handler<RoutingContext> markCategoryRead() {
    return ctx -> {
      var session  = SessionAuthHandler.require(ctx);
      String category = ctx.pathParam("category");
      users.findById(session.userId()).compose(opt -> {
        if (opt.isEmpty()) { ctx.response().setStatusCode(401).end(); return io.vertx.core.Future.succeededFuture(); }
        var u = opt.get();
        return service.markAllReadByCategory(u.institutionId(), session.userId(), u.role(), category)
            .onSuccess(v -> ctx.response().putHeader("content-type", "application/json")
                .end("{\"ok\":true}"));
      }).onFailure(ctx::fail);
    };
  }

  // PATCH /notifications/:id/read
  public Handler<RoutingContext> markRead() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id;
      try { id = Long.parseLong(ctx.pathParam("id")); }
      catch (NumberFormatException e) { ctx.response().setStatusCode(400).end("{\"error\":\"invalid id\"}"); return; }
      final long notifId = id;
      users.findById(session.userId()).compose(opt -> {
        if (opt.isEmpty()) { ctx.response().setStatusCode(401).end(); return io.vertx.core.Future.succeededFuture(); }
        var u = opt.get();
        return service.markRead(notifId, u.institutionId(), session.userId())
            .onSuccess(ok -> ctx.response().putHeader("content-type", "application/json")
                .end("{\"ok\":" + ok + "}"));
      }).onFailure(ctx::fail);
    };
  }

  // GET /notifications/unread-counts
  public Handler<RoutingContext> unreadCounts() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      users.findById(session.userId()).compose(opt -> {
        if (opt.isEmpty()) { ctx.response().setStatusCode(401).end(); return io.vertx.core.Future.succeededFuture(); }
        var u = opt.get();
        return service.getUnreadCounts(u.institutionId(), session.userId(), u.role())
            .onSuccess(counts -> ctx.response().putHeader("content-type", "application/json")
                .end(counts.encode()));
      }).onFailure(ctx::fail);
    };
  }
}
