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
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public final class WebhookService {

  private static final Set<String> VALID_EVENTS = Set.of(
      "tx.flagged", "tx.blocked",
      "case.opened", "case.escalated",
      "kyc.failed", "sar.filed");

  private final WebhookRepository repository;
  private final UserRepository     users;

  public WebhookService(WebhookRepository repository, UserRepository users) {
    this.repository = repository;
    this.users      = users;
  }

  // ── Secret ────────────────────────────────────────────────────────────────

  public Future<WebhookSecret> getSecret(Session session) {
    return resolveUser(session).compose(u ->
        repository.findOrCreateSecret(u.institutionId()));
  }

  public Future<WebhookSecret> rotateSecret(Session session) {
    return resolveUser(session).compose(u ->
        repository.rotateSecret(u.institutionId()));
  }

  public Future<WebhookSecret> updateAutoRotate(Session session, boolean autoRotate) {
    return resolveUser(session).compose(u ->
        repository.findOrCreateSecret(u.institutionId())
            .compose(s -> repository.updateAutoRotate(u.institutionId(), autoRotate)));
  }

  // ── Endpoints ─────────────────────────────────────────────────────────────

  public Future<List<WebhookEndpoint>> listEndpoints(Session session) {
    return resolveUser(session).compose(u ->
        repository.listEndpoints(u.institutionId()));
  }

  public Future<WebhookEndpoint> createEndpoint(Session session,
      String url, String description, List<String> events) {
    if (url == null || !url.startsWith("https://")) {
      return Future.failedFuture(new IllegalArgumentException("URL must start with https://"));
    }
    if (events == null || events.isEmpty()) {
      return Future.failedFuture(new IllegalArgumentException("At least one event must be selected"));
    }
    for (String e : events) {
      if (!VALID_EVENTS.contains(e))
        return Future.failedFuture(new IllegalArgumentException("Unknown event type: " + e));
    }
    return resolveUser(session).compose(u ->
        repository.createEndpoint(u.institutionId(), url, description, events, u.id()));
  }

  public Future<Optional<WebhookEndpoint>> updateEndpoint(Session session, long id,
      String status, List<String> events, String description) {
    if (status != null && !Set.of("active", "paused").contains(status)) {
      return Future.failedFuture(new IllegalArgumentException("Invalid status"));
    }
    if (events != null) {
      for (String e : events) {
        if (!VALID_EVENTS.contains(e))
          return Future.failedFuture(new IllegalArgumentException("Unknown event type: " + e));
      }
    }
    return resolveUser(session).compose(u ->
        repository.updateEndpoint(id, u.institutionId(), status, events, description));
  }

  public Future<Boolean> deleteEndpoint(Session session, long id) {
    return resolveUser(session).compose(u ->
        repository.deleteEndpoint(id, u.institutionId()));
  }

  // ── Test delivery ─────────────────────────────────────────────────────────

  public record TestResult(WebhookDelivery delivery, String payload, String signature) {}

  public Future<TestResult> sendTestEvent(Session session, long endpointId) {
    return resolveUser(session).compose(u ->
        repository.findEndpoint(endpointId, u.institutionId()).compose(opt -> {
          if (opt.isEmpty())
            return Future.failedFuture(new IllegalArgumentException("Endpoint not found"));
          return repository.findOrCreateSecret(u.institutionId()).compose(secret -> {
            String payload = buildTestPayload(u.institutionId(), endpointId).encode();
            String sig = sign(secret.secret(), payload);
            return repository.recordDelivery(
                    endpointId, u.institutionId(), "test.event", "delivered", 200)
                .map(d -> new TestResult(d, payload, sig));
          });
        }));
  }

  public Future<Integer> rotateExpiredSecrets() {
    return repository.rotateExpiredSecrets();
  }

  public Future<List<WebhookDelivery>> listDeliveries(Session session, long endpointId) {
    return resolveUser(session).compose(u ->
        repository.listDeliveries(endpointId, u.institutionId()));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static JsonObject buildTestPayload(long institutionId, long endpointId) {
    return new JsonObject()
        .put("event",          "test.event")
        .put("timestamp",      Instant.now().toString())
        .put("institutionId",  institutionId)
        .put("data", new JsonObject()
            .put("message",    "Test webhook delivery from OpenIV")
            .put("endpointId", endpointId));
  }

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

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")));
  }
}
