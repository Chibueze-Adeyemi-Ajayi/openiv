package com.openiv.backend.webhooks;

import io.vertx.core.Future;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.client.WebClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.stream.Collectors;

/**
 * Delivers a signed event payload to a single webhook endpoint via HTTPS POST.
 *
 * <p>Headers sent on every delivery:
 * <ul>
 *   <li>{@code Content-Type: application/json}</li>
 *   <li>{@code X-OpenIV-Signature} — HMAC-SHA256 hex of the payload body</li>
 *   <li>{@code X-OpenIV-Event} — event type (e.g. {@code tx.flagged})</li>
 *   <li>{@code X-OpenIV-Delivery} — unique delivery ID for idempotency</li>
 *   <li>{@code X-OpenIV-Institution} — institution ID for multi-tenant consumers</li>
 *   <li>{@code X-OpenIV-Api-Key} — optional API key from security rules</li>
 * </ul>
 */
public final class WebhookDeliveryService {

  private static final Logger log = LoggerFactory.getLogger(WebhookDeliveryService.class);
  private static final SecureRandom RNG = new SecureRandom();

  private final WebClient          client;
  private final WebhookRepository  repository;

  public WebhookDeliveryService(WebClient client, WebhookRepository repository) {
    this.client     = client;
    this.repository = repository;
  }

  /**
   * Constructs and delivers an event payload; returns the persisted delivery record.
   */
  public Future<WebhookDelivery> deliver(
      WebhookEndpoint endpoint, WebhookSecret secret,
      WebhookSecurityRule rule, String eventType, JsonObject eventData) {

    String deliveryId = generateDeliveryId();
    JsonObject envelope = WebhookPayloadBuilder.envelope(
        deliveryId, eventType, endpoint.institutionId(), eventData);
    String payload   = envelope.encode();
    String signature = WebhookService.sign(secret.secret(), payload);

    int timeoutMs = rule != null ? rule.timeoutSeconds() * 1_000 : 10_000;
    String apiKey = rule != null ? rule.apiKey() : null;

    String reqHeaders = buildRequestHeadersLog(signature, eventType, deliveryId,
        endpoint.institutionId(), apiKey);

    long start = System.currentTimeMillis();

    var request = client.postAbs(endpoint.url())
        .putHeader("Content-Type",          "application/json")
        .putHeader("X-OpenIV-Signature",    signature)
        .putHeader("X-OpenIV-Event",        eventType)
        .putHeader("X-OpenIV-Delivery",     deliveryId)
        .putHeader("X-OpenIV-Institution",  String.valueOf(endpoint.institutionId()))
        .timeout(timeoutMs);

    if (apiKey != null && !apiKey.isBlank()) {
      request = request.putHeader("X-OpenIV-Api-Key", apiKey);
    }

    return request.sendBuffer(Buffer.buffer(payload))
        .compose(resp -> {
          int durationMs = (int) (System.currentTimeMillis() - start);
          boolean success = resp.statusCode() >= 200 && resp.statusCode() < 300;
          String respHeaders = resp.headers().entries().stream()
              .map(e -> e.getKey() + ": " + e.getValue())
              .collect(Collectors.joining("\n"));
          String respBody = resp.bodyAsString();
          String status = success ? "delivered" : "failed";

          log.debug("Webhook delivery {} {} → {} {} ({}ms)",
              deliveryId, eventType, endpoint.url(), resp.statusCode(), durationMs);

          return repository.recordDelivery(
              endpoint.id(), endpoint.institutionId(), eventType, status,
              resp.statusCode(), deliveryId, reqHeaders, payload,
              respHeaders, respBody, durationMs, null);
        })
        .recover(err -> {
          int durationMs = (int) (System.currentTimeMillis() - start);
          log.warn("Webhook delivery {} {} → {} failed: {}",
              deliveryId, eventType, endpoint.url(), err.getMessage());
          return repository.recordDelivery(
              endpoint.id(), endpoint.institutionId(), eventType, "failed",
              null, deliveryId, reqHeaders, payload, null, null, durationMs, err.getMessage());
        });
  }

  private static String buildRequestHeadersLog(String sig, String eventType,
      String deliveryId, long institutionId, String apiKey) {
    StringBuilder sb = new StringBuilder();
    sb.append("Content-Type: application/json\n");
    sb.append("X-OpenIV-Signature: ").append(sig).append("\n");
    sb.append("X-OpenIV-Event: ").append(eventType).append("\n");
    sb.append("X-OpenIV-Delivery: ").append(deliveryId).append("\n");
    sb.append("X-OpenIV-Institution: ").append(institutionId).append("\n");
    if (apiKey != null && !apiKey.isBlank()) {
      sb.append("X-OpenIV-Api-Key: [REDACTED]\n");
    }
    return sb.toString().stripTrailing();
  }

  /**
   * Fires a lightweight probe to {@code url} to check reachability without creating a
   * full delivery record. Returns a summary: ok, statusCode, durationMs, error.
   *
   * <ul>
   *   <li>{@code notification} type — HTTP POST with a minimal JSON ping body</li>
   *   <li>{@code kyc} type — HTTP GET (simulates the pull the fraud pipeline makes)</li>
   * </ul>
   */
  public Future<JsonObject> verifyUrl(String url, String type) {
    long start = System.currentTimeMillis();
    if ("kyc".equals(type)) {
      return client.getAbs(url).timeout(10_000)
          .send()
          .map(resp -> verifyResult(resp.statusCode(), start, null))
          .recover(err -> Future.succeededFuture(verifyResult(null, start, err.getMessage())));
    } else {
      var ping = new JsonObject()
          .put("type",      "openiv.verify")
          .put("message",   "Endpoint verification ping from OpenIV")
          .put("timestamp", java.time.Instant.now().toString());
      return client.postAbs(url).timeout(10_000)
          .putHeader("Content-Type",       "application/json")
          .putHeader("X-OpenIV-Event",     "openiv.verify")
          .sendJsonObject(ping)
          .map(resp -> verifyResult(resp.statusCode(), start, null))
          .recover(err -> Future.succeededFuture(verifyResult(null, start, err.getMessage())));
    }
  }

  private static JsonObject verifyResult(Integer code, long startMs, String error) {
    int ms  = (int) (System.currentTimeMillis() - startMs);
    boolean ok = code != null && code >= 200 && code < 500;
    var r = new JsonObject().put("ok", ok).put("durationMs", ms);
    if (code  != null) r.put("statusCode", code); else r.putNull("statusCode");
    if (error != null) r.put("error", error);     else r.putNull("error");
    return r;
  }

  static String generateDeliveryId() {
    byte[] bytes = new byte[9];
    RNG.nextBytes(bytes);
    return "whdl_" + System.currentTimeMillis() + "_"
        + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  static String generateApiKey() {
    byte[] bytes = new byte[24];
    RNG.nextBytes(bytes);
    return "oiv_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
}
