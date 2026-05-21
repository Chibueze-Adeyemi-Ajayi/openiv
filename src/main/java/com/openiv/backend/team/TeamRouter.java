package com.openiv.backend.team;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthService;
import com.openiv.backend.security.Permission;
import com.openiv.backend.security.RoleAuthHandler;
import io.vertx.core.Handler;
import io.vertx.core.Vertx;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import io.vertx.sqlclient.Pool;

/**
 * Team management routes. All endpoints require an authenticated session.
 * View routes require {@link Permission#TEAM_VIEW}; mutation routes require
 * {@link Permission#TEAM_MANAGE}.
 */
public final class TeamRouter {

  private TeamRouter() {}

  public static Router create(Vertx vertx, AuthService authService, TeamService teamService,
      Pool pool, UserRepository users) {
    Router router = Router.router(vertx);
    TeamHandlers handlers = new TeamHandlers(teamService, pool);

    router.route().handler(SessionAuthHandler.authenticated(authService));

    Handler<RoutingContext> teamView   = RoleAuthHandler.require(users, Permission.TEAM_VIEW);
    Handler<RoutingContext> teamManage = RoleAuthHandler.require(users, Permission.TEAM_MANAGE);

    router.get("/members").handler(teamView).handler(handlers.listMembers());
    router.delete("/members/:id").handler(teamManage).handler(handlers.removeMember());

    router.get("/pending").handler(teamView).handler(handlers.listPending());
    router.delete("/pending/:id").handler(teamManage).handler(handlers.revokeInvitation());
    router.post("/pending/:id/resend").handler(teamManage).handler(handlers.resendInvitation());

    router.post("/invite").handler(teamManage).handler(handlers.invite());
    router.get("/roles").handler(teamView).handler(handlers.roles());

    router.get("/custom-roles").handler(teamView).handler(handlers.listCustomRoles());
    router.post("/custom-roles").handler(teamManage).handler(handlers.saveCustomRole());
    router.delete("/custom-roles/:id").handler(teamManage).handler(handlers.deleteCustomRole());

    return router;
  }
}
