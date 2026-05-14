package com.openiv.backend.api.v1;

import com.openiv.backend.auth.handler.AccessRequestHandlers;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.billing.BillingHandlers;
import com.openiv.backend.billing.BillingRepository;
import com.openiv.backend.billing.BillingService;
import com.openiv.backend.nfiu.NfiuHandlers;
import com.openiv.backend.nfiu.NfiuRepository;
import com.openiv.backend.nfiu.NfiuService;
import com.openiv.backend.documents.DocumentHandlers;
import com.openiv.backend.documents.DocumentRepository;
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
import com.openiv.backend.transactions.TransactionRepository;
import com.openiv.backend.transactions.TransactionService;
import com.openiv.backend.thresholds.ThresholdHandlers;
import com.openiv.backend.thresholds.ThresholdService;
import com.openiv.backend.beam.BeamApiKeyHandler;
import com.openiv.backend.beam.BeamHandlers;
import com.openiv.backend.beam.BeamRepository;
import com.openiv.backend.beam.BeamService;
import com.openiv.backend.dashboard.DashboardHandlers;
import com.openiv.backend.dashboard.DashboardService;
import com.openiv.backend.geofence.GeoFenceHandlers;
import com.openiv.backend.geofence.GeoFenceService;
import com.openiv.backend.settings.EurekaSettingHandlers;
import com.openiv.backend.heatmap.HeatmapHandlers;
import com.openiv.backend.heatmap.HeatmapService;
import com.openiv.backend.kyc.KycHandlers;
import com.openiv.backend.kyc.KycService;
import com.openiv.backend.aml.AmlHandlers;
import com.openiv.backend.network.NetworkHandlers;
import com.openiv.backend.network.NetworkRepository;
import com.openiv.backend.network.NetworkService;
import com.openiv.backend.webhooks.WebhookHandlers;
import com.openiv.backend.webhooks.WebhookService;
import com.openiv.backend.behavioral.BehavioralRuleHandlers;
import com.openiv.backend.behavioral.BehavioralRuleRepository;
import com.openiv.backend.behavioral.BehavioralRuleService;
import com.openiv.backend.transactions.TransactionHandlers;
import com.openiv.backend.transactions.TransactionRepository;
import com.openiv.backend.transactions.TransactionService;
import com.openiv.backend.analytics.UserAnalyticsHandlers;
import com.openiv.backend.analytics.UserAnalyticsService;
import com.openiv.backend.customers.CustomerHandlers;
import com.openiv.backend.customers.CustomerRepository;
import com.openiv.backend.customers.CustomerService;
import com.openiv.backend.institution.InstitutionHandlers;
import com.openiv.backend.auth.repository.InstitutionRepository;
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
 * <p>
 * Ordering note: the auth sub-router is mounted BEFORE the blanket
 * {@link RequireAuth} gate
 * so that public auth endpoints (login, reset) are reachable pre-session.
 * Inside
 * {@link AuthRouter} each route decides its own session requirements.
 */
public final class V1Router {

  private V1Router() {
  }

  public static Router create(Vertx vertx, Pool dbPool, SecurityConfig security,
      AuthService authService, AccessRequestService accessRequestService,
      TeamService teamService, TransactionService transactionService,
      CaseService caseService, ThresholdService thresholdService,
      WebhookService webhookService, boolean devMode, BeamService beamService,
      KycService kycService, HeatmapService heatmapService,
      DashboardService dashboardService, GeoFenceService geoFenceService,
      CustomerService customerService) {
    Router router = Router.router(vertx);

    // Public, unauthenticated routes go here (if any).
    router.get("/").handler(V1Router::index);
    router.post("/access-requests")
        .handler(new AccessRequestHandlers(accessRequestService).submit());

    // Auth endpoints mount their own per-route session handlers.
    // Cookie flags: dev → not-Secure + SameSite=Lax (so :5173 can reach :8080 over
    // HTTP);
    // prod → Secure + SameSite=Strict.
    router.route("/auth/*").subRouter(AuthRouter.create(vertx, authService, !devMode));

    // Team management — requires an authenticated session (gate inside TeamRouter).
    router.route("/team/*").subRouter(TeamRouter.create(vertx, authService, teamService));

    // Billing — instantiated first; referenced by Transactions, Cases, Beam, KYC,
    // Dashboard
    String paystackSecret = System.getenv().getOrDefault("PAYSTACK_SECRET_KEY", "sk_test_placeholder");
    String paystackPublic = System.getenv().getOrDefault("PAYSTACK_PUBLIC_KEY", "pk_test_placeholder");
    String billingEncKey = System.getenv("BILLING_ENCRYPTION_KEY"); // null → dev fallback inside service
    BillingService billingService = new BillingService(
        new BillingRepository(dbPool), new UserRepository(dbPool),
        vertx, paystackSecret, billingEncKey);
    BillingHandlers billingHandlers = new BillingHandlers(billingService, paystackPublic);
    Handler<RoutingContext> billingAuth = SessionAuthHandler.authenticated(authService);
    router.get("/billing/config").handler(billingHandlers.getConfig());
    router.get("/billing/summary").handler(billingAuth).handler(billingHandlers.getSummary());
    router.get("/billing/usage").handler(billingAuth).handler(billingHandlers.getUsage());
    router.get("/billing/ledger").handler(billingAuth).handler(billingHandlers.getLedger());
    router.get("/billing/payment-methods").handler(billingAuth).handler(billingHandlers.listPaymentMethods());
    router.delete("/billing/payment-methods/:id").handler(billingAuth).handler(billingHandlers.deletePaymentMethod());
    router.post("/billing/payment/initialize").handler(billingAuth).handler(billingHandlers.initializePayment());
    router.post("/billing/payment/verify").handler(billingAuth).handler(billingHandlers.verifyPayment());
    router.post("/billing/topup").handler(billingAuth).handler(billingHandlers.topup());
    router.post("/billing/card/charge").handler(billingAuth).handler(billingHandlers.chargeCard());
    router.post("/billing/card/challenge").handler(billingAuth).handler(billingHandlers.submitChallenge());

    // NFIU compliance — reports and scheduled filings
    NfiuService nfiuService = new NfiuService(
        new NfiuRepository(dbPool), new UserRepository(dbPool), billingService);
    NfiuHandlers nfiuHandlers = new NfiuHandlers(nfiuService);
    Handler<RoutingContext> nfiuAuth = SessionAuthHandler.authenticated(authService);
    router.get("/nfiu/metrics").handler(nfiuAuth).handler(nfiuHandlers.getMetrics());
    router.get("/nfiu/reports").handler(nfiuAuth).handler(nfiuHandlers.listReports());
    router.post("/nfiu/reports").handler(nfiuAuth).handler(nfiuHandlers.createReport());
    router.post("/nfiu/reports/:id/file").handler(nfiuAuth).handler(nfiuHandlers.fileReport());
    router.post("/nfiu/reports/:id/approve").handler(nfiuAuth).handler(nfiuHandlers.approveReport());
    router.get("/nfiu/reports/:id").handler(nfiuAuth).handler(nfiuHandlers.getReport());
    router.patch("/nfiu/reports/:id").handler(nfiuAuth).handler(nfiuHandlers.updateReport());
    router.delete("/nfiu/reports/:id").handler(nfiuAuth).handler(nfiuHandlers.deleteReport());
    router.get("/nfiu/schedules").handler(nfiuAuth).handler(nfiuHandlers.listSchedules());
    router.post("/nfiu/schedules").handler(nfiuAuth).handler(nfiuHandlers.createSchedule());
    router.patch("/nfiu/schedules/:id").handler(nfiuAuth).handler(nfiuHandlers.updateSchedule());
    router.delete("/nfiu/schedules/:id").handler(nfiuAuth).handler(nfiuHandlers.deleteSchedule());

    // Transactions — two endpoints registered directly to avoid sub-router
    // path-stripping on root.
    TransactionHandlers txnHandlers = new TransactionHandlers(transactionService, billingService);
    Handler<RoutingContext> txnAuth = SessionAuthHandler.authenticated(authService);
    router.get("/transactions").handler(txnAuth).handler(txnHandlers.list());
    router.get("/transactions/export").handler(txnAuth).handler(txnHandlers.export());
    router.post("/transactions/bulk-status").handler(txnAuth).handler(txnHandlers.bulkStatus());
    router.post("/transactions/import").handler(txnAuth).handler(txnHandlers.importTransactions());
    router.patch("/transactions/:id/seen").handler(txnAuth).handler(txnHandlers.markSeen());
    router.get("/transactions/:id").handler(txnAuth).handler(txnHandlers.getById());

    // Cases — metrics must be registered before /:id to avoid path collision
    CaseHandlers caseHandlers = new CaseHandlers(caseService, billingService);
    Handler<RoutingContext> caseAuth = SessionAuthHandler.authenticated(authService);
    router.get("/transactions/:id/case").handler(txnAuth).handler(caseHandlers.forTransaction());
    router.get("/cases/metrics").handler(caseAuth).handler(caseHandlers.metrics());
    router.get("/cases/pending-approval").handler(caseAuth).handler(caseHandlers.listPendingApproval());
    router.get("/cases").handler(caseAuth).handler(caseHandlers.list());
    router.post("/cases").handler(caseAuth).handler(caseHandlers.create());
    router.get("/cases/:id").handler(caseAuth).handler(caseHandlers.detail());
    router.patch("/cases/:id/status").handler(caseAuth).handler(caseHandlers.updateStatus());
    router.post("/cases/:id/transactions").handler(caseAuth).handler(caseHandlers.linkTransaction());
    router.post("/cases/:id/notes").handler(caseAuth).handler(caseHandlers.addNote());
    router.post("/cases/:id/evidence").handler(caseAuth).handler(caseHandlers.addEvidence());
    router.post("/cases/:id/assign").handler(caseAuth).handler(caseHandlers.assignCase());
    router.get("/cases/unseen-count").handler(caseAuth).handler(caseHandlers.unseenCount());
    router.patch("/cases/:id/seen").handler(caseAuth).handler(caseHandlers.markSeen());
    router.patch("/cases/:id/link-nfiu-report").handler(caseAuth).handler(caseHandlers.linkNfiuReport());

    // Thresholds — metrics before /:id to avoid path collision
    ThresholdHandlers thresholdHandlers = new ThresholdHandlers(thresholdService);
    Handler<RoutingContext> thresholdAuth = SessionAuthHandler.authenticated(authService);
    router.get("/thresholds/metrics").handler(thresholdAuth).handler(thresholdHandlers.metrics());
    router.get("/thresholds/kyc-status").handler(thresholdAuth).handler(thresholdHandlers.kycStatus());
    router.post("/thresholds/kyc-suppress").handler(thresholdAuth).handler(thresholdHandlers.suppressKyc());
    router.get("/thresholds/kyc-tiers").handler(thresholdAuth).handler(thresholdHandlers.listKycTiers());
    router.patch("/thresholds/kyc-tiers/:tier").handler(thresholdAuth).handler(thresholdHandlers.updateKycTier());
    router.get("/thresholds").handler(thresholdAuth).handler(thresholdHandlers.list());
    router.patch("/thresholds/:id").handler(thresholdAuth).handler(thresholdHandlers.update());
    router.get("/thresholds/:id/history").handler(thresholdAuth).handler(thresholdHandlers.history());

    // Behavioral rules
    BehavioralRuleService behavioralRuleService = new BehavioralRuleService(
        new BehavioralRuleRepository(dbPool), new UserRepository(dbPool));
    BehavioralRuleHandlers behavioralRuleHandlers = new BehavioralRuleHandlers(behavioralRuleService);
    Handler<RoutingContext> behavioralAuth = SessionAuthHandler.authenticated(authService);
    router.get("/behavioral-rules").handler(behavioralAuth).handler(behavioralRuleHandlers.list());
    router.patch("/behavioral-rules/:id").handler(behavioralAuth).handler(behavioralRuleHandlers.update());

    // Beam API key auth for ingest endpoints
    BeamHandlers beamHandlers = new BeamHandlers(beamService, billingService);
    BeamApiKeyHandler beamApiKeyHandler = new BeamApiKeyHandler(beamService, authService);
    Handler<RoutingContext> beamSessionAuth = SessionAuthHandler.authenticated(authService);

    // Beam management — session authenticated (must be before /:stream to avoid
    // param capture)
    router.get("/beam/records").handler(beamSessionAuth).handler(beamHandlers.listRecords());
    router.get("/beam/api-key").handler(beamSessionAuth).handler(beamHandlers.getApiKeyInfo());
    router.post("/beam/api-key").handler(beamSessionAuth).handler(beamHandlers.generateApiKey());
    router.delete("/beam/api-key").handler(beamSessionAuth).handler(beamHandlers.revokeApiKey());

    // Inbound beam ingestion — authenticated with institution API key (not session)
    router.post("/beam/:stream").handler(beamApiKeyHandler.resolve()).handler(beamHandlers.ingest());

    // Webhooks — fixed paths before /:id to avoid collision
    WebhookHandlers webhookHandlers = new WebhookHandlers(webhookService, authService);
    Handler<RoutingContext> webhookAuth = SessionAuthHandler.authenticated(authService);
    router.get("/webhooks/secret").handler(webhookAuth).handler(webhookHandlers.getSecret());
    router.post("/webhooks/secret/rotate").handler(webhookAuth).handler(webhookHandlers.rotateSecret());
    router.patch("/webhooks/secret").handler(webhookAuth).handler(webhookHandlers.updateSecret());
    router.get("/webhooks/deliveries").handler(webhookAuth).handler(webhookHandlers.listAllDeliveries());
    router.get("/webhooks").handler(webhookAuth).handler(webhookHandlers.listEndpoints());
    router.post("/webhooks/verify").handler(webhookAuth).handler(webhookHandlers.verifyEndpoint());
    router.post("/webhooks").handler(webhookAuth).handler(webhookHandlers.createEndpoint());
    router.patch("/webhooks/:id").handler(webhookAuth).handler(webhookHandlers.updateEndpoint());
    router.delete("/webhooks/:id").handler(webhookAuth).handler(webhookHandlers.deleteEndpoint());
    router.post("/webhooks/:id/test").handler(webhookAuth).handler(webhookHandlers.testEndpoint());
    router.get("/webhooks/:id/deliveries").handler(webhookAuth).handler(webhookHandlers.listDeliveries());
    router.get("/webhooks/:id/security").handler(webhookAuth).handler(webhookHandlers.getSecurityRule());
    router.put("/webhooks/:id/security").handler(webhookAuth).handler(webhookHandlers.upsertSecurityRule());
    router.post("/webhooks/:id/security/api-key").handler(webhookAuth).handler(webhookHandlers.generateApiKey());

    // Network logs — unified beam + webhook traffic view
    NetworkHandlers networkHandlers = new NetworkHandlers(
        new NetworkService(new NetworkRepository(dbPool), new UserRepository(dbPool)));
    Handler<RoutingContext> networkAuth = SessionAuthHandler.authenticated(authService);
    router.get("/network/logs").handler(networkAuth).handler(networkHandlers.listLogs());

    // KYC — lookup URL config and manual lookup trigger
    KycHandlers kycHandlers = new KycHandlers(kycService, billingService);
    Handler<RoutingContext> kycAuth = SessionAuthHandler.authenticated(authService);
    router.get("/kyc/config").handler(kycAuth).handler(kycHandlers.getConfig());
    router.put("/kyc/config").handler(kycAuth).handler(kycHandlers.saveConfig());
    router.get("/kyc/pep-search").handler(kycAuth).handler(kycHandlers.searchPEP());
    router.post("/kyc/lookup").handler(kycAuth).handler(kycHandlers.lookup());

    router.get("/kyc/logs").handler(kycAuth).handler(kycHandlers.listLogs());

    // AML Settings — institution-level configuration for auto case opening
    AmlHandlers amlHandlers = new AmlHandlers(caseService);
    Handler<RoutingContext> amlAuth = SessionAuthHandler.authenticated(authService);
    router.get("/aml-settings").handler(amlAuth).handler(amlHandlers.getSettings());
    router.put("/aml-settings").handler(amlAuth).handler(amlHandlers.updateSettings());
    router.patch("/aml-settings/beam-window").handler(amlAuth).handler(amlHandlers.updateBeamWindow());
    router.patch("/aml-settings/timezone").handler(amlAuth).handler(amlHandlers.updateTimezone());
    router.post("/aml-settings/notifications/email").handler(amlAuth).handler(amlHandlers.addNotificationEmail());
    router.delete("/aml-settings/notifications/email").handler(amlAuth).handler(amlHandlers.removeNotificationEmail());

    // Documents — compliance evidence files (upload + download)
    DocumentHandlers docHandlers = new DocumentHandlers(
        new DocumentRepository(dbPool), new UserRepository(dbPool), vertx, billingService);
    Handler<RoutingContext> docAuth = SessionAuthHandler.authenticated(authService);
    router.post("/documents/upload").handler(docAuth).handler(docHandlers.upload());
    router.get("/documents/:id").handler(docAuth).handler(docHandlers.download());

    HeatmapHandlers heatmapHandlers = new HeatmapHandlers(heatmapService);
    Handler<RoutingContext> heatmapAuth = SessionAuthHandler.authenticated(authService);
    router.get("/heatmap/transactions").handler(heatmapAuth).handler(heatmapHandlers.transactions());
    router.get("/heatmap/activity").handler(heatmapAuth).handler(heatmapHandlers.activity());
    
    // Institution profile
    InstitutionHandlers institutionHandlers = new InstitutionHandlers(new InstitutionRepository(dbPool), new UserRepository(dbPool));
    Handler<RoutingContext> institutionAuth = SessionAuthHandler.authenticated(authService);
    router.get("/institution/profile").handler(institutionAuth).handler(institutionHandlers.getProfile());
    router.patch("/institution/profile").handler(institutionAuth).handler(institutionHandlers.updateProfile());
    router.get("/institution/signing-credentials").handler(institutionAuth).handler(institutionHandlers.getSigningCredentials());
    router.patch("/institution/signing-credentials").handler(institutionAuth).handler(institutionHandlers.updateSigningCredentials());

    // Customers — list + profile lookup
    CustomerHandlers customerHandlers = new CustomerHandlers(customerService, new UserRepository(dbPool));
    Handler<RoutingContext> customerAuth = SessionAuthHandler.authenticated(authService);
    router.get("/customers").handler(customerAuth).handler(customerHandlers.listCustomers());
    router.get("/customers/:id").handler(customerAuth).handler(customerHandlers.getCustomer());
    router.patch("/customers/:id/profile").handler(customerAuth).handler(customerHandlers.updateProfile());
    router.patch("/customers/:id/watchlist").handler(customerAuth).handler(customerHandlers.watchlistCustomer());
    router.patch("/customers/:id/unwatchlist").handler(customerAuth).handler(customerHandlers.unwatchlistCustomer());

    // User-specific detailed analytics
    UserAnalyticsService userAnalyticsService = new UserAnalyticsService(
        new BeamRepository(dbPool),
        new TransactionRepository(dbPool),
        new UserRepository(dbPool)
    );
    UserAnalyticsHandlers userAnalyticsHandlers = new UserAnalyticsHandlers(userAnalyticsService);
    Handler<RoutingContext> userAnalyticsAuth = SessionAuthHandler.authenticated(authService);
    router.get("/analytics/users/:userId/heatmap").handler(userAnalyticsAuth).handler(userAnalyticsHandlers::getUserHeatmap);

    // Notifications
    var notificationService  = new com.openiv.backend.notifications.NotificationService(dbPool, vertx);
    var notificationHandlers = new com.openiv.backend.notifications.NotificationHandlers(
        notificationService, new com.openiv.backend.auth.repository.UserRepository(dbPool));
    Handler<RoutingContext> notifAuth = SessionAuthHandler.authenticated(authService);
    router.get("/notifications").handler(notifAuth).handler(notificationHandlers.list());
    router.get("/notifications/unread-counts").handler(notifAuth).handler(notificationHandlers.unreadCounts());
    router.patch("/notifications/read-all").handler(notifAuth).handler(notificationHandlers.markAllRead());
    router.patch("/notifications/read-category/:category").handler(notifAuth).handler(notificationHandlers.markCategoryRead());
    router.patch("/notifications/:id/read").handler(notifAuth).handler(notificationHandlers.markRead());

    // Dashboard — SSE streams, REST snapshots, export, NFIU return
    DashboardHandlers dashboardHandlers = new DashboardHandlers(dashboardService, geoFenceService, vertx,
        billingService, notificationService);
    Handler<RoutingContext> dashAuth = SessionAuthHandler.authenticated(authService);
    router.get("/dashboard/events").handler(dashAuth).handler(dashboardHandlers.unifiedStream());
    router.get("/dashboard/stream").handler(dashAuth).handler(dashboardHandlers.stream());
    router.get("/dashboard/activity-stream").handler(dashAuth).handler(dashboardHandlers.activityStream());
    router.get("/dashboard/otp-alerts-stream").handler(dashAuth).handler(dashboardHandlers.otpAlertsStream());
    router.get("/dashboard/stats").handler(dashAuth).handler(dashboardHandlers.stats());
    router.get("/dashboard/flow").handler(dashAuth).handler(dashboardHandlers.flow());
    router.get("/dashboard/risk-map").handler(dashAuth).handler(dashboardHandlers.riskMap());
    router.get("/dashboard/export").handler(dashAuth).handler(dashboardHandlers.export());
    router.post("/dashboard/nfiu-return").handler(dashAuth).handler(dashboardHandlers.nfiuReturn());
    router.patch("/otp-alerts/:id/status").handler(dashAuth).handler(dashboardHandlers.updateOtpAlertStatus());

    // Geo-fence — config (super-admin) + user assignment + request review
    GeoFenceHandlers geoHandlers = new GeoFenceHandlers(geoFenceService, authService,
        new com.openiv.backend.auth.repository.UserRepository(dbPool), vertx);
    Handler<RoutingContext> geoAuth = SessionAuthHandler.authenticated(authService);
    router.get("/settings/geo-fence").handler(geoAuth).handler(geoHandlers.getConfig());
    router.put("/settings/geo-fence").handler(geoAuth).handler(geoHandlers.saveConfig());
    router.get("/settings/geo-fence/users").handler(geoAuth).handler(geoHandlers.listFencedUsers());
    router.post("/settings/geo-fence/users").handler(geoAuth).handler(geoHandlers.addFencedUser());
    router.delete("/settings/geo-fence/users/:userId").handler(geoAuth).handler(geoHandlers.removeFencedUser());
    router.get("/geo-access/requests").handler(geoAuth).handler(geoHandlers.listPendingRequests());
    router.patch("/geo-access/requests/:id").handler(geoAuth).handler(geoHandlers.reviewRequest());
    // Watch stream — no session auth; guarded by watchToken query param
    router.get("/geo-access/requests/:id/watch").handler(geoHandlers.watchRequest());

    // Eureka companion setting — per-user toggle, persisted in DB
    EurekaSettingHandlers eurekaHandlers = new EurekaSettingHandlers(new UserRepository(dbPool));
    Handler<RoutingContext> eurekaAuth = SessionAuthHandler.authenticated(authService);
    router.get("/settings/eureka").handler(eurekaAuth).handler(eurekaHandlers.getSetting());
    router.put("/settings/eureka").handler(eurekaAuth).handler(eurekaHandlers.updateSetting());

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
