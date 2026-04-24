package com.openiv.backend.api.v1;

import com.openiv.backend.auth.handler.AccessRequestHandlers;
import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.service.AccessRequestService;
import com.openiv.backend.auth.service.AuthService;
import com.openiv.backend.db.Jooq;
import com.openiv.backend.security.RequireAuth;
import com.openiv.backend.security.SecurityConfig;
import com.openiv.backend.team.TeamRouter;
import com.openiv.backend.team.TeamService;
import com.openiv.backend.cases.CaseHandlers;
import com.openiv.backend.cases.CaseService;
import com.openiv.backend.transactions.TransactionHandlers;
import com.openiv.backend.transactions.TransactionService;
import com.openiv.backend.thresholds.ThresholdHandlers;
import com.openiv.backend.thresholds.ThresholdService;
import com.openiv.backend.webhooks.WebhookHandlers;
import com.openiv.backend.webhooks.WebhookService;
import io.vertx.core.Handler;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import io.vertx.sqlclient.Pool;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;

/**
 * Versioned API router. Mount new feature routers under {@code /api/v1} here.
 *
 * <p>Ordering note: the auth sub-router is mounted BEFORE the blanket {@link RequireAuth} gate
 * so that public auth endpoints (login, reset) are reachable pre-session. Inside
 * {@link AuthRouter} each route decides its own session requirements.
 */
public final class V1Router {

  private V1Router() {}

  public static Router create(Vertx vertx, Pool dbPool, SecurityConfig security,
      AuthService authService, AccessRequestService accessRequestService,
      TeamService teamService, TransactionService transactionService,
      CaseService caseService, ThresholdService thresholdService,
      WebhookService webhookService, boolean devMode) {
    Router router = Router.router(vertx);

    // Public, unauthenticated routes go here (if any).
    router.get("/").handler(V1Router::index);
    router.post("/access-requests")
        .handler(new AccessRequestHandlers(accessRequestService).submit());

    // Auth endpoints mount their own per-route session handlers.
    // Cookie flags: dev → not-Secure + SameSite=Lax (so :5173 can reach :8080 over HTTP);
    //               prod → Secure + SameSite=Strict.
    router.route("/auth/*").subRouter(AuthRouter.create(vertx, authService, !devMode));

    // Team management — requires an authenticated session (gate inside TeamRouter).
    router.route("/team/*").subRouter(TeamRouter.create(vertx, authService, teamService));

    // Transactions — two endpoints registered directly to avoid sub-router path-stripping on root.
    TransactionHandlers txnHandlers = new TransactionHandlers(transactionService);
    Handler<RoutingContext> txnAuth = SessionAuthHandler.authenticated(authService);
    router.get("/transactions").handler(txnAuth).handler(txnHandlers.list());
    router.get("/transactions/export").handler(txnAuth).handler(txnHandlers.export());
    router.post("/transactions/bulk-status").handler(txnAuth).handler(txnHandlers.bulkStatus());
    router.post("/transactions/import").handler(txnAuth).handler(txnHandlers.importTransactions());

    // Cases — metrics must be registered before /:id to avoid path collision
    CaseHandlers caseHandlers = new CaseHandlers(caseService);
    Handler<RoutingContext> caseAuth = SessionAuthHandler.authenticated(authService);
    router.get("/transactions/:id/case").handler(txnAuth).handler(caseHandlers.forTransaction());
    router.get("/cases/metrics").handler(caseAuth).handler(caseHandlers.metrics());
    router.get("/cases").handler(caseAuth).handler(caseHandlers.list());
    router.post("/cases").handler(caseAuth).handler(caseHandlers.create());
    router.get("/cases/:id").handler(caseAuth).handler(caseHandlers.detail());
    router.patch("/cases/:id/status").handler(caseAuth).handler(caseHandlers.updateStatus());
    router.post("/cases/:id/transactions").handler(caseAuth).handler(caseHandlers.linkTransaction());
    router.post("/cases/:id/notes").handler(caseAuth).handler(caseHandlers.addNote());
    router.post("/cases/:id/evidence").handler(caseAuth).handler(caseHandlers.addEvidence());

    // Thresholds — metrics before /:id to avoid path collision
    ThresholdHandlers thresholdHandlers = new ThresholdHandlers(thresholdService);
    Handler<RoutingContext> thresholdAuth = SessionAuthHandler.authenticated(authService);
    router.get("/thresholds/metrics").handler(thresholdAuth).handler(thresholdHandlers.metrics());
    router.get("/thresholds").handler(thresholdAuth).handler(thresholdHandlers.list());
    router.patch("/thresholds/:id").handler(thresholdAuth).handler(thresholdHandlers.update());
    router.get("/thresholds/:id/history").handler(thresholdAuth).handler(thresholdHandlers.history());

    // Webhooks — secret routes and specific sub-paths before /:id to avoid collision
    WebhookHandlers webhookHandlers = new WebhookHandlers(webhookService);
    Handler<RoutingContext> webhookAuth = SessionAuthHandler.authenticated(authService);
    router.get("/webhooks/secret").handler(webhookAuth).handler(webhookHandlers.getSecret());
    router.post("/webhooks/secret/rotate").handler(webhookAuth).handler(webhookHandlers.rotateSecret());
    router.patch("/webhooks/secret").handler(webhookAuth).handler(webhookHandlers.updateSecret());
    router.get("/webhooks").handler(webhookAuth).handler(webhookHandlers.listEndpoints());
    router.post("/webhooks").handler(webhookAuth).handler(webhookHandlers.createEndpoint());
    router.patch("/webhooks/:id").handler(webhookAuth).handler(webhookHandlers.updateEndpoint());
    router.delete("/webhooks/:id").handler(webhookAuth).handler(webhookHandlers.deleteEndpoint());
    router.post("/webhooks/:id/test").handler(webhookAuth).handler(webhookHandlers.testEndpoint());
    router.get("/webhooks/:id/deliveries").handler(webhookAuth).handler(webhookHandlers.listDeliveries());

    if (security.authRequired()) {
      router.route().handler(RequireAuth.notImplemented());
    }

    // Authenticated demo route.
    router.get("/time").handler(ctx -> dbTime(ctx, dbPool));

    return router;
  }

  private static void index(RoutingContext ctx) {
    JsonObject body = new JsonObject()
        .put("name", "openiv-backend")
        .put("version", "v1");
    ctx.response()
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }

  private static void dbTime(RoutingContext ctx, Pool dbPool) {
    if (dbPool == null) {
      ctx.response()
          .setStatusCode(503)
          .putHeader("content-type", "application/json; charset=utf-8")
          .end(new JsonObject().put("error", "database not configured").encode());
      return;
    }
    DSLContext dsl = Jooq.dsl();
    var query = dsl.select(DSL.currentTimestamp().as("now"));

    Jooq.execute(dbPool, query, row -> row.getOffsetDateTime(0))
        .onSuccess(rows -> {
          var ts = rows.iterator().next();
          ctx.response()
              .putHeader("content-type", "application/json; charset=utf-8")
              .end(new JsonObject().put("now", ts.toString()).encode());
        })
        .onFailure(ctx::fail);
  }
}
