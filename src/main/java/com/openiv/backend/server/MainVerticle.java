package com.openiv.backend.server;

import com.openiv.backend.api.ApiRouter;
import com.openiv.backend.auth.service.AccessRequestService;
import com.openiv.backend.auth.service.AuthService;
import com.openiv.backend.config.AppConfig;
import com.openiv.backend.team.TeamService;
import com.openiv.backend.cases.CaseService;
import com.openiv.backend.transactions.TransactionService;
import com.openiv.backend.thresholds.ThresholdService;
import com.openiv.backend.beam.BeamService;
import com.openiv.backend.heatmap.HeatmapService;
import com.openiv.backend.kyc.KycService;
import com.openiv.backend.webhooks.WebhookService;
import io.vertx.core.AbstractVerticle;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.http.HttpServer;
import io.vertx.ext.web.Router;
import io.vertx.sqlclient.Pool;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * One verticle instance per event loop. {@code Main} deploys N copies that share the same
 * {@link Pool}, {@link AppConfig}, and services.
 */
public final class MainVerticle extends AbstractVerticle {

  private static final Logger log = LoggerFactory.getLogger(MainVerticle.class);

  private final AppConfig config;
  private final Pool dbPool;
  private final AuthService authService;
  private final AccessRequestService accessRequestService;
  private final TeamService teamService;
  private final TransactionService transactionService;
  private final CaseService        caseService;
  private final ThresholdService   thresholdService;
  private final WebhookService     webhookService;
  private final BeamService        beamService;
  private final KycService         kycService;
  private final HeatmapService     heatmapService;
  private HttpServer httpServer;

  public MainVerticle(AppConfig config, Pool dbPool, AuthService authService,
      AccessRequestService accessRequestService, TeamService teamService,
      TransactionService transactionService, CaseService caseService,
      ThresholdService thresholdService, WebhookService webhookService,
      BeamService beamService, KycService kycService, HeatmapService heatmapService) {
    this.config = config;
    this.dbPool = dbPool;
    this.authService = authService;
    this.accessRequestService = accessRequestService;
    this.teamService = teamService;
    this.transactionService = transactionService;
    this.caseService = caseService;
    this.thresholdService = thresholdService;
    this.webhookService = webhookService;
    this.beamService = beamService;
    this.kycService = kycService;
    this.heatmapService = heatmapService;
  }

  /** Test convenience constructor — no services, DB-less routes only. */
  public MainVerticle(AppConfig config, Pool dbPool) {
    this(config, dbPool, null, null, null, null, null, null, null, null, null, null);
  }

  @Override
  public void start(Promise<Void> startPromise) {
    startHttpServer()
        .onSuccess(v -> startPromise.complete())
        .onFailure(startPromise::fail);
  }

  @Override
  public void stop(Promise<Void> stopPromise) {
    if (httpServer == null) {
      stopPromise.complete();
      return;
    }
    httpServer.close()
        .onSuccess(v -> stopPromise.complete())
        .onFailure(stopPromise::fail);
  }

  /** The port the HTTP server is listening on, or -1 if not started. */
  public int httpPort() {
    return httpServer == null ? -1 : httpServer.actualPort();
  }

  private Future<Void> startHttpServer() {
    Router router = Router.router(vertx);
    ApiRouter.mount(vertx, router, dbPool, config.security(),
        authService, accessRequestService, teamService, transactionService,
        caseService, thresholdService, webhookService, config.isDevelopment(), beamService,
        kycService, heatmapService);

    return vertx.createHttpServer(
            HttpServerOptionsFactory.forProduction(
                config.http().port(),
                config.http().host(),
                vertx.isNativeTransportEnabled()))
        .requestHandler(router)
        .listen()
        .onSuccess(server -> {
          httpServer = server;
          log.info("HTTP server listening on {}:{}", config.http().host(), server.actualPort());
        })
        .mapEmpty();
  }
}
