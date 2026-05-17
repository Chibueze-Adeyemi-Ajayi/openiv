package com.openiv.backend.kyc;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.cases.CaseService;
import com.openiv.backend.customers.CustomerService;
import com.openiv.backend.doja.DojaClient;
import com.openiv.backend.doja.DojaVerificationPipeline;
import com.openiv.backend.doja.PipelineStepResult;
import com.openiv.backend.doja.PipelineVerificationResult;
import com.openiv.backend.notifications.NotificationService;
import io.vertx.core.Future;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.client.WebClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

public final class KycService {

  private static final Logger log = LoggerFactory.getLogger(KycService.class);

  private final KycRepository repository;
  private final UserRepository users;
  private final WebClient client;
  private final CaseService cases;
  private final NotificationService notifications;
  private final CustomerService customerService;
  final DojaClient dojaClient;
  private final KycPipelineResultRepository pipelineResults;

  public KycService(KycRepository repository, UserRepository users, WebClient client,
      CaseService cases, NotificationService notifications, CustomerService customerService) {
    this(repository, users, client, cases, notifications, customerService, null, null);
  }

  public KycService(KycRepository repository, UserRepository users, WebClient client,
      CaseService cases, NotificationService notifications, CustomerService customerService,
      DojaClient dojaClient) {
    this(repository, users, client, cases, notifications, customerService, dojaClient, null);
  }

  public KycService(KycRepository repository, UserRepository users, WebClient client,
      CaseService cases, NotificationService notifications, CustomerService customerService,
      DojaClient dojaClient, KycPipelineResultRepository pipelineResults) {
    this.repository = repository;
    this.users = users;
    this.client = client;
    this.cases = cases;
    this.notifications = notifications;
    this.customerService = customerService;
    this.dojaClient = dojaClient;
    this.pipelineResults = pipelineResults;
  }

  // ── Config ────────────────────────────────────────────────────────────────

  public Future<Optional<KycConfig>> getConfig(Session session) {
    return resolveUser(session).compose(u -> repository.findConfig(u.institutionId()));
  }

  public Future<Boolean> hasConfigForInstitution(long institutionId) {
    return repository.hasConfig(institutionId);
  }

  public Future<KycConfig> saveConfig(Session session,
      String lookupUrl, String lookupApiKey, Integer lookupTimeout) {
    if (lookupUrl != null && !lookupUrl.isBlank() && !lookupUrl.startsWith("https://"))
      return Future.failedFuture(new IllegalArgumentException("Lookup URL must start with https://"));
    return resolveUser(session).compose(u -> repository.saveConfig(u.institutionId(),
        lookupUrl, lookupApiKey, lookupTimeout));
  }

  // ── PEP Screening ───────────────────────────────────────────────────────────

  public Future<JsonArray> searchPEP(Session session, String query) {
    if (query == null || query.isBlank())
      return Future.failedFuture(new IllegalArgumentException("query is required"));

    if (dojaClient == null || !dojaClient.config().isConfigured())
      return Future.failedFuture(new IllegalStateException("AML screening service is not configured."));

    String uniqueRef = "pep-search-" + System.currentTimeMillis();

    return resolveUser(session).compose(u ->
        dojaClient.screenAml(query.trim(), null, uniqueRef)
            .compose(amlResult -> {
              if (amlResult.containsKey("error"))
                return Future.failedFuture("AML screening error: " + amlResult.getString("error"));

              JsonObject entity   = amlResult.getJsonObject("entity", new JsonObject());
              String  entityId    = entity.getString("entity_id", uniqueRef);
              String  riskLevel   = entity.getString("risk_level", "");
              int     totalResults = entity.getInteger("total_results", 0);

              JsonArray mapped = new JsonArray();
              if (totalResults == 0) return Future.succeededFuture(mapped);

              // results may be a single JsonObject or a JsonArray
              java.util.List<JsonObject> resultList = new java.util.ArrayList<>();
              Object raw = entity.getValue("results");
              if (raw instanceof JsonArray arr) {
                for (int i = 0; i < arr.size(); i++) resultList.add(arr.getJsonObject(i));
              } else if (raw instanceof JsonObject obj) {
                resultList.add(obj);
              }

              for (int i = 0; i < resultList.size(); i++) {
                JsonObject r = resultList.get(i);
                String srcType = r.getString("source_type", "");

                // Prefer structured name parts over the top-level "name" field
                String name = buildName(r, query);

                // Position — prefer positions array, fall back to pep_type
                String position = "";
                JsonArray positions = r.getJsonArray("positions");
                if (positions != null && !positions.isEmpty()) position = positions.getString(0);
                if (position.isBlank()) position = r.getString("pep_type", "PEP");

                // Organization — political affiliation or media_category
                String org = "";
                JsonArray polAff = r.getJsonArray("political_affiliation");
                if (polAff != null && !polAff.isEmpty()) org = polAff.getString(0);
                if (org.isBlank()) org = r.getString("media_category", "");
                if (org.isBlank()) org = "AML Screening Database";

                String country = r.getString("country", "Unknown");

                // Derive risk level: sanctions always High; PEP uses entity-level risk_level
                JsonArray sanctionDetails = r.getJsonArray("sanction_details");
                boolean hasSanction = "SANCTION".equalsIgnoreCase(srcType)
                    || (sanctionDetails != null && !sanctionDetails.isEmpty());
                String resolvedRisk;
                if (hasSanction || "High".equalsIgnoreCase(riskLevel))         resolvedRisk = "High";
                else if ("Medium".equalsIgnoreCase(riskLevel))                 resolvedRisk = "Medium";
                else                                                            resolvedRisk = "Medium";

                mapped.add(new JsonObject()
                    .put("id",          entityId + "-" + i)
                    .put("name",        name)
                    .put("position",    position.isBlank() ? "PEP"     : position)
                    .put("organization", org)
                    .put("country",     country.isBlank() ? "Unknown"  : country.toUpperCase())
                    .put("riskLevel",   resolvedRisk)
                    .put("lastUpdated", r.getString("date_of_birth", "On record")));
              }
              return Future.succeededFuture(mapped);
            }));
  }

  private static String buildName(JsonObject r, String fallback) {
    JsonArray given = r.getJsonArray("given_names");
    JsonArray last  = r.getJsonArray("last_names");
    if ((given != null && !given.isEmpty()) || (last != null && !last.isEmpty())) {
      StringBuilder sb = new StringBuilder();
      if (given != null && !given.isEmpty()) sb.append(given.getString(0));
      if (last  != null && !last.isEmpty()) {
        if (sb.length() > 0) sb.append(' ');
        sb.append(last.getString(0));
      }
      if (!sb.isEmpty()) return sb.toString();
    }
    String n = r.getString("name");
    return (n != null && !n.isBlank()) ? n : fallback;
  }

  // ── Lookup ────────────────────────────────────────────────────────────────

  public Future<JsonObject> lookup(Session session, String customerRef, String triggerSource, boolean openCase) {
    if (customerRef == null || customerRef.isBlank())
      return Future.failedFuture(new IllegalArgumentException("customerRef is required"));
    return resolveUser(session).compose(u -> repository.findConfig(u.institutionId()).compose(cfgOpt -> {
      if (cfgOpt.isEmpty() || cfgOpt.get().lookupUrl() == null)
        return Future.<JsonObject>failedFuture(new IllegalStateException("KYC lookup URL not configured"));
      KycConfig cfg = cfgOpt.get();
      String url = cfg.lookupUrl().endsWith("/")
          ? cfg.lookupUrl() + customerRef
          : cfg.lookupUrl() + "/" + customerRef;
      int timeoutMs = cfg.lookupTimeout() * 1_000;
      String src = triggerSource != null ? triggerSource : "manual";

      long start = System.currentTimeMillis();
      var req = client.getAbs(url).timeout(timeoutMs);
      if (cfg.lookupApiKey() != null && !cfg.lookupApiKey().isBlank()) {
        req = req.putHeader("Authorization", "Bearer " + cfg.lookupApiKey());
      }

      return req.send().compose(resp -> {
        int durationMs = (int) (System.currentTimeMillis() - start);
        int code = resp.statusCode();
        boolean success = code >= 200 && code < 300;
        String logStatus = success ? "success" : "failed";

        JsonObject body = null;
        Integer tier = null;
        String kycStatus = null;
        String errorMsg = null;

        if (success) {
          try {
            body = resp.bodyAsJsonObject();
            if (body != null) {
              tier = body.getInteger("tier");
              kycStatus = body.getString("status");
            }
          } catch (Exception e) {
            log.warn("KYC response not JSON for ref={}: {}", customerRef, e.getMessage());
            body = new JsonObject().put("raw", resp.bodyAsString());
          }
        } else {
          errorMsg = "HTTP " + code + ": " + resp.bodyAsString();
        }

        final JsonObject kycBody = body != null ? body : new JsonObject();
        final Integer finalTier = tier;
        final String finalKycStatus = kycStatus;
        final String finalError = errorMsg;
        final boolean lookupOk = success;

        return repository.saveLog(u.institutionId(), customerRef, src,
            logStatus, code, durationMs, finalTier, finalKycStatus, finalError)
            .compose(ignored -> {
              JsonObject base = new JsonObject()
                  .put("customerId", customerRef)
                  .put("kyc", kycBody);
              if (!openCase)
                return Future.succeededFuture(base);

              String casePriority = lookupOk ? "medium" : "high";
              int riskScore = finalTier != null ? Math.max(0, (4 - finalTier) * 25) : 50;
              String notes = kycNotes(customerRef, finalKycStatus, finalTier, finalError);
              return cases.create(session, "KYC Review: " + customerRef,
                  "kyc_review", casePriority, riskScore, null, notes, null,
                  "Automatically opened by KYC review", null, customerRef, null)
                  .map(cas -> base.put("case", new JsonObject()
                      .put("id", cas.id())
                      .put("title", cas.title())
                      .put("status", cas.status())
                      .put("priority", cas.priority())
                      .put("riskScore", cas.riskScore())
                      .put("slaDeadline", cas.slaDeadline().toString())
                      .put("createdAt", cas.createdAt().toString())));
            });
      }).recover(err -> {
        int elapsed = (int) (System.currentTimeMillis() - start);
        boolean isTimeout = err.getMessage() != null
            && err.getMessage().toLowerCase().contains("timeout");
        String failStatus = isTimeout ? "timeout" : "failed";
        return repository.saveLog(u.institutionId(), customerRef, src,
            failStatus, null, elapsed, null, null, err.getMessage())
            .compose(ignored -> Future.<JsonObject>failedFuture(err));
      });
    }));
  }

  // ── Doja Verification Pipeline ────────────────────────────────────────────

  /** Default step order matching the UI pipeline canvas. */
  public static final List<String> DEFAULT_PIPELINE = List.of("bvn_nin", "phone_match", "liveness", "pep_check");

  /**
   * Run the Doja verification pipeline for a customer beamed via the KYC stream.
   * Persists one consolidated log entry to kyc_lookup_log and returns the full
   * result.
   *
   * @param institutionId institution that owns this customer
   * @param customerId    customer reference / external ID
   * @param bvn           BVN from beam payload (nullable)
   * @param nin           NIN from beam payload (nullable)
   * @param phone         phone number from beam payload (nullable)
   * @param photo         base64 selfie from beam payload (nullable)
   */
  public Future<PipelineVerificationResult> runPipeline(
      long institutionId, String customerId,
      String bvn, String nin, String phone, String photo) {
    return runPipelineWithCallback(institutionId, customerId, bvn, nin, phone, photo, null, null);
  }

  public Future<PipelineVerificationResult> runPipeline(
      long institutionId, String customerId,
      String bvn, String nin, String phone, String photo, String beamedName) {
    return runPipelineWithCallback(institutionId, customerId, bvn, nin, phone, photo, null, beamedName);
  }

  public Future<PipelineVerificationResult> runPipelineWithCallback(
      long institutionId, String customerId,
      String bvn, String nin, String phone, String photo,
      Consumer<JsonObject> stepCallback) {
    return runPipelineWithCallback(institutionId, customerId, bvn, nin, phone, photo, stepCallback, null);
  }

  public Future<PipelineVerificationResult> runPipelineWithCallback(
      long institutionId, String customerId,
      String bvn, String nin, String phone, String photo,
      Consumer<JsonObject> stepCallback, String beamedName) {

    if (dojaClient == null) {
      log.warn("[Pipeline] DojaClient not configured — skipping verification for {}", customerId);
      PipelineVerificationResult skipped = new PipelineVerificationResult(
          customerId,
          List.of(new PipelineStepResult("pipeline", "unverified", "Doja not configured", 0, 50)),
          "partial", 1, 0, 50, null, null, null, null, null);
      return Future.succeededFuture(skipped);
    }

    DojaVerificationPipeline pipeline = new DojaVerificationPipeline(dojaClient);

    return pipeline.run(customerId, bvn, nin, phone, photo, DEFAULT_PIPELINE, stepCallback, beamedName)
        .compose(result -> {
          String logStatus = result.flagged() ? "failed" : "success";
          int durationMs = (int) Math.min(result.totalDurationMs(), Integer.MAX_VALUE);
          return repository.saveLog(
              institutionId, customerId, "beam_pipeline",
              logStatus, 200, durationMs,
              result.kycTier(), result.overallStatus(), null)
              .map(ignored -> result);
        });
  }

  public Future<KycPipelineResult> savePipelineResult(
      long institutionId, String customerId,
      PipelineVerificationResult result, String actionTaken) {
    if (pipelineResults == null)
      return Future.failedFuture("Pipeline results repository not configured");
    return pipelineResults.save(institutionId, customerId, result, actionTaken);
  }

  public Future<List<KycPipelineResult>> listCustomersWithKycScore(Session session) {
    return listCustomersWithKycScoreFiltered(session, null, null);
  }

  public Future<List<KycPipelineResult>> listCustomersWithKycScoreFiltered(
      Session session, String filter, String search) {
    if (pipelineResults == null)
      return Future.succeededFuture(List.of());
    return resolveUser(session)
        .compose(u -> pipelineResults.listLatestPerCustomerFiltered(u.institutionId(), filter, search));
  }

  public Future<List<JsonObject>> listCustomerSummaries(Session session, String filter, String search) {
    if (pipelineResults == null)
      return Future.succeededFuture(List.of());
    return resolveUser(session)
        .compose(u -> pipelineResults.listCustomerSummaries(u.institutionId(), filter, search));
  }

  public Future<JsonObject> getKycStats(Session session) {
    if (pipelineResults == null)
      return Future.succeededFuture(new JsonObject()
          .put("total", 0).put("highRisk", 0).put("lowRisk", 0).put("verified", 0).put("flagged", 0));
    return resolveUser(session)
        .compose(u -> pipelineResults.getStats(u.institutionId()));
  }

  public Future<Optional<KycPipelineResult>> getCustomerKyc(Session session, String customerId) {
    if (pipelineResults == null)
      return Future.succeededFuture(Optional.empty());
    return resolveUser(session)
        .compose(u -> pipelineResults.findLatestByCustomer(u.institutionId(), customerId));
  }

  public Future<Optional<KycPipelineResult>> getCustomerKycByInstitution(long institutionId, String customerId) {
    if (pipelineResults == null)
      return Future.succeededFuture(Optional.empty());
    return pipelineResults.findLatestByCustomer(institutionId, customerId);
  }

  public Future<Void> lookupForPipeline(long institutionId, String customerRef, String caseId) {
    return customerService.findByExternalId(institutionId, customerRef).compose(opt -> {
      if (opt.isPresent() && (opt.get().bvn() != null || opt.get().nin() != null)) {
        var c = opt.get();
        String detail = "KYC on file — BVN: " + (c.bvn() != null ? "verified" : "absent")
            + ", NIN: " + (c.nin() != null ? "verified" : "absent");
        return cases.addSystemActivity(caseId, institutionId, "kyc_verified", detail);
      }
      return cases.escalatePriorityBySystem(caseId, institutionId, "high")
          .compose(x -> cases.addSystemActivity(caseId, institutionId, "kyc_flag",
              "No KYC data on file for customer " + customerRef
                  + ". Priority escalated to HIGH — request customer to submit KYC via beam."));
    });
  }

  private static String kycNotes(String customerRef, String kycStatus, Integer tier, String error) {
    StringBuilder sb = new StringBuilder("KYC lookup performed for customer ").append(customerRef).append('.');
    if (kycStatus != null)
      sb.append(" Status: ").append(kycStatus).append('.');
    if (tier != null)
      sb.append(" Tier: ").append(tier).append('.');
    if (error != null)
      sb.append(" Error: ").append(error).append('.');
    return sb.toString();
  }

  // ── Logs ─────────────────────────────────────────────────────────────────

  public Future<List<KycLookupLog>> listLogs(Session session) {
    return resolveUser(session).compose(u -> repository.listLogs(u.institutionId()));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")));
  }
}
