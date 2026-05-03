package com.openiv.backend.webhooks;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public final class WebhookService {

  private static final Set<String> VALID_EVENTS = Set.of(
      "tx.received", "tx.flagged", "tx.blocked",
      "case.opened", "case.escalated",
      "kyc.failed", "sar.filed");

  private final WebhookRepository     repository;
  private final UserRepository        users;
  private final WebhookDeliveryService deliveryService;

  public WebhookService(WebhookRepository repository, UserRepository users,
      WebhookDeliveryService deliveryService) {
    this.repository      = repository;
    this.users           = users;
    this.deliveryService = deliveryService;
  }

  // ── Secret ────────────────────────────────────────────────────────────────

  public Future<WebhookSecret> getSecret(Session session) {
    return resolveUser(session).compose(u -> repository.findOrCreateSecret(u.institutionId()));
  }

  public Future<WebhookSecret> rotateSecret(Session session) {
    return resolveUser(session).compose(u -> repository.rotateSecret(u.institutionId()));
  }

  public Future<WebhookSecret> updateAutoRotate(Session session, boolean autoRotate) {
    return resolveUser(session).compose(u ->
        repository.findOrCreateSecret(u.institutionId())
            .compose(s -> repository.updateAutoRotate(u.institutionId(), autoRotate)));
  }

  public Future<Integer> rotateExpiredSecrets() {
    return repository.rotateExpiredSecrets();
  }

  // ── Endpoints ─────────────────────────────────────────────────────────────

  public Future<List<WebhookEndpoint>> listEndpoints(Session session) {
    return resolveUser(session).compose(u -> repository.listEndpoints(u.institutionId()));
  }

  public Future<WebhookEndpoint> createEndpoint(Session session,
      String url, String description, List<String> events) {
    if (url == null || !url.startsWith("https://"))
      return Future.failedFuture(new IllegalArgumentException("URL must start with https://"));
    if (events == null || events.isEmpty())
      return Future.failedFuture(new IllegalArgumentException("At least one event must be selected"));
    for (String e : events)
      if (!VALID_EVENTS.contains(e))
        return Future.failedFuture(new IllegalArgumentException("Unknown event type: " + e));
    return resolveUser(session).compose(u ->
        repository.createEndpoint(u.institutionId(), url, description, events, u.id()));
  }

  public Future<Optional<WebhookEndpoint>> updateEndpoint(Session session, long id,
      String status, List<String> events, String description) {
    if (status != null && !Set.of("active", "paused").contains(status))
      return Future.failedFuture(new IllegalArgumentException("Invalid status"));
    if (events != null)
      for (String e : events)
        if (!VALID_EVENTS.contains(e))
          return Future.failedFuture(new IllegalArgumentException("Unknown event type: " + e));
    return resolveUser(session).compose(u ->
        repository.updateEndpoint(id, u.institutionId(), status, events, description));
  }

  public Future<Boolean> deleteEndpoint(Session session, long id) {
    return resolveUser(session).compose(u -> repository.deleteEndpoint(id, u.institutionId()));
  }

  public Future<JsonObject> verifyEndpoint(Session session, String url, String type) {
    if (url == null || !url.startsWith("https://"))
      return Future.failedFuture(new IllegalArgumentException("URL must start with https://"));
    if (!"notification".equals(type) && !"kyc".equals(type))
      return Future.failedFuture(new IllegalArgumentException("type must be 'notification' or 'kyc'"));
    return resolveUser(session).compose(u -> deliveryService.verifyUrl(url, type));
  }

  // ── Security rules ────────────────────────────────────────────────────────

  public Future<Optional<WebhookSecurityRule>> getSecurityRule(Session session, long endpointId) {
    return resolveUser(session).compose(u ->
        repository.findSecurityRule(endpointId, u.institutionId()));
  }

  public Future<WebhookSecurityRule> upsertSecurityRule(Session session, long endpointId,
      String apiKey, String ipAllowlist, int timeoutSeconds, int maxRetries, boolean requireAck) {
    return resolveUser(session).compose(u ->
        repository.upsertSecurityRule(endpointId, u.institutionId(),
            apiKey, ipAllowlist, timeoutSeconds, maxRetries, requireAck));
  }

  public Future<String> generateApiKey(Session session, long endpointId) {
    String key = WebhookDeliveryService.generateApiKey();
    return resolveUser(session).compose(u ->
        repository.findSecurityRule(endpointId, u.institutionId()).compose(opt -> {
          var existing = opt.orElse(null);
          int timeout  = existing != null ? existing.timeoutSeconds() : 10;
          int retries  = existing != null ? existing.maxRetries()     : 3;
          boolean ack  = existing != null && existing.requireAck();
          String ips   = existing != null ? existing.ipAllowlist()    : null;
          return repository.upsertSecurityRule(endpointId, u.institutionId(),
              key, ips, timeout, retries, ack);
        })).map(r -> key);
  }

  // ── Delivery ──────────────────────────────────────────────────────────────

  public record TestResult(WebhookDelivery delivery, String payload, String signature) {}

  public Future<TestResult> sendTestEvent(Session session, long endpointId) {
    return resolveUser(session).compose(u ->
        repository.findEndpoint(endpointId, u.institutionId()).compose(opt -> {
          if (opt.isEmpty())
            return Future.failedFuture(new IllegalArgumentException("Endpoint not found"));
          WebhookEndpoint ep = opt.get();
          return repository.findOrCreateSecret(u.institutionId()).compose(secret ->
              repository.findSecurityRule(endpointId, u.institutionId()).compose(ruleOpt -> {
                WebhookSecurityRule rule = ruleOpt.orElse(null);
                JsonObject data = WebhookPayloadBuilder.testEvent(u.institutionId(), endpointId);
                String deliveryId = WebhookDeliveryService.generateDeliveryId();
                JsonObject envelope = WebhookPayloadBuilder.envelope(
                    deliveryId, "test.event", u.institutionId(), data);
                String payload = envelope.encode();
                String sig = sign(secret.secret(), payload);
                return deliveryService.deliver(ep, secret, rule, "test.event", data)
                    .map(d -> new TestResult(d, payload, sig));
              }));
        }));
  }

  public Future<List<WebhookDelivery>> listDeliveries(Session session, long endpointId) {
    return resolveUser(session).compose(u ->
        repository.listDeliveries(endpointId, u.institutionId()));
  }

  public Future<List<WebhookDelivery>> listAllDeliveries(Session session) {
    return resolveUser(session).compose(u -> repository.listAllDeliveries(u.institutionId()));
  }

  /**
   * Broadcasts an event to all active webhook endpoints for an institution.
   */
  public Future<Void> broadcast(long institutionId, String eventType, JsonObject data) {
    if (!VALID_EVENTS.contains(eventType)) {
      return Future.failedFuture(new IllegalArgumentException("Unknown event type: " + eventType));
    }

    return repository.listEndpoints(institutionId).compose(endpoints -> {
      List<Future<WebhookDelivery>> futures = endpoints.stream()
          .filter(e -> "active".equalsIgnoreCase(e.status()))
          .filter(e -> e.events().contains(eventType))
          .map(e -> repository.findOrCreateSecret(institutionId).compose(secret ->
              repository.findSecurityRule(e.id(), institutionId).compose(ruleOpt ->
                  deliveryService.deliver(e, secret, ruleOpt.orElse(null), eventType, data))))
          .toList();

      return Future.all(futures).mapEmpty();
    });
  }

  // ── Signing ───────────────────────────────────────────────────────────────

  static String sign(String secret, String payload) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      byte[] bytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder(bytes.length * 2);
      for (byte b : bytes) sb.append(String.format("%02x", b));
      return sb.toString();
    } catch (Exception e) {
      throw new RuntimeException("HMAC signing failed", e);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")));
  }
}
