package com.openiv.backend;

import com.openiv.backend.auth.crypto.TotpCipher;
import com.openiv.backend.auth.repository.AccessRequestRepository;
import com.openiv.backend.auth.repository.BlockedDeviceRepository;
import com.openiv.backend.auth.repository.InstitutionRepository;
import com.openiv.backend.auth.repository.InvitationRepository;
import com.openiv.backend.auth.repository.SessionRepository;
import com.openiv.backend.auth.repository.SessionTransferRepository;
import com.openiv.backend.auth.repository.TotpSecretRepository;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.repository.VerificationCodeRepository;
import com.openiv.backend.auth.service.AccessRequestService;
import com.openiv.backend.auth.service.DevDemoBankSeeder;
import com.openiv.backend.team.TeamService;
import com.openiv.backend.team.CustomRoleRepository;
// import com.openiv.backend.cases.CaseRepository;
import com.openiv.backend.cases.CaseService;
import com.openiv.backend.transactions.TransactionRepository;
import com.openiv.backend.transactions.TransactionService;
// import com.openiv.backend.thresholds.ThresholdRepository;
import com.openiv.backend.thresholds.ThresholdService;
import com.openiv.backend.beam.BeamRepository;
import com.openiv.backend.beam.BeamService;
import com.openiv.backend.beam.OtpAlertRepository;
import com.openiv.backend.beam.OtpAnalyzer;
import com.openiv.backend.dashboard.DashboardRepository;
import com.openiv.backend.dashboard.DashboardService;
import com.openiv.backend.geofence.GeoFenceRepository;
import com.openiv.backend.geofence.GeoFenceService;
import com.openiv.backend.heatmap.HeatmapRepository;
import com.openiv.backend.heatmap.HeatmapService;
import com.openiv.backend.kyc.KycRepository;
import com.openiv.backend.kyc.KycService;
import com.openiv.backend.aml.AmlSettingsRepository;
import com.openiv.backend.webhooks.WebhookDeliveryService;
import com.openiv.backend.webhooks.WebhookRepository;
import com.openiv.backend.webhooks.WebhookService;
import com.openiv.backend.customers.CustomerRepository;
import com.openiv.backend.customers.CustomerService;
import io.vertx.ext.web.client.WebClient;
import io.vertx.ext.web.client.WebClientOptions;
import com.openiv.backend.auth.service.AuthService;
import com.openiv.backend.auth.service.DevInviteSeeder;
import com.openiv.backend.auth.service.EmailSender;
import com.openiv.backend.auth.service.LogEmailSender;
import com.openiv.backend.auth.service.VertxEmailSender;
import com.openiv.backend.config.AppConfig;
import com.openiv.backend.config.ConfigLoader;
import com.openiv.backend.db.DataSources;
import com.openiv.backend.db.Migrations;
import com.openiv.backend.server.MainVerticle;
import io.vertx.core.DeploymentOptions;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.VertxOptions;
import io.vertx.sqlclient.Pool;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Application entry point.
 *
 * <p>
 * Startup sequence:
 * <ol>
 * <li>Create Vert.x with an event-loop pool sized to the host CPU.</li>
 * <li>Load config.</li>
 * <li>Run Flyway migrations (blocking, on a worker thread).</li>
 * <li>Build the reactive Postgres pool (shared across all verticle
 * instances).</li>
 * <li>Construct repositories + AuthService (singleton; the pool is
 * shared).</li>
 * <li>In development: seed a dev invite if none exists (the code is
 * logged).</li>
 * <li>Deploy {@code MainVerticle} × N so every event loop owns an HTTP
 * server.</li>
 * </ol>
 */
public final class Main {

  private static final Logger log = LoggerFactory.getLogger(Main.class);

  private Main() {
  }

  public static void main(String[] args) {
    System.setProperty("vertx.logger-delegate-factory-class-name",
        "io.vertx.core.logging.SLF4JLogDelegateFactory");
    System.setProperty("user.timezone", "Africa/Lagos");
    java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("Africa/Lagos"));

    int cores = Runtime.getRuntime().availableProcessors();

    VertxOptions vertxOptions = new VertxOptions()
        .setEventLoopPoolSize(cores)
        .setWorkerPoolSize(Math.max(8, cores * 2))
        .setPreferNativeTransport(true);

    Vertx vertx = Vertx.vertx(vertxOptions);
    log.info("Vert.x started: cores={}, nativeTransport={}, timezone={}",
        cores, vertx.isNativeTransportEnabled(), java.util.TimeZone.getDefault().getID());

    startup(vertx, cores)
        .onFailure(err -> {
          log.error("Startup failed", err);
          // Try to close Vert.x gracefully so ports are released, but don't trust it: if
          // close() hangs (which it can if a verticle is in a bad state), the JVM stays
          // up
          // holding the port. The watchdog thread below hard-halts after 3s.
          Thread halter = new Thread(() -> {
            try {
              Thread.sleep(3_000);
            } catch (InterruptedException ignored) {
              return;
            }
            log.error("Graceful close exceeded 3s; calling Runtime.halt(1)");
            Runtime.getRuntime().halt(1);
          }, "openiv-force-halt");
          halter.setDaemon(true);
          halter.start();
          vertx.close().onComplete(ignored -> System.exit(1));
        });
  }

  private static Future<Void> startup(Vertx vertx, int cores) {
    return ConfigLoader.load(vertx).compose(config -> {
      log.info("Environment: {}", config.environment());
      return migrateIfEnabled(vertx, config).compose(v -> {
        Pool pool = DataSources.reactivePool(vertx, config.db());
        installShutdownHook(vertx, pool);

        UserRepository users = new UserRepository(pool);
        InvitationRepository invitations = new InvitationRepository(pool);
        InstitutionRepository institutions = new InstitutionRepository(pool);
        AccessRequestRepository accessRequests = new AccessRequestRepository(pool);
        VerificationCodeRepository codes = new VerificationCodeRepository(pool);
        TotpSecretRepository totp = new TotpSecretRepository(pool);
        SessionRepository sessions = new SessionRepository(pool);
        BlockedDeviceRepository blockedDevices = new BlockedDeviceRepository(pool);
        SessionTransferRepository transfers = new SessionTransferRepository(pool);
        EmailSender emailSender;
        if (config.email().enabled()) {
          emailSender = new VertxEmailSender(vertx, config.email());
        } else {
          emailSender = new LogEmailSender();
          log.warn("No email config; using LogEmailSender. Add an \"email\" block to application.json to enable SMTP.");
        }

        TotpCipher totpCipher = TotpCipher.fromPem(
            config.totp().publicKeyPem(), config.totp().privateKeyPem());
        log.info("TOTP cipher initialized (RSA-OAEP-SHA256)");

        AuthService authService = new AuthService(
            users, invitations, codes, totp, sessions, emailSender, totpCipher,
            blockedDevices, transfers, vertx);
        AccessRequestService accessRequestService = new AccessRequestService(accessRequests);
        CustomRoleRepository customRoles = new CustomRoleRepository(pool);
        TeamService teamService = new TeamService(users, invitations, institutions, customRoles, emailSender);
        CustomerRepository customerRepository = new CustomerRepository(pool);
        CustomerService customerService = new CustomerService(customerRepository);
        TransactionService transactionService = new TransactionService(new TransactionRepository(pool), users, customerService);
        var caseRepository = new com.openiv.backend.cases.CaseRepository(pool);
        AmlSettingsRepository amlSettingsRepository = new AmlSettingsRepository(pool);
        CaseService caseService = new CaseService(caseRepository, users, amlSettingsRepository);
        var thresholdRepository = new com.openiv.backend.thresholds.ThresholdRepository(pool);
        ThresholdService thresholdService = new ThresholdService(thresholdRepository, users);
        WebhookRepository webhookRepository = new WebhookRepository(pool);
        WebClient webClient = WebClient.create(vertx,
            new WebClientOptions().setFollowRedirects(false).setSsl(true).setTrustAll(false));
        WebhookDeliveryService webhookDeliveryService = new WebhookDeliveryService(webClient, webhookRepository);
        WebhookService webhookService = new WebhookService(webhookRepository, users, webhookDeliveryService);
        BeamRepository beamRepository = new BeamRepository(pool);
        OtpAlertRepository otpAlertRepository = new OtpAlertRepository(pool, vertx);
        OtpAnalyzer otpAnalyzer = new OtpAnalyzer(otpAlertRepository);

        // Fraud detection services
        var notificationService = new com.openiv.backend.notifications.NotificationService(pool, vertx);
        var fraudDetectionBillingService = new com.openiv.backend.billing.FraudDetectionBillingService(pool);
        var autoCaseService = new com.openiv.backend.cases.AutoCaseCreationService(caseRepository);

        // KYC service — needed by fraud pipeline for automatic KYC lookups
        KycService kycService = new KycService(new KycRepository(pool), users, webClient, caseService, notificationService);

        var hybridAnalysis = new com.openiv.backend.transactions.HybridTransactionAnalysisService(
            new com.openiv.backend.transactions.TransactionScorer(),
            autoCaseService,
            thresholdRepository,
            pool,
            kycService,
            amlSettingsRepository,
            emailSender,
            new com.openiv.backend.behavioral.BehavioralRuleRepository(pool));
        var orchestrator = new com.openiv.backend.transactions.TransactionProcessingOrchestrator(
            hybridAnalysis, fraudDetectionBillingService, notificationService);

        BeamService beamService = new BeamService(beamRepository, users, otpAnalyzer, transactionService,
            webhookService,
            orchestrator, notificationService, customerService);
        HeatmapService heatmapService = new HeatmapService(new HeatmapRepository(pool), users);
        DashboardService dashboardService = new DashboardService(new DashboardRepository(pool), users);
        GeoFenceService geoFenceService = new GeoFenceService(
            new GeoFenceRepository(pool), users, sessions, vertx);
        authService.setGeoFence(geoFenceService);

        return DevInviteSeeder.runIfDev(config.isDevelopment(), invitations, institutions)
            .compose(ignored -> DevDemoBankSeeder.runIfDev(config.isDevelopment(), institutions, users))
            .compose(ignored -> deployVerticles(
                vertx, config, pool, sessions, authService, accessRequestService,
                teamService, transactionService, caseService, thresholdService, webhookService,
                beamService, kycService, heatmapService, dashboardService, geoFenceService, customerService, cores))
            .onSuccess(res -> scheduleWebhookAutoRotation(vertx, webhookService));
      });
    });
  }

  private static Future<Void> migrateIfEnabled(Vertx vertx, AppConfig config) {
    if (!config.db().migrate()) {
      log.info("Skipping migrations (db.migrate=false)");
      return Future.succeededFuture();
    }
    return Migrations.run(vertx, config.db());
  }

  private static Future<Void> deployVerticles(Vertx vertx, AppConfig config, Pool pool,
      SessionRepository sessions, AuthService authService, AccessRequestService accessRequestService,
      TeamService teamService, TransactionService transactionService,
      CaseService caseService, ThresholdService thresholdService,
      WebhookService webhookService, BeamService beamService,
      KycService kycService, HeatmapService heatmapService,
      DashboardService dashboardService, GeoFenceService geoFenceService,
      CustomerService customerService, int instances) {
    DeploymentOptions opts = new DeploymentOptions().setInstances(instances);
    return vertx
        .deployVerticle(
            () -> new MainVerticle(config, pool, sessions, authService, accessRequestService,
                teamService, transactionService, caseService, thresholdService, webhookService,
                beamService, kycService, heatmapService, dashboardService, geoFenceService, customerService),
            opts)
        .onSuccess(id -> log.info("Deployed {} MainVerticle instance(s)", instances))
        .mapEmpty();
  }

  private static void scheduleWebhookAutoRotation(Vertx vertx, WebhookService webhookService) {
    // Run once immediately on startup, then every hour, to rotate any expired
    // signing secrets.
    long oneHourMs = 3_600_000L;
    Runnable rotate = () -> webhookService.rotateExpiredSecrets()
        .onSuccess(n -> {
          if (n > 0)
            log.info("Auto-rotated {} webhook signing secret(s)", n);
        })
        .onFailure(err -> log.error("Webhook secret auto-rotation failed", err));
    rotate.run();
    vertx.setPeriodic(oneHourMs, id -> rotate.run());
  }

  private static void installShutdownHook(Vertx vertx, Pool pool) {
    AtomicBoolean closed = new AtomicBoolean(false);
    Runtime.getRuntime().addShutdownHook(new Thread(() -> {
      if (!closed.compareAndSet(false, true)) {
        return;
      }
      log.info("Shutting down");
      try {
        pool.close().toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
      } catch (Exception e) {
        log.debug("DB pool already closed or Vert.x context unavailable: {}", e.getMessage());
      }
      try {
        vertx.close().toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
      } catch (Exception e) {
        log.debug("Vert.x already closed: {}", e.getMessage());
      }
    }, "openiv-shutdown"));
  }
}
