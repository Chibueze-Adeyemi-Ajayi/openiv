package com.openiv.backend.kyc;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.cases.CaseService;
import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.client.WebClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;

public final class KycService {

  private static final Logger log = LoggerFactory.getLogger(KycService.class);

  private final KycRepository repository;
  private final UserRepository users;
  private final WebClient      client;
  private final CaseService    cases;

  public KycService(KycRepository repository, UserRepository users, WebClient client, CaseService cases) {
    this.repository = repository;
    this.users      = users;
    this.client     = client;
    this.cases      = cases;
  }

  // ── Config ────────────────────────────────────────────────────────────────

  public Future<Optional<KycConfig>> getConfig(Session session) {
    return resolveUser(session).compose(u -> repository.findConfig(u.institutionId()));
  }

  public Future<KycConfig> saveConfig(Session session,
      String lookupUrl, String lookupApiKey, Integer lookupTimeout,
      String listenerUrl, String listenerApiKey) {
    if (lookupUrl != null && !lookupUrl.isBlank() && !lookupUrl.startsWith("https://"))
      return Future.failedFuture(new IllegalArgumentException("Lookup URL must start with https://"));
    if (listenerUrl != null && !listenerUrl.isBlank() && !listenerUrl.startsWith("https://"))
      return Future.failedFuture(new IllegalArgumentException("Listener URL must start with https://"));
    return resolveUser(session).compose(u ->
        repository.saveConfig(u.institutionId(),
            lookupUrl, lookupApiKey, lookupTimeout, listenerUrl, listenerApiKey));
  }

  // ── Lookup ────────────────────────────────────────────────────────────────

  public Future<JsonObject> lookup(Session session, String customerRef, String triggerSource, boolean openCase) {
    if (customerRef == null || customerRef.isBlank())
      return Future.failedFuture(new IllegalArgumentException("customerRef is required"));
    return resolveUser(session).compose(u ->
        repository.findConfig(u.institutionId()).compose(cfgOpt -> {
          if (cfgOpt.isEmpty() || cfgOpt.get().lookupUrl() == null)
            return Future.failedFuture(new IllegalStateException("KYC lookup URL not configured"));
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
                      "Automatically opened by KYC review", null)
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
                .compose(ignored -> Future.failedFuture(err));
          });
        }));
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
