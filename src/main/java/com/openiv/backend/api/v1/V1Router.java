package com.openiv.backend.api.v1;

import com.openiv.backend.auth.handler.AccessRequestHandlers;
import com.openiv.backend.auth.handler.SuperAdminAuthHandler;
import com.openiv.backend.auth.repository.AccessRequestRepository;
import com.openiv.backend.auth.repository.InstitutionRepository;
import com.openiv.backend.auth.repository.InvitationRepository;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.superadmin.SuperAdminHandlers;
import com.openiv.backend.superadmin.SuperAdminService;
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
import com.openiv.backend.security.Permission;
import com.openiv.backend.security.RequireAuth;
import com.openiv.backend.security.RoleAuthHandler;
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
import com.openiv.backend.kyc.KycPipelineResultRepository;
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
import com.openiv.backend.customers.CustomerTransactionRuleHandlers;
import com.openiv.backend.customers.CustomerTransactionRuleRepository;
import com.openiv.backend.customers.CustomerTransactionRuleService;
import com.openiv.backend.institution.InstitutionHandlers;
import com.openiv.backend.cloudinary.CloudinaryService;
import com.openiv.backend.config.AppConfig;
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
      CustomerService customerService, AppConfig.CloudinaryConfig cloudinaryConfig) {
    Router router = Router.router(vertx);

    // Shared user repo used by session auth and role checks throughout this router.
    UserRepository sharedUsers = new UserRepository(dbPool);

    // Public, unauthenticated routes go here (if any).
    router.get("/").handler(V1Router::index);
    router.post("/access-requests")
        .handler(new AccessRequestHandlers(accessRequestService).submit());

    // Waitlist — public join, authenticated list
    com.openiv.backend.waitlist.WaitlistHandlers waitlistHandlers =
        new com.openiv.backend.waitlist.WaitlistHandlers(
            new com.openiv.backend.waitlist.WaitlistService(
                new com.openiv.backend.waitlist.WaitlistRepository(dbPool)));
    router.post("/waitlist").handler(waitlistHandlers.join());
    router.get("/waitlist")
        .handler(SessionAuthHandler.authenticated(authService))
        .handler(waitlistHandlers.list());

    // Auth endpoints mount their own per-route session handlers.
    // Cookie flags: dev → not-Secure + SameSite=Lax (so :5173 can reach :8080 over
    // HTTP);
    // prod → Secure + SameSite=Strict.
    // Cloudinary — shared across all upload handlers
    CloudinaryService cloudinary = new CloudinaryService(
        vertx,
        cloudinaryConfig.cloudName(),
        cloudinaryConfig.apiKey(),
        cloudinaryConfig.apiSecret());
    DocumentRepository documentRepository = new DocumentRepository(dbPool);

    router.route("/auth/*").subRouter(AuthRouter.create(vertx, authService, !devMode,
        customerService, cloudinary, documentRepository));

    // Team management — session + role-based gates inside TeamRouter.
    router.route("/team/*").subRouter(TeamRouter.create(vertx, authService, teamService, dbPool, sharedUsers));

    // Billing — instantiated first; referenced by Transactions, Cases, Beam, KYC,
    // Dashboard
    String paystackSecret = System.getenv().getOrDefault("PAYSTACK_SECRET_KEY", "sk_test_placeholder");
    String paystackPublic = System.getenv().getOrDefault("PAYSTACK_PUBLIC_KEY", "pk_test_placeholder");
    String billingEncKey = System.getenv("BILLING_ENCRYPTION_KEY"); // null → dev fallback inside service
    BillingService billingService = new BillingService(
        new BillingRepository(dbPool), new UserRepository(dbPool),
        vertx, paystackSecret, billingEncKey);
    BillingHandlers billingHandlers = new BillingHandlers(billingService, paystackPublic);
    Handler<RoutingContext> billingAuth    = SessionAuthHandler.authenticated(authService);
    Handler<RoutingContext> billingView    = RoleAuthHandler.require(sharedUsers, Permission.BILLING_VIEW);
    Handler<RoutingContext> billingManage  = RoleAuthHandler.require(sharedUsers, Permission.BILLING_MANAGE);
    router.get("/billing/config").handler(billingHandlers.getConfig());
    router.get("/billing/summary").handler(billingAuth).handler(billingView).handler(billingHandlers.getSummary());
    router.get("/billing/usage").handler(billingAuth).handler(billingView).handler(billingHandlers.getUsage());
    router.get("/billing/ledger").handler(billingAuth).handler(billingView).handler(billingHandlers.getLedger());
    router.get("/billing/payment-methods").handler(billingAuth).handler(billingView).handler(billingHandlers.listPaymentMethods());
    router.delete("/billing/payment-methods/:id").handler(billingAuth).handler(billingManage).handler(billingHandlers.deletePaymentMethod());
    router.post("/billing/payment/initialize").handler(billingAuth).handler(billingManage).handler(billingHandlers.initializePayment());
    router.post("/billing/payment/verify").handler(billingAuth).handler(billingManage).handler(billingHandlers.verifyPayment());
    router.post("/billing/topup").handler(billingAuth).handler(billingManage).handler(billingHandlers.topup());
    router.post("/billing/card/charge").handler(billingAuth).handler(billingManage).handler(billingHandlers.chargeCard());
    router.post("/billing/card/challenge").handler(billingAuth).handler(billingManage).handler(billingHandlers.submitChallenge());

    // NFIU compliance — reports and scheduled filings
    NfiuService nfiuService = new NfiuService(
        new NfiuRepository(dbPool), new UserRepository(dbPool), billingService);
    NfiuHandlers nfiuHandlers = new NfiuHandlers(nfiuService);
    Handler<RoutingContext> nfiuAuth     = SessionAuthHandler.authenticated(authService);
    Handler<RoutingContext> nfiuView     = RoleAuthHandler.require(sharedUsers, Permission.REPORTS_VIEW);
    Handler<RoutingContext> nfiuCreate   = RoleAuthHandler.require(sharedUsers, Permission.REPORTS_CREATE);
    Handler<RoutingContext> nfiuFile     = RoleAuthHandler.require(sharedUsers, Permission.REPORTS_FILE);
    Handler<RoutingContext> nfiuApprove  = RoleAuthHandler.require(sharedUsers, Permission.REPORTS_APPROVE);
    router.get("/nfiu/metrics").handler(nfiuAuth).handler(nfiuView).handler(nfiuHandlers.getMetrics());
    router.get("/nfiu/reports").handler(nfiuAuth).handler(nfiuView).handler(nfiuHandlers.listReports());
    router.post("/nfiu/reports").handler(nfiuAuth).handler(nfiuCreate).handler(nfiuHandlers.createReport());
    router.post("/nfiu/reports/:id/file").handler(nfiuAuth).handler(nfiuFile).handler(nfiuHandlers.fileReport());
    router.post("/nfiu/reports/:id/approve").handler(nfiuAuth).handler(nfiuApprove).handler(nfiuHandlers.approveReport());
    router.get("/nfiu/reports/:id").handler(nfiuAuth).handler(nfiuView).handler(nfiuHandlers.getReport());
    router.patch("/nfiu/reports/:id").handler(nfiuAuth).handler(nfiuCreate).handler(nfiuHandlers.updateReport());
    router.delete("/nfiu/reports/:id").handler(nfiuAuth).handler(nfiuFile).handler(nfiuHandlers.deleteReport());
    router.get("/nfiu/schedules").handler(nfiuAuth).handler(nfiuView).handler(nfiuHandlers.listSchedules());
    router.post("/nfiu/schedules").handler(nfiuAuth).handler(nfiuFile).handler(nfiuHandlers.createSchedule());
    router.patch("/nfiu/schedules/:id").handler(nfiuAuth).handler(nfiuFile).handler(nfiuHandlers.updateSchedule());
    router.delete("/nfiu/schedules/:id").handler(nfiuAuth).handler(nfiuFile).handler(nfiuHandlers.deleteSchedule());

    // Transactions — two endpoints registered directly to avoid sub-router
    // path-stripping on root.
    TransactionHandlers txnHandlers = new TransactionHandlers(transactionService, billingService);
    Handler<RoutingContext> txnAuth   = SessionAuthHandler.authenticated(authService);
    Handler<RoutingContext> txnView   = RoleAuthHandler.require(sharedUsers, Permission.TRANSACTIONS_VIEW);
    Handler<RoutingContext> txnFlag   = RoleAuthHandler.require(sharedUsers, Permission.TRANSACTIONS_FLAG);
    Handler<RoutingContext> txnImport = RoleAuthHandler.require(sharedUsers, Permission.TRANSACTIONS_IMPORT);
    router.get("/transactions").handler(txnAuth).handler(txnView).handler(txnHandlers.list());
    router.get("/transactions/export").handler(txnAuth).handler(txnView).handler(txnHandlers.export());
    router.get("/transactions/unseen-count").handler(txnAuth).handler(txnView).handler(txnHandlers.unseenCount());
    router.post("/transactions/bulk-status").handler(txnAuth).handler(txnFlag).handler(txnHandlers.bulkStatus());
    router.post("/transactions/import").handler(txnAuth).handler(txnImport).handler(txnHandlers.importTransactions());
    router.patch("/transactions/:id/seen").handler(txnAuth).handler(txnView).handler(txnHandlers.markSeen());
    router.get("/transactions/:id").handler(txnAuth).handler(txnView).handler(txnHandlers.getById());

    // Cases — metrics must be registered before /:id to avoid path collision
    CaseHandlers caseHandlers = new CaseHandlers(caseService, billingService);
    Handler<RoutingContext> caseAuth     = SessionAuthHandler.authenticated(authService);
    Handler<RoutingContext> casesView    = RoleAuthHandler.require(sharedUsers, Permission.CASES_VIEW);
    Handler<RoutingContext> casesCreate  = RoleAuthHandler.require(sharedUsers, Permission.CASES_CREATE);
    Handler<RoutingContext> casesAssign  = RoleAuthHandler.require(sharedUsers, Permission.CASES_ASSIGN);
    Handler<RoutingContext> casesClose   = RoleAuthHandler.require(sharedUsers, Permission.CASES_CLOSE);
    Handler<RoutingContext> casesNote    = RoleAuthHandler.require(sharedUsers, Permission.CASES_NOTE);
    Handler<RoutingContext> casesEvidence = RoleAuthHandler.require(sharedUsers, Permission.CASES_EVIDENCE);
    router.get("/transactions/:id/case").handler(txnAuth).handler(casesView).handler(caseHandlers.forTransaction());
    router.get("/cases/metrics").handler(caseAuth).handler(casesView).handler(caseHandlers.metrics());
    router.get("/cases/pending-approval").handler(caseAuth).handler(casesView).handler(caseHandlers.listPendingApproval());
    router.get("/cases/unassigned-count").handler(caseAuth).handler(casesView).handler(caseHandlers.unassignedCount());
    router.get("/cases/unseen-count").handler(caseAuth).handler(casesView).handler(caseHandlers.unseenCount());
    router.get("/cases").handler(caseAuth).handler(casesView).handler(caseHandlers.list());
    router.post("/cases").handler(caseAuth).handler(casesCreate).handler(caseHandlers.create());
    router.get("/cases/:id").handler(caseAuth).handler(casesView).handler(caseHandlers.detail());
    router.patch("/cases/:id/status").handler(caseAuth).handler(casesClose).handler(caseHandlers.updateStatus());
    router.post("/cases/:id/transactions").handler(caseAuth).handler(casesCreate).handler(caseHandlers.linkTransaction());
    router.post("/cases/:id/notes").handler(caseAuth).handler(casesNote).handler(caseHandlers.addNote());
    router.post("/cases/:id/evidence").handler(caseAuth).handler(casesEvidence).handler(caseHandlers.addEvidence());
    router.post("/cases/:id/assign").handler(caseAuth).handler(casesAssign).handler(caseHandlers.assignCase());
    router.patch("/cases/:id/seen").handler(caseAuth).handler(casesView).handler(caseHandlers.markSeen());
    router.patch("/cases/:id/link-nfiu-report").handler(caseAuth).handler(casesClose).handler(caseHandlers.linkNfiuReport());

    // Thresholds — metrics before /:id to avoid path collision
    ThresholdHandlers thresholdHandlers = new ThresholdHandlers(thresholdService);
    Handler<RoutingContext> thresholdAuth   = SessionAuthHandler.authenticated(authService);
    Handler<RoutingContext> rulesView       = RoleAuthHandler.require(sharedUsers, Permission.RULES_VIEW);
    Handler<RoutingContext> rulesModify     = RoleAuthHandler.require(sharedUsers, Permission.RULES_MODIFY);
    router.get("/thresholds/metrics").handler(thresholdAuth).handler(rulesView).handler(thresholdHandlers.metrics());
    router.get("/thresholds/kyc-status").handler(thresholdAuth).handler(rulesView).handler(thresholdHandlers.kycStatus());
    router.post("/thresholds/kyc-suppress").handler(thresholdAuth).handler(rulesModify).handler(thresholdHandlers.suppressKyc());
    router.get("/thresholds/kyc-tiers").handler(thresholdAuth).handler(rulesView).handler(thresholdHandlers.listKycTiers());
    router.patch("/thresholds/kyc-tiers/:tier").handler(thresholdAuth).handler(rulesModify).handler(thresholdHandlers.updateKycTier());
    router.get("/thresholds").handler(thresholdAuth).handler(rulesView).handler(thresholdHandlers.list());
    router.get("/thresholds/history").handler(thresholdAuth).handler(rulesView).handler(thresholdHandlers.allHistory());
    router.patch("/thresholds/:id").handler(thresholdAuth).handler(rulesModify).handler(thresholdHandlers.update());
    router.get("/thresholds/:id/history").handler(thresholdAuth).handler(rulesView).handler(thresholdHandlers.history());

    // Behavioral rules
    BehavioralRuleService behavioralRuleService = new BehavioralRuleService(
        new BehavioralRuleRepository(dbPool), new UserRepository(dbPool));
    BehavioralRuleHandlers behavioralRuleHandlers = new BehavioralRuleHandlers(behavioralRuleService);
    Handler<RoutingContext> behavioralAuth = SessionAuthHandler.authenticated(authService);
    router.get("/behavioral-rules").handler(behavioralAuth).handler(rulesView).handler(behavioralRuleHandlers.list());
    router.patch("/behavioral-rules/:id").handler(behavioralAuth).handler(rulesModify).handler(behavioralRuleHandlers.update());

    // Beam API key auth for ingest endpoints
    BeamHandlers beamHandlers = new BeamHandlers(beamService, billingService);
    BeamApiKeyHandler beamApiKeyHandler = new BeamApiKeyHandler(beamService, authService);
    Handler<RoutingContext> beamSessionAuth = SessionAuthHandler.authenticated(authService);

    Handler<RoutingContext> integrationsView   = RoleAuthHandler.require(sharedUsers, Permission.INTEGRATIONS_VIEW);
    Handler<RoutingContext> integrationsModify = RoleAuthHandler.require(sharedUsers, Permission.INTEGRATIONS_MODIFY);

    // Beam management — session authenticated (must be before /:stream to avoid
    // param capture)
    router.get("/beam/records").handler(beamSessionAuth).handler(integrationsView).handler(beamHandlers.listRecords());
    router.get("/beam/api-key").handler(beamSessionAuth).handler(integrationsView).handler(beamHandlers.getApiKeyInfo());
    router.post("/beam/api-key").handler(beamSessionAuth).handler(integrationsModify).handler(beamHandlers.generateApiKey());
    router.delete("/beam/api-key").handler(beamSessionAuth).handler(integrationsModify).handler(beamHandlers.revokeApiKey());

    // KYC SSE streaming endpoint — must be registered before /:stream to avoid param capture
    router.post("/beam/kyc/stream").handler(beamApiKeyHandler.resolve()).handler(beamHandlers.ingestKycStream());

    // Inbound beam ingestion — authenticated with institution API key (not session)
    router.post("/beam/:stream").handler(beamApiKeyHandler.resolve()).handler(beamHandlers.ingest());

    // Webhooks — fixed paths before /:id to avoid collision
    WebhookHandlers webhookHandlers = new WebhookHandlers(webhookService, authService);
    Handler<RoutingContext> webhookAuth = SessionAuthHandler.authenticated(authService);
    router.get("/webhooks/secret").handler(webhookAuth).handler(integrationsView).handler(webhookHandlers.getSecret());
    router.post("/webhooks/secret/rotate").handler(webhookAuth).handler(integrationsModify).handler(webhookHandlers.rotateSecret());
    router.patch("/webhooks/secret").handler(webhookAuth).handler(integrationsModify).handler(webhookHandlers.updateSecret());
    router.get("/webhooks/deliveries").handler(webhookAuth).handler(integrationsView).handler(webhookHandlers.listAllDeliveries());
    router.get("/webhooks").handler(webhookAuth).handler(integrationsView).handler(webhookHandlers.listEndpoints());
    router.post("/webhooks/verify").handler(webhookAuth).handler(integrationsModify).handler(webhookHandlers.verifyEndpoint());
    router.post("/webhooks").handler(webhookAuth).handler(integrationsModify).handler(webhookHandlers.createEndpoint());
    router.patch("/webhooks/:id").handler(webhookAuth).handler(integrationsModify).handler(webhookHandlers.updateEndpoint());
    router.delete("/webhooks/:id").handler(webhookAuth).handler(integrationsModify).handler(webhookHandlers.deleteEndpoint());
    router.post("/webhooks/:id/test").handler(webhookAuth).handler(integrationsModify).handler(webhookHandlers.testEndpoint());
    router.get("/webhooks/:id/deliveries").handler(webhookAuth).handler(integrationsView).handler(webhookHandlers.listDeliveries());
    router.get("/webhooks/:id/security").handler(webhookAuth).handler(integrationsView).handler(webhookHandlers.getSecurityRule());
    router.put("/webhooks/:id/security").handler(webhookAuth).handler(integrationsModify).handler(webhookHandlers.upsertSecurityRule());
    router.post("/webhooks/:id/security/api-key").handler(webhookAuth).handler(integrationsModify).handler(webhookHandlers.generateApiKey());

    // Network logs — unified beam + webhook traffic view
    NetworkHandlers networkHandlers = new NetworkHandlers(
        new NetworkService(new NetworkRepository(dbPool), new UserRepository(dbPool)));
    Handler<RoutingContext> networkAuth = SessionAuthHandler.authenticated(authService);
    router.get("/network/logs").handler(networkAuth).handler(integrationsView).handler(networkHandlers.listLogs());

    // KYC — lookup URL config, manual lookup, pipeline results
    KycPipelineResultRepository kycPipelineRepo = new KycPipelineResultRepository(dbPool);
    com.openiv.backend.kyc.KycEvaluationConfigRepository evalConfigRepo =
        new com.openiv.backend.kyc.KycEvaluationConfigRepository(dbPool);
    KycHandlers kycHandlers = new KycHandlers(kycService, billingService, evalConfigRepo);
    Handler<RoutingContext> kycAuth    = SessionAuthHandler.authenticated(authService);
    Handler<RoutingContext> kycView    = RoleAuthHandler.require(sharedUsers, Permission.KYC_VIEW);
    Handler<RoutingContext> kycConfig  = RoleAuthHandler.require(sharedUsers, Permission.KYC_CONFIG);
    router.get("/kyc/config").handler(kycAuth).handler(kycView).handler(kycHandlers.getConfig());
    router.put("/kyc/config").handler(kycAuth).handler(kycConfig).handler(kycHandlers.saveConfig());
    router.get("/kyc/pep-search").handler(kycAuth).handler(kycView).handler(kycHandlers.searchPEP());
    router.post("/kyc/lookup").handler(kycAuth).handler(kycView).handler(kycHandlers.lookup());
    router.get("/kyc/customers/stats").handler(kycAuth).handler(kycView).handler(kycHandlers.getStats());
    router.get("/kyc/customers").handler(kycAuth).handler(kycView).handler(kycHandlers.listCustomers());
    router.get("/kyc/customers/:customerId").handler(kycAuth).handler(kycView).handler(kycHandlers.getCustomerKyc());
    router.get("/kyc/logs").handler(kycAuth).handler(kycView).handler(kycHandlers.listLogs());
    // Evaluation scheduling config
    router.get("/kyc/evaluation-config").handler(kycAuth).handler(kycView).handler(kycHandlers.getEvaluationConfig());
    router.put("/kyc/evaluation-config").handler(kycAuth).handler(kycConfig).handler(kycHandlers.saveEvaluationConfig());
    // Customer KYC fetch — beam-API-key-protected endpoint for institutions
    router.get("/kyc/customer-fetch/:customerId").handler(beamApiKeyHandler.resolve()).handler(kycHandlers.customerKycFetch());

    // AML Settings — institution-level configuration for auto case opening
    AmlHandlers amlHandlers = new AmlHandlers(caseService);
    Handler<RoutingContext> amlAuth     = SessionAuthHandler.authenticated(authService);
    Handler<RoutingContext> amlSettings = RoleAuthHandler.require(sharedUsers, Permission.AML_SETTINGS);
    router.get("/aml-settings").handler(amlAuth).handler(amlSettings).handler(amlHandlers.getSettings());
    router.put("/aml-settings").handler(amlAuth).handler(amlSettings).handler(amlHandlers.updateSettings());
    router.patch("/aml-settings/beam-window").handler(amlAuth).handler(amlSettings).handler(amlHandlers.updateBeamWindow());
    router.patch("/aml-settings/timezone").handler(amlAuth).handler(amlSettings).handler(amlHandlers.updateTimezone());
    router.patch("/aml-settings/daily-txn-limit").handler(amlAuth).handler(amlSettings).handler(amlHandlers.updateDailyTxnLimit());
    router.patch("/aml-settings/expected-daily-txn-count").handler(amlAuth).handler(amlSettings).handler(amlHandlers.updateExpectedDailyTxnCount());
    router.post("/aml-settings/notifications/email").handler(amlAuth).handler(amlSettings).handler(amlHandlers.addNotificationEmail());
    router.delete("/aml-settings/notifications/email").handler(amlAuth).handler(amlSettings).handler(amlHandlers.removeNotificationEmail());

    // Institution-wide alerts (surge detection, coordinated fraud)
    com.openiv.backend.alerts.InstitutionAlertRepository alertRepo =
        new com.openiv.backend.alerts.InstitutionAlertRepository(dbPool);
    com.openiv.backend.alerts.InstitutionAlertHandlers alertHandlers =
        new com.openiv.backend.alerts.InstitutionAlertHandlers(alertRepo, new UserRepository(dbPool));
    Handler<RoutingContext> alertAuth = SessionAuthHandler.authenticated(authService);
    router.get("/institution-alerts").handler(alertAuth).handler(alertHandlers.list());
    router.patch("/institution-alerts/:id/status").handler(alertAuth).handler(alertHandlers.updateStatus());
    router.get("/institution-alerts/:id/investigate").handler(alertAuth).handler(alertHandlers.investigate());

    // Documents — compliance evidence files (upload + download)
    DocumentHandlers docHandlers = new DocumentHandlers(
        documentRepository, new UserRepository(dbPool), vertx, billingService, cloudinary);
    Handler<RoutingContext> docAuth = SessionAuthHandler.authenticated(authService);
    router.post("/documents/upload").handler(docAuth).handler(docHandlers.upload());
    router.get("/documents/:id").handler(docAuth).handler(docHandlers.download());

    HeatmapHandlers heatmapHandlers = new HeatmapHandlers(heatmapService);
    Handler<RoutingContext> heatmapAuth = SessionAuthHandler.authenticated(authService);
    router.get("/heatmap/transactions").handler(heatmapAuth).handler(heatmapHandlers.transactions());
    router.get("/heatmap/activity").handler(heatmapAuth).handler(heatmapHandlers.activity());
    
    // Institution profile
    InstitutionHandlers institutionHandlers = new InstitutionHandlers(
        new InstitutionRepository(dbPool), new UserRepository(dbPool), cloudinary, documentRepository);
    Handler<RoutingContext> institutionAuth   = SessionAuthHandler.authenticated(authService);
    Handler<RoutingContext> institutionView   = RoleAuthHandler.require(sharedUsers, Permission.INSTITUTION_VIEW);
    Handler<RoutingContext> institutionModify = RoleAuthHandler.require(sharedUsers, Permission.INSTITUTION_MODIFY);
    router.get("/institution/profile").handler(institutionAuth).handler(institutionView).handler(institutionHandlers.getProfile());
    router.patch("/institution/profile").handler(institutionAuth).handler(institutionModify).handler(institutionHandlers.updateProfile());
    router.get("/institution/signing-credentials").handler(institutionAuth).handler(institutionView).handler(institutionHandlers.getSigningCredentials());
    router.patch("/institution/signing-credentials").handler(institutionAuth).handler(institutionModify).handler(institutionHandlers.updateSigningCredentials());

    // Customers — static paths before /:id to avoid param capture
    CustomerHandlers customerHandlers = new CustomerHandlers(
        customerService, new UserRepository(dbPool), cloudinary, documentRepository);
    Handler<RoutingContext> customerAuth  = SessionAuthHandler.authenticated(authService);
    Handler<RoutingContext> customersView = RoleAuthHandler.require(sharedUsers, Permission.CUSTOMERS_VIEW);
    Handler<RoutingContext> customersEdit = RoleAuthHandler.require(sharedUsers, Permission.CUSTOMERS_EDIT);
    router.get("/customers").handler(customerAuth).handler(customersView).handler(customerHandlers.listCustomers());
    router.get("/customers/high-risk").handler(customerAuth).handler(customersView).handler(customerHandlers.highRisk());
    router.get("/customers/:id").handler(customerAuth).handler(customersView).handler(customerHandlers.getCustomer());
    router.patch("/customers/:id/profile").handler(customerAuth).handler(customersEdit).handler(customerHandlers.updateProfile());
    router.patch("/customers/:id/watchlist").handler(customerAuth).handler(customersEdit).handler(customerHandlers.watchlistCustomer());
    router.patch("/customers/:id/unwatchlist").handler(customerAuth).handler(customersEdit).handler(customerHandlers.unwatchlistCustomer());

    // Per-customer transaction rules
    CustomerTransactionRuleHandlers ruleHandlers = new CustomerTransactionRuleHandlers(
        new CustomerTransactionRuleService(new CustomerTransactionRuleRepository(dbPool)),
        new UserRepository(dbPool));
    router.get("/customers/:id/rules").handler(customerAuth).handler(rulesView).handler(ruleHandlers.listRules());
    router.post("/customers/:id/rules").handler(customerAuth).handler(rulesModify).handler(ruleHandlers.createRule());
    router.put("/customers/:id/rules/:ruleId").handler(customerAuth).handler(rulesModify).handler(ruleHandlers.updateRule());
    router.delete("/customers/:id/rules/:ruleId").handler(customerAuth).handler(rulesModify).handler(ruleHandlers.deleteRule());
    router.patch("/customers/:id/rules/:ruleId/toggle").handler(customerAuth).handler(rulesModify).handler(ruleHandlers.toggleRule());

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

    // Super-admin — double-gated: valid session + email must be the platform owner
    String frontendUrl = System.getenv().getOrDefault("FRONTEND_URL", "http://localhost:5173");
    SuperAdminService superAdminService = new SuperAdminService(
        new AccessRequestRepository(dbPool),
        new InstitutionRepository(dbPool),
        new InvitationRepository(dbPool),
        new UserRepository(dbPool),
        authService.emailSender(),
        frontendUrl);
    SuperAdminHandlers superAdminHandlers = new SuperAdminHandlers(superAdminService);
    Handler<RoutingContext> saSession = SuperAdminAuthHandler.session(authService);
    Handler<RoutingContext> saEmail   = SuperAdminAuthHandler.emailGate(new UserRepository(dbPool));
    router.get("/superadmin/access-requests").handler(saSession).handler(saEmail).handler(superAdminHandlers.listRequests());
    router.get("/superadmin/access-requests/:id").handler(saSession).handler(saEmail).handler(superAdminHandlers.getRequest());
    router.post("/superadmin/access-requests/:id/approve").handler(saSession).handler(saEmail).handler(superAdminHandlers.approveRequest());
    router.post("/superadmin/access-requests/:id/reject").handler(saSession).handler(saEmail).handler(superAdminHandlers.rejectRequest());
    router.get("/superadmin/institutions").handler(saSession).handler(saEmail).handler(superAdminHandlers.listInstitutions());
    router.get("/superadmin/institutions/:id").handler(saSession).handler(saEmail).handler(superAdminHandlers.getInstitution());
    router.patch("/superadmin/institutions/:id/status").handler(saSession).handler(saEmail).handler(superAdminHandlers.updateInstitutionStatus());

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
