package com.openiv.backend.team;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.service.AuthService;
import io.vertx.core.Vertx;
import io.vertx.ext.web.Router;

/**
 * Team management routes. All endpoints require an authenticated session; authorization for
 * mutation is done inside {@link TeamService#requireManager}.
 */
public final class TeamRouter {

  private TeamRouter() {}

  public static Router create(Vertx vertx, AuthService authService, TeamService teamService) {
    Router router = Router.router(vertx);
    TeamHandlers handlers = new TeamHandlers(teamService);

    // Gate the whole sub-router: only fully-authenticated sessions proceed.
    router.route().handler(SessionAuthHandler.authenticated(authService));

    router.get("/members").handler(handlers.listMembers());
    router.delete("/members/:id").handler(handlers.removeMember());

    router.get("/pending").handler(handlers.listPending());
    router.delete("/pending/:id").handler(handlers.revokeInvitation());
    router.post("/pending/:id/resend").handler(handlers.resendInvitation());

    router.post("/invite").handler(handlers.invite());
    router.get("/roles").handler(handlers.roles());
    
    router.get("/custom-roles").handler(handlers.listCustomRoles());
    router.post("/custom-roles").handler(handlers.saveCustomRole());
    router.delete("/custom-roles/:id").handler(handlers.deleteCustomRole());

    return router;
  }
}
