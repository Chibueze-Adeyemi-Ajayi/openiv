package com.openiv.backend.billing;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.client.WebClient;
import io.vertx.ext.web.client.WebClientOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

public final class BillingService {

  private static final Logger log = LoggerFactory.getLogger(BillingService.class);

  // Kept for callers that reference BillingService.UNITS_PER_NGN by convention.
  public static final long UNITS_PER_NGN = BillingRates.UNITS_PER_NGN;

  private static final String PAYSTACK_API    = "https://api.paystack.co";
  private static final int    GCM_TAG_BITS    = 128;
  private static final int    GCM_NONCE_BYTES = 12;

  // Dev-mode fallback: 32 zero bytes, base64-encoded. Never use in production.
  private static final String DEV_FALLBACK_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

  private final BillingRepository repository;
  private final UserRepository    users;
  private final WebClient         http;
  private final String            paystackSecretKey;
  private final SecretKeySpec     encryptionKey;

  public BillingService(BillingRepository repository, UserRepository users,
      Vertx vertx, String paystackSecretKey, String encryptionKeyBase64) {
    this.repository       = repository;
    this.users            = users;
    this.http             = WebClient.create(vertx, new WebClientOptions().setSsl(true));
    this.paystackSecretKey = paystackSecretKey;
    this.encryptionKey    = loadKey(encryptionKeyBase64);
  }

  // ── Wallet ────────────────────────────────────────────────────────────────

  public Future<BillingWallet> getWallet(Session session) {
    return resolveUser(session).compose(u -> repository.getOrCreateWallet(u.institutionId()));
  }

  // ── Fire-and-forget charge helpers (called from handlers) ─────────────────

  public void chargeBeamIngestAsync(long institutionId) {
    repository.getOrCreateWallet(institutionId)
        .compose(wallet -> repository.debit(
            institutionId, wallet.id(), BillingRates.RATE_BEAM_INGEST,
            "beam_ingest", "Beam data ingest", null))
        .onFailure(err -> log.warn("Beam billing charge failed for institution {}: {}",
            institutionId, err.getMessage()));
  }

  public void chargeKycLookupAsync(Session session, String customerRef) {
    resolveUser(session)
        .compose(u -> repository.getOrCreateWallet(u.institutionId())
            .compose(wallet -> repository.debit(
                u.institutionId(), wallet.id(), BillingRates.RATE_KYC_LOOKUP,
                "kyc_lookup", "KYC lookup · " + customerRef, null)))
        .onFailure(err -> log.warn("KYC billing charge failed: {}", err.getMessage()));
  }

  public void chargeAiTokensAsync(long institutionId, int tokenCount) {
    if (tokenCount <= 0) return;
    long units = (long) tokenCount * BillingRates.RATE_AI_TOKEN;
    repository.getOrCreateWallet(institutionId)
        .compose(wallet -> repository.debit(
            institutionId, wallet.id(), units,
            "ai_token", "AI token usage · " + tokenCount + " tokens", null))
        .onFailure(err -> log.warn("AI token billing failed for institution {}: {}",
            institutionId, err.getMessage()));
  }

  public void chargeWebhookDeliveryAsync(long institutionId) {
    repository.getOrCreateWallet(institutionId)
        .compose(wallet -> repository.debit(
            institutionId, wallet.id(), BillingRates.RATE_WEBHOOK,
            "webhook_delivery", "Webhook delivery", null))
        .onFailure(err -> log.warn("Webhook billing charge failed for institution {}: {}",
            institutionId, err.getMessage()));
  }

  public void chargeDocumentUploadAsync(Session session) {
    resolveUser(session)
        .compose(u -> repository.getOrCreateWallet(u.institutionId())
            .compose(wallet -> repository.debit(
                u.institutionId(), wallet.id(), BillingRates.RATE_DOCUMENT_UPLOAD,
                "document_upload", "Document upload", null)))
        .onFailure(err -> log.warn("Document upload billing failed: {}", err.getMessage()));
  }

  public void chargeTransactionImportAsync(Session session, int txnCount) {
    if (txnCount <= 0) return;
    long units = (long) txnCount * BillingRates.RATE_TRANSACTION_IMPORT;
    resolveUser(session)
        .compose(u -> repository.getOrCreateWallet(u.institutionId())
            .compose(wallet -> repository.debit(
                u.institutionId(), wallet.id(), units,
                "transaction_import", "Transaction import · " + txnCount + " rows", null)))
        .onFailure(err -> log.warn("Transaction import billing failed: {}", err.getMessage()));
  }

  public void chargeCaseOpenAsync(Session session) {
    resolveUser(session)
        .compose(u -> repository.getOrCreateWallet(u.institutionId())
            .compose(wallet -> repository.debit(
                u.institutionId(), wallet.id(), BillingRates.RATE_CASE_OPEN,
                "case_open", "Case opened", null)))
        .onFailure(err -> log.warn("Case open billing failed: {}", err.getMessage()));
  }

  public void chargeNfiuReturnAsync(Session session) {
    resolveUser(session)
        .compose(u -> repository.getOrCreateWallet(u.institutionId())
            .compose(wallet -> repository.debit(
                u.institutionId(), wallet.id(), BillingRates.RATE_NFIU_RETURN,
                "nfiu_return", "NFIU return filing", null)))
        .onFailure(err -> log.warn("NFIU return billing failed: {}", err.getMessage()));
  }

  public void chargeReportExportAsync(Session session) {
    resolveUser(session)
        .compose(u -> repository.getOrCreateWallet(u.institutionId())
            .compose(wallet -> repository.debit(
                u.institutionId(), wallet.id(), BillingRates.RATE_REPORT_EXPORT,
                "report_export", "Transaction export", null)))
        .onFailure(err -> log.warn("Report export billing failed: {}", err.getMessage()));
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  public Future<JsonObject> getSummary(Session session) {
    return resolveUser(session)
        .compose(u -> repository.getOrCreateWallet(u.institutionId()))
        .map(wallet -> new JsonObject()
            .put("balanceUnits",    wallet.balanceUnits())
            .put("balanceNgn",      wallet.balanceNgn())
            .put("creditExpiresAt", wallet.creditExpiresAt() != null
                ? wallet.creditExpiresAt().toString() : null));
  }

  // ── Usage (current billing period) ───────────────────────────────────────

  public Future<BillingUsage> getUsage(Session session) {
    return resolveUser(session).compose(u -> repository.getUsage(u.institutionId()));
  }

  // ── Ledger ────────────────────────────────────────────────────────────────

  public Future<List<BillingLedgerEntry>> getLedger(Session session) {
    return resolveUser(session).compose(u -> repository.listLedger(u.institutionId(), 90));
  }

  // ── Payment methods ───────────────────────────────────────────────────────

  public Future<List<PaymentMethod>> listPaymentMethods(Session session) {
    return resolveUser(session)
        .compose(u -> repository.listPaymentMethods(u.institutionId()))
        .map(methods -> methods.stream()
            .map(m -> new PaymentMethod(
                m.id(), m.institutionId(), m.provider(),
                null, // never expose the encrypted auth_code to the frontend
                m.type(), m.displayName(), m.last4(), m.isDefault(), m.createdAt()))
            .toList());
  }

  public Future<Void> deletePaymentMethod(Session session, long methodId) {
    return resolveUser(session)
        .compose(u -> repository.deletePaymentMethod(u.institutionId(), methodId))
        .mapEmpty();
  }

  // ── Paystack: initialize payment ──────────────────────────────────────────

  public Future<JsonObject> initializePayment(Session session, long amountNgn, String email) {
    long amountKobo = amountNgn * 100L;
    return http.postAbs(PAYSTACK_API + "/transaction/initialize")
        .putHeader("Authorization", "Bearer " + paystackSecretKey)
        .putHeader("Content-Type",  "application/json")
        .sendJsonObject(new JsonObject()
            .put("amount",   amountKobo)
            .put("email",    email)
            .put("currency", "NGN"))
        .map(resp -> {
          JsonObject body = resp.bodyAsJsonObject();
          if (!Boolean.TRUE.equals(body.getBoolean("status")))
            throw new IllegalStateException("Paystack init failed: " + body.getString("message"));
          JsonObject data = body.getJsonObject("data");
          return new JsonObject()
              .put("accessCode",       data.getString("access_code"))
              .put("reference",        data.getString("reference"))
              .put("authorizationUrl", data.getString("authorization_url"));
        });
  }

  // ── Paystack: verify payment + optionally save card ───────────────────────

  public Future<JsonObject> verifyAndSaveCard(Session session, String reference, boolean saveCard) {
    return resolveUser(session).compose(u ->
        http.getAbs(PAYSTACK_API + "/transaction/verify/" + reference)
            .putHeader("Authorization", "Bearer " + paystackSecretKey)
            .send()
            .compose(resp -> {
              JsonObject body = resp.bodyAsJsonObject();
              if (!Boolean.TRUE.equals(body.getBoolean("status")))
                return Future.failedFuture(
                    new IllegalStateException("Paystack verify failed: " + body.getString("message")));

              JsonObject data   = body.getJsonObject("data");
              String     status = data.getString("status");
              if (!"success".equals(status))
                return Future.failedFuture(
                    new IllegalStateException("Payment not successful: " + status));

              long amountKobo  = data.getLong("amount");
              long amountNgn   = amountKobo / 100L;
              long amountUnits = amountNgn * BillingRates.UNITS_PER_NGN;

              JsonObject auth        = data.getJsonObject("authorization");
              String     authCode    = auth.getString("authorization_code");
              String     cardChannel = auth.getString("channel", "card");
              String     last4       = auth.getString("last4");
              String     brand       = auth.getString("brand", "");
              String     displayName = brand + " ···· " + last4;

              return repository.getOrCreateWallet(u.institutionId())
                  .compose(wallet -> repository.credit(
                      u.institutionId(), wallet.id(), amountUnits,
                      "payment", "Top-up via Paystack · ref:" + reference, reference))
                  .compose(updatedWallet -> {
                    if (!saveCard || authCode == null) {
                      return Future.succeededFuture(new JsonObject()
                          .put("balanceNgn", updatedWallet.balanceNgn())
                          .put("cardSaved",  false));
                    }
                    String encryptedAuthCode = encrypt(authCode);
                    return repository.savePaymentMethod(
                        u.institutionId(), "paystack", encryptedAuthCode,
                        cardChannel, displayName, last4, false)
                        .map(pm -> new JsonObject()
                            .put("balanceNgn", updatedWallet.balanceNgn())
                            .put("cardSaved",  true)
                            .put("paymentMethod", new JsonObject()
                                .put("id",          pm.id())
                                .put("displayName", pm.displayName())
                                .put("last4",       pm.last4())
                                .put("type",        pm.type())));
                  });
            }));
  }

  // ── Paystack: direct card charge (inline card form) ──────────────────────

  public Future<JsonObject> chargeCardDirect(Session session, String cardNumber, String cvv,
      String expiryMonth, String expiryYear, long amountNgn, String email, boolean saveCard) {
    long amountKobo  = amountNgn * 100L;
    long amountUnits = amountNgn * BillingRates.UNITS_PER_NGN;

    return resolveUser(session).compose(u ->
        http.postAbs(PAYSTACK_API + "/charge")
            .putHeader("Authorization", "Bearer " + paystackSecretKey)
            .putHeader("Content-Type",  "application/json")
            .sendJsonObject(new JsonObject()
                .put("email",  email)
                .put("amount", amountKobo)
                .put("card", new JsonObject()
                    .put("number",       cardNumber.replaceAll("\\s+", ""))
                    .put("cvv",          cvv)
                    .put("expiry_month", expiryMonth)
                    .put("expiry_year",  expiryYear)))
            .compose(resp -> {
              JsonObject body = resp.bodyAsJsonObject();
              if (!Boolean.TRUE.equals(body.getBoolean("status")))
                return Future.failedFuture(
                    new IllegalStateException("Charge failed: " + body.getString("message")));
              return handleChargeStep(u, body.getJsonObject("data"), amountUnits, saveCard);
            }));
  }

  public Future<JsonObject> submitCardChallenge(Session session, String reference,
      String challengeType, String value, long amountNgn, String email, boolean saveCard) {
    long amountUnits = amountNgn * BillingRates.UNITS_PER_NGN;

    boolean isPin = "pin".equals(challengeType);
    String endpoint = isPin ? PAYSTACK_API + "/charge/submit_pin"
                             : PAYSTACK_API + "/charge/submit_otp";
    JsonObject reqBody = isPin
        ? new JsonObject().put("pin", value).put("reference", reference)
        : new JsonObject().put("otp", value).put("reference", reference);

    return resolveUser(session).compose(u ->
        http.postAbs(endpoint)
            .putHeader("Authorization", "Bearer " + paystackSecretKey)
            .putHeader("Content-Type",  "application/json")
            .sendJsonObject(reqBody)
            .compose(resp -> {
              JsonObject body = resp.bodyAsJsonObject();
              if (!Boolean.TRUE.equals(body.getBoolean("status")))
                return Future.failedFuture(
                    new IllegalStateException("Challenge failed: " + body.getString("message")));
              return handleChargeStep(u, body.getJsonObject("data"), amountUnits, saveCard);
            }));
  }

  private Future<JsonObject> handleChargeStep(com.openiv.backend.auth.model.User u,
      JsonObject data, long amountUnits, boolean saveCard) {
    String status    = data.getString("status");
    String reference = data.getString("reference");

    if (!"success".equals(status)) {
      return Future.succeededFuture(new JsonObject()
          .put("status",      status)
          .put("reference",   reference)
          .put("displayText", resolveDisplayText(status, data)));
    }

    JsonObject auth = data.getJsonObject("authorization");
    return repository.getOrCreateWallet(u.institutionId())
        .compose(wallet -> repository.credit(
            u.institutionId(), wallet.id(), amountUnits,
            "payment", "Top-up via card · ref:" + reference, reference))
        .compose(updatedWallet -> {
          if (!saveCard || auth == null || auth.getString("authorization_code") == null) {
            return Future.succeededFuture(new JsonObject()
                .put("status",     "success")
                .put("balanceNgn", updatedWallet.balanceNgn())
                .put("cardSaved",  false));
          }
          String authCode    = auth.getString("authorization_code");
          String cardChannel = auth.getString("channel", "card");
          String last4       = auth.getString("last4");
          String brand       = auth.getString("brand", "");
          String displayName = brand + " ···· " + last4;
          return repository.savePaymentMethod(
              u.institutionId(), "paystack", encrypt(authCode),
              cardChannel, displayName, last4, false)
              .map(pm -> new JsonObject()
                  .put("status",     "success")
                  .put("balanceNgn", updatedWallet.balanceNgn())
                  .put("cardSaved",  true)
                  .put("paymentMethod", new JsonObject()
                      .put("id",          pm.id())
                      .put("displayName", pm.displayName())
                      .put("last4",       pm.last4())
                      .put("type",        pm.type())));
        });
  }

  private static String resolveDisplayText(String status, JsonObject data) {
    return switch (status) {
      case "send_pin" -> "Enter your card PIN to authorise this transaction";
      case "send_otp" -> data.getString("display_text", "Enter the OTP sent to your registered number");
      case "open_url" -> data.getString("url", "");
      default         -> "";
    };
  }

  // ── Paystack: charge saved card ───────────────────────────────────────────

  public Future<JsonObject> topupWithSavedCard(Session session, long methodId,
      long amountNgn, String email) {
    long amountKobo  = amountNgn * 100L;
    long amountUnits = amountNgn * BillingRates.UNITS_PER_NGN;

    return resolveUser(session).compose(u ->
        repository.findPaymentMethod(u.institutionId(), methodId)
            .compose(opt -> {
              if (opt.isEmpty())
                return Future.failedFuture(
                    new IllegalArgumentException("Payment method not found"));

              String authCode = decrypt(opt.get().providerRef());

              return http.postAbs(PAYSTACK_API + "/transaction/charge_authorization")
                  .putHeader("Authorization", "Bearer " + paystackSecretKey)
                  .putHeader("Content-Type",  "application/json")
                  .sendJsonObject(new JsonObject()
                      .put("authorization_code", authCode)
                      .put("email",              email)
                      .put("amount",             amountKobo)
                      .put("currency",           "NGN"))
                  .compose(resp -> {
                    JsonObject body = resp.bodyAsJsonObject();
                    if (!Boolean.TRUE.equals(body.getBoolean("status")))
                      return Future.failedFuture(
                          new IllegalStateException("Charge failed: " + body.getString("message")));
                    JsonObject data = body.getJsonObject("data");
                    if (!"success".equals(data.getString("status")))
                      return Future.failedFuture(
                          new IllegalStateException("Charge not successful: " + data.getString("status")));

                    String ref = data.getString("reference");
                    return repository.getOrCreateWallet(u.institutionId())
                        .compose(wallet -> repository.credit(
                            u.institutionId(), wallet.id(), amountUnits,
                            "payment", "Top-up via saved card · ref:" + ref, ref))
                        .map(updatedWallet -> new JsonObject()
                            .put("balanceNgn", updatedWallet.balanceNgn())
                            .put("reference",  ref));
                  });
            }));
  }

  // ── PCI-DSS: AES-256-GCM encryption for stored authorization tokens ───────
  // Raw card data (PAN, CVV, expiry) is never received or stored.
  // Only Paystack authorization_code tokens are stored, encrypted at rest.
  // Format: base64url(nonce) + "." + base64url(ciphertext+auth_tag)

  private String encrypt(String plaintext) {
    try {
      byte[] nonce = new byte[GCM_NONCE_BYTES];
      new SecureRandom().nextBytes(nonce);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, encryptionKey, new GCMParameterSpec(GCM_TAG_BITS, nonce));
      byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
      Base64.Encoder enc = Base64.getUrlEncoder().withoutPadding();
      return enc.encodeToString(nonce) + "." + enc.encodeToString(ciphertext);
    } catch (Exception e) {
      throw new RuntimeException("Encryption failed", e);
    }
  }

  private String decrypt(String encrypted) {
    try {
      String[] parts     = encrypted.split("\\.", 2);
      Base64.Decoder dec = Base64.getUrlDecoder();
      byte[]  nonce      = dec.decode(parts[0]);
      byte[]  ciphertext = dec.decode(parts[1]);
      Cipher  cipher     = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, encryptionKey, new GCMParameterSpec(GCM_TAG_BITS, nonce));
      return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new RuntimeException("Decryption failed", e);
    }
  }

  private static SecretKeySpec loadKey(String base64Key) {
    String key = (base64Key == null || base64Key.isBlank()) ? DEV_FALLBACK_KEY : base64Key;
    if (base64Key == null || base64Key.isBlank()) {
      log.warn("BILLING_ENCRYPTION_KEY not set — using insecure dev fallback. Set the env var in production.");
    }
    byte[] keyBytes = Base64.getDecoder().decode(key);
    if (keyBytes.length != 32)
      throw new IllegalArgumentException(
          "BILLING_ENCRYPTION_KEY must decode to exactly 32 bytes (256-bit AES key)");
    return new SecretKeySpec(keyBytes, "AES");
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")));
  }

}
