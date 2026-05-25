package com.openiv.backend.billing;

import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.client.WebClient;

import java.util.UUID;

public final class PaystackClient {

  private static final String HOST = "api.paystack.co";

  private final WebClient http;
  private final String secretKey;

  public PaystackClient(WebClient http, String secretKey) {
    this.http = http;
    this.secretKey = secretKey;
  }

  public boolean isConfigured() {
    return secretKey != null && !secretKey.isBlank() && !secretKey.startsWith("sk_test_placeholder");
  }

  /**
   * Initialize a payment. Returns JsonObject with {reference, authorization_url}.
   * In dev mode (not configured), returns a mock reference and URL.
   */
  public Future<JsonObject> initializeTransaction(String email, long amountKobo, JsonObject metadata) {
    if (!isConfigured()) {
      String ref = "dev_ref_" + UUID.randomUUID();
      return Future.succeededFuture(new JsonObject()
          .put("reference", ref)
          .put("access_code", (String) null)   // null signals dev mode to the frontend
          .put("authorization_url", "http://localhost:5173/dashboard/subscription?mock=true&ref=" + ref));
    }

    JsonObject body = new JsonObject()
        .put("email", email)
        .put("amount", amountKobo)
        .put("metadata", metadata);

    return http.post(443, HOST, "/transaction/initialize")
        .ssl(true)
        .putHeader("Authorization", "Bearer " + secretKey)
        .putHeader("Content-Type", "application/json")
        .sendJsonObject(body)
        .compose(resp -> {
          JsonObject json = resp.bodyAsJsonObject();
          if (json == null || !Boolean.TRUE.equals(json.getBoolean("status"))) {
            String msg = json != null ? json.getString("message", "Paystack error") : "Paystack error";
            return Future.failedFuture(msg);
          }
          return Future.succeededFuture(json.getJsonObject("data"));
        });
  }

  /**
   * Verify a completed transaction. Returns the data object from Paystack.
   * Fails if the transaction status is not 'success'.
   */
  public Future<JsonObject> verifyTransaction(String reference) {
    if (!isConfigured()) {
      // In dev mode, always succeed verification for dev refs
      return Future.succeededFuture(new JsonObject()
          .put("status", "success")
          .put("reference", reference)
          .put("amount", 0));
    }

    return http.get(443, HOST, "/transaction/verify/" + reference)
        .ssl(true)
        .putHeader("Authorization", "Bearer " + secretKey)
        .send()
        .compose(resp -> {
          JsonObject json = resp.bodyAsJsonObject();
          if (json == null || !Boolean.TRUE.equals(json.getBoolean("status"))) {
            String msg = json != null ? json.getString("message", "Paystack verification failed") : "Paystack verification failed";
            return Future.failedFuture(msg);
          }
          JsonObject data = json.getJsonObject("data");
          if (data == null || !"success".equals(data.getString("status"))) {
            return Future.failedFuture("Transaction not successful");
          }
          return Future.succeededFuture(data);
        });
  }
}
