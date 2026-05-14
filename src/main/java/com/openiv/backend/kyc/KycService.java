package com.openiv.backend.kyc;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.cases.CaseService;
import com.openiv.backend.customers.CustomerService;
import com.openiv.backend.notifications.NotificationService;
import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.client.WebClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;
import io.vertx.core.json.JsonArray;

public final class KycService {

  private static final Logger log = LoggerFactory.getLogger(KycService.class);

  private final KycRepository repository;
  private final UserRepository users;
  private final WebClient      client;
  private final CaseService    cases;
  private final NotificationService notifications;
  private final CustomerService customerService;

  public KycService(KycRepository repository, UserRepository users, WebClient client,
      CaseService cases, NotificationService notifications, CustomerService customerService) {
    this.repository = repository;
    this.users      = users;
    this.client     = client;
    this.cases      = cases;
    this.notifications = notifications;
    this.customerService = customerService;
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
    return resolveUser(session).compose(u ->
        repository.saveConfig(u.institutionId(),
            lookupUrl, lookupApiKey, lookupTimeout));
  }

  // ── PEP Screening ───────────────────────────────────────────────────────────

  public Future<JsonArray> searchPEP(Session session, String query) {
    if (query == null || query.isBlank())
      return Future.failedFuture(new IllegalArgumentException("query is required"));

    return resolveUser(session).compose(u -> {
      String apiKey = System.getenv("OPEN_SANCTIONS_API_KEY");
      if (apiKey == null || apiKey.isBlank()) {
        log.error("OPEN_SANCTIONS_API_KEY is not configured.");
        return Future.failedFuture(new IllegalStateException("PEP API key is not configured on the server."));
      }

      String url = "https://api.opensanctions.org/search/default";
      return client.getAbs(url)
          .addQueryParam("q", query.trim())
          .addQueryParam("limit", "10")
          .putHeader("Authorization", "ApiKey " + apiKey)
          .send()
          .compose(resp -> {
            if (resp.statusCode() != 200) {
              log.error("OpenSanctions API failed with {}: {}", resp.statusCode(), resp.bodyAsString());
              return Future.failedFuture("PEP screening service temporarily unavailable.");
            }
            try {
              JsonObject body = resp.bodyAsJsonObject();
              JsonArray results = body.getJsonArray("results");
              JsonArray mapped = new JsonArray();
              if (results != null) {
                for (int i = 0; i < results.size(); i++) {
                  JsonObject item = results.getJsonObject(i);
                  String id = item.getString("id");
                  String name = item.getString("caption");
                  JsonObject props = item.getJsonObject("properties");
                  
                  String position = "";
                  String country = "";
                  if (props != null) {
                    JsonArray posArr = props.getJsonArray("position");
                    if (posArr != null && !posArr.isEmpty()) position = posArr.getString(0);
                    JsonArray ctryArr = props.getJsonArray("country");
                    if (ctryArr != null && !ctryArr.isEmpty()) country = ctryArr.getString(0);
                  }

                  String riskLevel = "Medium";
                  JsonArray topics = props != null ? props.getJsonArray("topics") : null;
                  if (topics != null) {
                    for (int t = 0; t < topics.size(); t++) {
                      String topic = topics.getString(t).toLowerCase();
                      if (topic.contains("sanction") || topic.contains("wanted") || topic.contains("terrorism")) {
                        riskLevel = "High";
                        break;
                      }
                    }
                  }

                  mapped.add(new JsonObject()
                      .put("id", id)
                      .put("name", name)
                      .put("position", position.isBlank() ? "Unknown Position" : position)
                      .put("organization", "OpenSanctions Database")
                      .put("country", country.isBlank() ? "Unknown" : country.toUpperCase())
                      .put("riskLevel", riskLevel)
                      .put("lastUpdated", item.getString("last_seen", "Recent")));
                }
              }
              return Future.succeededFuture(mapped);
            } catch (Exception e) {
              log.error("Failed to parse OpenSanctions response: {}", e.getMessage());
              return Future.failedFuture("Failed to parse PEP screening response.");
            }
          });
    });
  }

  // ── Lookup ────────────────────────────────────────────────────────────────

  public Future<JsonObject> lookup(Session session, String customerRef, String triggerSource, boolean openCase) {
    if (customerRef == null || customerRef.isBlank())
      return Future.failedFuture(new IllegalArgumentException("customerRef is required"));
    return resolveUser(session).compose(u ->
        repository.findConfig(u.institutionId()).compose(cfgOpt -> {
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
                  tier      = body.getInteger("tier");
                  kycStatus = body.getString("status");
                }
              } catch (Exception e) {
                log.warn("KYC response not JSON for ref={}: {}", customerRef, e.getMessage());
                body = new JsonObject().put("raw", resp.bodyAsString());
              }
            } else {
              errorMsg = "HTTP " + code + ": " + resp.bodyAsString();
            }

            final JsonObject kycBody  = body != null ? body : new JsonObject();
            final Integer    finalTier = tier;
            final String finalKycStatus = kycStatus;
            final String finalError   = errorMsg;
            final boolean lookupOk    = success;

            return repository.saveLog(u.institutionId(), customerRef, src,
                logStatus, code, durationMs, finalTier, finalKycStatus, finalError)
                .compose(ignored -> {
                  JsonObject base = new JsonObject()
                      .put("customerId", customerRef)
                      .put("kyc", kycBody);
                  if (!openCase) return Future.succeededFuture(base);

                  String casePriority = lookupOk ? "medium" : "high";
                  int riskScore = finalTier != null ? Math.max(0, (4 - finalTier) * 25) : 50;
                  String notes = kycNotes(customerRef, finalKycStatus, finalTier, finalError);
                  return cases.create(session, "KYC Review: " + customerRef,
                      "kyc_review", casePriority, riskScore, null, notes, null,
                      "Automatically opened by KYC review", null, customerRef, null)
                      .map(cas -> base.put("case", new JsonObject()
                          .put("id",         cas.id())
                          .put("title",      cas.title())
                          .put("status",     cas.status())
                          .put("priority",   cas.priority())
                          .put("riskScore",  cas.riskScore())
                          .put("slaDeadline", cas.slaDeadline().toString())
                          .put("createdAt",  cas.createdAt().toString())));
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
    if (kycStatus != null) sb.append(" Status: ").append(kycStatus).append('.');
    if (tier      != null) sb.append(" Tier: ").append(tier).append('.');
    if (error     != null) sb.append(" Error: ").append(error).append('.');
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
