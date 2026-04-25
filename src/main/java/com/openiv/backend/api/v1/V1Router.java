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
import com.openiv.backend.beam.BeamApiKeyHandler;
import com.openiv.backend.beam.BeamHandlers;
import com.openiv.backend.beam.BeamService;
import com.openiv.backend.heatmap.HeatmapHandlers;
import com.openiv.backend.heatmap.HeatmapService;
import com.openiv.backend.kyc.KycHandlers;
import com.openiv.backend.kyc.KycService;
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
      WebhookService webhookService, boolean devMode, BeamService beamService,
      KycService kycService, HeatmapService heatmapService) {
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

    // Beam API key auth for ingest endpoints
    BeamHandlers beamHandlers = new BeamHandlers(beamService);
    BeamApiKeyHandler beamApiKeyHandler = new BeamApiKeyHandler(beamService);
    Handler<RoutingContext> beamSessionAuth = SessionAuthHandler.authenticated(authService);

    // Beam management — session authenticated (must be before /:stream to avoid param capture)
    router.get("/beam/records").handler(beamSessionAuth).handler(beamHandlers.listRecords());
    router.get("/beam/api-key").handler(beamSessionAuth).handler(beamHandlers.getApiKeyInfo());
    router.post("/beam/api-key").handler(beamSessionAuth).handler(beamHandlers.generateApiKey());
    router.delete("/beam/api-key").handler(beamSessionAuth).handler(beamHandlers.revokeApiKey());

    // Inbound beam ingestion — authenticated with institution API key (not session)
    router.post("/beam/:stream").handler(beamApiKeyHandler.resolve()).handler(beamHandlers.ingest());

    // Webhooks — fixed paths before /:id to avoid collision
    WebhookHandlers webhookHandlers = new WebhookHandlers(webhookService);
    Handler<RoutingContext> webhookAuth = SessionAuthHandler.authenticated(authService);
    router.get("/webhooks/secret").handler(webhookAuth).handler(webhookHandlers.getSecret());
    router.post("/webhooks/secret/rotate").handler(webhookAuth).handler(webhookHandlers.rotateSecret());
    router.patch("/webhooks/secret").handler(webhookAuth).handler(webhookHandlers.updateSecret());
    router.get("/webhooks/deliveries").handler(webhookAuth).handler(webhookHandlers.listAllDeliveries());
    router.get("/webhooks").handler(webhookAuth).handler(webhookHandlers.listEndpoints());
    router.post("/webhooks").handler(webhookAuth).handler(webhookHandlers.createEndpoint());
    router.patch("/webhooks/:id").handler(webhookAuth).handler(webhookHandlers.updateEndpoint());
    router.delete("/webhooks/:id").handler(webhookAuth).handler(webhookHandlers.deleteEndpoint());
    router.post("/webhooks/:id/test").handler(webhookAuth).handler(webhookHandlers.testEndpoint());
    router.get("/webhooks/:id/deliveries").handler(webhookAuth).handler(webhookHandlers.listDeliveries());
    router.get("/webhooks/:id/security").handler(webhookAuth).handler(webhookHandlers.getSecurityRule());
    router.put("/webhooks/:id/security").handler(webhookAuth).handler(webhookHandlers.upsertSecurityRule());
    router.post("/webhooks/:id/security/api-key").handler(webhookAuth).handler(webhookHandlers.generateApiKey());

    // KYC — lookup URL config and manual lookup trigger
    KycHandlers kycHandlers = new KycHandlers(kycService);
    Handler<RoutingContext> kycAuth = SessionAuthHandler.authenticated(authService);
    router.get("/kyc/config").handler(kycAuth).handler(kycHandlers.getConfig());
    router.put("/kyc/config").handler(kycAuth).handler(kycHandlers.saveConfig());
    router.post("/kyc/lookup").handler(kycAuth).handler(kycHandlers.lookup());
    router.get("/kyc/logs").handler(kycAuth).handler(kycHandlers.listLogs());

    // Heatmaps — day-of-week × hour density from transactions and login beam records
    HeatmapHandlers heatmapHandlers = new HeatmapHandlers(heatmapService);
    Handler<RoutingContext> heatmapAuth = SessionAuthHandler.authenticated(authService);
    router.get("/heatmap/transactions").handler(heatmapAuth).handler(heatmapHandlers.transactions());
    router.get("/heatmap/activity").handler(heatmapAuth).handler(heatmapHandlers.activity());

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
