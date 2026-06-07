package com.openiv.backend.doja;

import io.vertx.core.Future;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.client.WebClient;
import io.vertx.ext.web.multipart.MultipartForm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Base64;

/**
 * HTTP client for Dojah identity verification API.
 *
 * Auth headers on every request:
 *   AppId:         <config.appId()>
 *   Authorization: <config.apiKey()>   (raw key, no "Bearer")
 *
 * All Dojah endpoints respond with SSE (text/event-stream). The stream
 * closes after the final event, so WebClient.send() buffers the full
 * body. We extract the last {@code data:} line as the result JSON.
 *
 * Endpoints:
 *   GET  /api/v1/kyc/bvn/full?bvn=                   — BVN full lookup
 *   GET  /api/v1/kyc/nin?nin=                         — NIN lookup
 *   GET  /api/v1/kyc/phone_number/basic?phone_number= — phone lookup
 *   POST /api/v1/kyc/bvn/verify                       — BVN + selfie verify
 *   POST /api/v1/kyc/nin/verify                       — NIN + selfie verify
 */
public final class DojaClient {

  private static final Logger log = LoggerFactory.getLogger(DojaClient.class);

  private final WebClient  httpClient;
  private final DojaConfig config;

  public DojaClient(WebClient httpClient, DojaConfig config) {
    this.httpClient = httpClient;
    this.config     = config;
  }

  public DojaConfig config() { return config; }

  // ── BVN Full Lookup ───────────────────────────────────────────────────────

  public Future<DojaVerificationResult> verifyBvn(String bvn) {
    if (!config.isConfigured())
      return Future.succeededFuture(DojaVerificationResult.unverified("bvn", bvn, "not_configured"));

    String url = config.baseUrl() + "/api/v1/kyc/bvn/full?bvn=" + bvn;
    log.info("[Doja] >> GET {} | AppId={}", url, config.appId());

    return httpClient
        .getAbs(config.baseUrl() + "/api/v1/kyc/bvn/full")
        .addQueryParam("bvn", bvn)
        .putHeader("AppId",         config.appId())
        .putHeader("Authorization", config.apiKey())
        .putHeader("Accept",        "text/event-stream")
        .timeout(15_000)
        .send()
        .compose(resp -> {
          String raw = resp.bodyAsString();
          log.info("[Doja] << GET bvn/full | status={} body={}", resp.statusCode(), raw);
          if (resp.statusCode() != 200) {
            return Future.succeededFuture(DojaVerificationResult.unverified("bvn", bvn, raw));
          }
          return Future.succeededFuture(parseBvnLookup(bvn, extractSseJson(raw)));
        })
        .recover(err -> {
          log.error("[Doja] !! GET bvn/full error bvn={}: {}", bvn, err.getMessage());
          return Future.succeededFuture(DojaVerificationResult.unverified("bvn", bvn, err.getMessage()));
        });
  }

  // ── NIN Lookup ────────────────────────────────────────────────────────────

  public Future<DojaVerificationResult> verifyNin(String nin) {
    if (!config.isConfigured())
      return Future.succeededFuture(DojaVerificationResult.unverified("nin", nin, "not_configured"));

    String url = config.baseUrl() + "/api/v1/kyc/nin?nin=" + nin;
    log.info("[Doja] >> GET {} | AppId={}", url, config.appId());

    return httpClient
        .getAbs(config.baseUrl() + "/api/v1/kyc/nin")
        .addQueryParam("nin", nin)
        .putHeader("AppId",         config.appId())
        .putHeader("Authorization", config.apiKey())
        .putHeader("Accept",        "text/event-stream")
        .timeout(15_000)
        .send()
        .compose(resp -> {
          String raw = resp.bodyAsString();
          log.info("[Doja] << GET kyc/nin | status={} body={}", resp.statusCode(), raw);
          if (resp.statusCode() != 200) {
            return Future.succeededFuture(DojaVerificationResult.unverified("nin", nin, raw));
          }
          return Future.succeededFuture(parseNinLookup(nin, extractSseJson(raw)));
        })
        .recover(err -> {
          log.error("[Doja] !! GET kyc/nin error nin={}: {}", nin, err.getMessage());
          return Future.succeededFuture(DojaVerificationResult.unverified("nin", nin, err.getMessage()));
        });
  }

  // ── Phone Number Lookup ───────────────────────────────────────────────────

  public Future<DojaVerificationResult> lookupPhone(String phone) {
    if (!config.isConfigured())
      return Future.succeededFuture(DojaVerificationResult.unverified("phone", phone, "not_configured"));

    String url = config.baseUrl() + "/api/v1/kyc/phone_number/basic?phone_number=" + phone;
    log.info("[Doja] >> GET {} | AppId={}", url, config.appId());

    return httpClient
        .getAbs(config.baseUrl() + "/api/v1/kyc/phone_number/basic")
        .addQueryParam("phone_number", phone)
        .putHeader("AppId",         config.appId())
        .putHeader("Authorization", config.apiKey())
        .putHeader("Accept",        "text/event-stream")
        .timeout(15_000)
        .send()
        .compose(resp -> {
          String raw = resp.bodyAsString();
          log.info("[Doja] << GET phone_number/basic | status={} body={}", resp.statusCode(), raw);
          if (resp.statusCode() != 200) {
            return Future.succeededFuture(DojaVerificationResult.unverified("phone", phone, raw));
          }
          return Future.succeededFuture(parsePhoneLookup(phone, extractSseJson(raw)));
        })
        .recover(err -> {
          log.error("[Doja] !! GET phone_number/basic error phone={}: {}", phone, err.getMessage());
          return Future.succeededFuture(DojaVerificationResult.unverified("phone", phone, err.getMessage()));
        });
  }

  // ── BVN + Selfie Verify ───────────────────────────────────────────────────

  public Future<DojaVerificationResult> verifyBvnWithSelfie(String bvn, String selfieBase64) {
    if (!config.isConfigured())
      return Future.succeededFuture(DojaVerificationResult.unverified("bvn", bvn, "not_configured"));

    byte[] imageBytes = decodeImage(selfieBase64);
    MultipartForm form = MultipartForm.create()
        .attribute("bvn", bvn)
        .binaryFileUpload("selfie_image", "selfie.jpg", Buffer.buffer(imageBytes), "image/jpeg");

    log.info("[Doja] >> POST {}/api/v1/kyc/bvn/verify | AppId={} bvn={} image=[{} bytes]",
        config.baseUrl(), config.appId(), bvn, imageBytes.length);

    return httpClient
        .postAbs(config.baseUrl() + "/api/v1/kyc/bvn/verify")
        .putHeader("AppId",         config.appId())
        .putHeader("Authorization", config.apiKey())
        .putHeader("Accept",        "text/event-stream")
        .timeout(20_000)
        .sendMultipartForm(form)
        .compose(resp -> {
          String raw = resp.bodyAsString();
          log.info("[Doja] << POST bvn/verify | status={} body={}", resp.statusCode(), raw);
          if (resp.statusCode() != 200) {
            return Future.succeededFuture(DojaVerificationResult.unverified("bvn", bvn, raw));
          }
          return Future.succeededFuture(parseSelfieVerify("bvn", bvn, extractSseJson(raw)));
        })
        .recover(err -> {
          log.error("[Doja] !! POST bvn/verify error bvn={}: {}", bvn, err.getMessage());
          return Future.succeededFuture(DojaVerificationResult.unverified("bvn", bvn, err.getMessage()));
        });
  }

  // ── NIN + Selfie Verify ───────────────────────────────────────────────────

  public Future<DojaVerificationResult> verifyNinWithSelfie(String nin, String selfieBase64) {
    if (!config.isConfigured())
      return Future.succeededFuture(DojaVerificationResult.unverified("nin", nin, "not_configured"));

    byte[] imageBytes = decodeImage(selfieBase64);
    MultipartForm form = MultipartForm.create()
        .attribute("nin", nin)
        .binaryFileUpload("selfie_image", "selfie.jpg", Buffer.buffer(imageBytes), "image/jpeg");

    log.info("[Doja] >> POST {}/api/v1/kyc/nin/verify | AppId={} nin={} image=[{} bytes]",
        config.baseUrl(), config.appId(), nin, imageBytes.length);

    return httpClient
        .postAbs(config.baseUrl() + "/api/v1/kyc/nin/verify")
        .putHeader("AppId",         config.appId())
        .putHeader("Authorization", config.apiKey())
        .putHeader("Accept",        "text/event-stream")
        .timeout(20_000)
        .sendMultipartForm(form)
        .compose(resp -> {
          String raw = resp.bodyAsString();
          log.info("[Doja] << POST nin/verify | status={} body={}", resp.statusCode(), raw);
          if (resp.statusCode() != 200) {
            return Future.succeededFuture(DojaVerificationResult.unverified("nin", nin, raw));
          }
          return Future.succeededFuture(parseSelfieVerify("nin", nin, extractSseJson(raw)));
        })
        .recover(err -> {
          log.error("[Doja] !! POST nin/verify error nin={}: {}", nin, err.getMessage());
          return Future.succeededFuture(DojaVerificationResult.unverified("nin", nin, err.getMessage()));
        });
  }

  // ── Phone Fraud Screening ─────────────────────────────────────────────────

  public Future<PhoneFraudResult> screenPhoneFraud(String phone) {
    if (!config.isConfigured())
      return Future.succeededFuture(PhoneFraudResult.unresolved("not_configured"));

    log.info("[Doja] >> GET fraud/phone | phone={}", phone);

    return httpClient
        .getAbs(config.baseUrl() + "/api/v1/fraud/phone")
        .addQueryParam("phone", phone)
        .putHeader("AppId",         config.appId())
        .putHeader("Authorization", config.apiKey())
        .putHeader("Accept",        "text/event-stream")
        .timeout(15_000)
        .send()
        .<PhoneFraudResult>map(resp -> {
          String raw = resp.bodyAsString();
          log.info("[Doja] << GET fraud/phone | status={} body={}", resp.statusCode(), raw);
          if (resp.statusCode() != 200) return PhoneFraudResult.unresolved(raw);
          return parsePhoneFraud(extractSseJson(raw), raw);
        })
        .recover(err -> {
          log.error("[Doja] !! GET fraud/phone error phone={}: {}", phone, err.getMessage());
          return Future.succeededFuture(PhoneFraudResult.unresolved(err.getMessage()));
        });
  }

  // ── NUBAN (Bank Account) Lookup ──────────────────────────────────────────

  public Future<NubanResult> lookupNuban(String accountNumber, String bankCode) {
    if (!config.isConfigured())
      return Future.succeededFuture(NubanResult.unresolved("not_configured"));

    log.info("[Doja] >> GET nuban | account={} bank={}", accountNumber, bankCode);

    return httpClient
        .getAbs(config.baseUrl() + "/api/v1/kyc/nuban")
        .addQueryParam("account_number", accountNumber)
        .addQueryParam("bank_code",      bankCode)
        .putHeader("AppId",         config.appId())
        .putHeader("Authorization", config.apiKey())
        .putHeader("Accept",        "text/event-stream")
        .timeout(15_000)
        .send()
        .<NubanResult>map(resp -> {
          String raw = resp.bodyAsString();
          log.info("[Doja] << GET nuban | status={} body={}", resp.statusCode(), raw);
          if (resp.statusCode() != 200) return NubanResult.unresolved(raw);
          return parseNubanLookup(extractSseJson(raw), raw);
        })
        .recover(err -> {
          log.error("[Doja] !! GET nuban error account={}: {}", accountNumber, err.getMessage());
          return Future.succeededFuture(NubanResult.unresolved(err.getMessage()));
        });
  }

  // ── AML / PEP Screening ───────────────────────────────────────────────────

  public Future<JsonObject> screenAml(String name, String dob, String uniqueRef) {
    if (!config.isConfigured())
      return Future.succeededFuture(new JsonObject().put("error", "not_configured"));

    JsonObject props = new JsonObject()
        .put("names",         name)
        .put("date_of_birth", dob != null ? dob : "")
        .put("nationality",   "");

    JsonObject screeningOptions = new JsonObject()
        .put("pep_check",           true)
        .put("sanction",            true)
        .put("adverse_media_check", false)
        .put("watchlists",          new io.vertx.core.json.JsonArray())
        .put("match_threshold",     0.85);

    JsonObject body = new JsonObject()
        .put("properties",       props)
        .put("screening_options", screeningOptions)
        .put("schema",           "individual")
        .put("unique_reference", uniqueRef != null ? uniqueRef : "");

    log.info("[Doja] >> POST {}/api/v1/aml/v2/screening | name={}", config.baseUrl(), name);

    return httpClient
        .postAbs(config.baseUrl() + "/api/v1/aml/v2/screening")
        .putHeader("AppId",         config.appId())
        .putHeader("Authorization", config.apiKey())
        .putHeader("Content-Type",  "application/json")
        .putHeader("Accept",        "text/event-stream")
        .timeout(20_000)
        .sendJsonObject(body)
        .map(resp -> {
          String raw = resp.bodyAsString();
          log.info("[Doja] << POST aml/v2/screening | status={} body={}", resp.statusCode(), raw);
          if (resp.statusCode() != 200)
            return new JsonObject().put("error", raw);
          return extractSseJson(raw);
        })
        .recover(err -> {
          log.error("[Doja] !! POST aml/v2/screening error name={}: {}", name, err.getMessage());
          return Future.succeededFuture(new JsonObject().put("error", err.getMessage()));
        });
  }

  // ── Response Parsers ──────────────────────────────────────────────────────

  private DojaVerificationResult parseBvnLookup(String bvn, JsonObject json) {
    JsonObject e = json.getJsonObject("entity", json);
    return new DojaVerificationResult(
        "bvn", bvn, hasName(e),
        e.getString("first_name"),
        e.getString("last_name"),
        e.getString("middle_name"),
        e.getString("date_of_birth"),
        e.getString("phone_number1"),
        false, -1,
        json.encode(),
        e.getString("image"));
  }

  private DojaVerificationResult parseNinLookup(String nin, JsonObject json) {
    JsonObject e = json.getJsonObject("entity", json);
    return new DojaVerificationResult(
        "nin", nin, hasName(e),
        e.getString("first_name"),
        e.getString("last_name"),
        e.getString("middle_name"),
        e.getString("date_of_birth"),
        e.getString("phone_number"),
        false, -1,
        json.encode(),
        e.getString("photo"));
  }

  private DojaVerificationResult parsePhoneLookup(String phone, JsonObject json) {
    JsonObject e = json.getJsonObject("entity", json);
    return new DojaVerificationResult(
        "phone", phone, hasName(e),
        e.getString("first_name"),
        e.getString("last_name"),
        e.getString("middle_name"),
        e.getString("date_of_birth"),
        e.getString("phone_number"),
        false, -1,
        json.encode(),
        e.getString("photo"));
  }

  private PhoneFraudResult parsePhoneFraud(JsonObject json, String rawJson) {
    JsonObject e = json.getJsonObject("entity", json);
    if (e == null || !Boolean.TRUE.equals(e.getBoolean("valid"))) {
      return PhoneFraudResult.unresolved(rawJson);
    }
    JsonObject info = e.getJsonObject("information", new JsonObject());
    return new PhoneFraudResult(
        true,
        e.getString("phone"),
        Boolean.TRUE.equals(e.getBoolean("valid")),
        info.getString("carrier"),
        info.getString("type"),
        info.getString("country"),
        e.getInteger("risk_score",  0),
        Boolean.TRUE.equals(e.getBoolean("leaked")),
        Boolean.TRUE.equals(e.getBoolean("spammer")),
        Boolean.TRUE.equals(e.getBoolean("disposable")),
        Boolean.TRUE.equals(e.getBoolean("suspicious")),
        Boolean.TRUE.equals(e.getBoolean("recent_abuse")),
        Boolean.TRUE.equals(e.getBoolean("active")),
        rawJson);
  }

  private NubanResult parseNubanLookup(JsonObject json, String rawJson) {
    JsonObject e = json.getJsonObject("entity", json);
    String firstName = e.getString("first_name");
    if (firstName == null || firstName.isBlank()) return NubanResult.unresolved(rawJson);
    return new NubanResult(
        true,
        e.getString("account_name"),
        firstName,
        e.getString("last_name"),
        e.getString("other_names"),
        e.getString("dob"),
        e.getString("phone"),
        e.getString("identity_number"),
        e.getString("identity_type"),
        e.getString("city"),
        e.getString("state_code"),
        rawJson);
  }

  private DojaVerificationResult parseSelfieVerify(String type, String ref, JsonObject json) {
    JsonObject e      = json.getJsonObject("entity", json);
    JsonObject selfie = e.getJsonObject("selfie_verification", new JsonObject());
    boolean    match  = selfie.getBoolean("match", false);
    double     score  = selfie.getDouble("confidence_value", 0.0);
    String     phone  = e.getString("phone_number1", e.getString("phone_number"));
    return new DojaVerificationResult(
        type, ref, match,
        e.getString("first_name"),
        e.getString("last_name"),
        e.getString("middle_name"),
        e.getString("date_of_birth"),
        phone,
        match, score,
        json.encode(),
        e.getString("image"));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Dojah streams responses as SSE. The connection closes after the final
   * event, so WebClient.send() collects the full body. We scan for the last
   * {@code data:} line and parse it as JSON.
   * Falls back to treating the entire body as JSON for non-SSE responses.
   */
  static JsonObject extractSseJson(String body) {
    if (body == null || body.isBlank()) return new JsonObject();
    String trimmed = body.trim();
    if (trimmed.startsWith("{")) {
      try { return new JsonObject(trimmed); } catch (Exception ignored) {}
    }
    String lastData = null;
    for (String line : trimmed.split("\\r?\\n")) {
      if (line.startsWith("data: ")) {
        String candidate = line.substring(6).trim();
        if (!candidate.isEmpty() && !candidate.equals("[DONE]")) {
          lastData = candidate;
        }
      }
    }
    if (lastData != null) {
      try { return new JsonObject(lastData); } catch (Exception e) {
        return new JsonObject().put("raw", lastData);
      }
    }
    return new JsonObject();
  }

  /** Decode a base64 or data-URI image string to raw bytes. */
  private static byte[] decodeImage(String b64) {
    if (b64 == null || b64.isBlank()) return new byte[0];
    String stripped = b64.contains(",") ? b64.substring(b64.indexOf(',') + 1) : b64;
    try { return Base64.getDecoder().decode(stripped.trim()); }
    catch (IllegalArgumentException e) { return stripped.getBytes(); }
  }

private static boolean hasName(JsonObject entity) {
    String fn = entity.getString("first_name");
    return fn != null && !fn.isBlank();
  }
}
