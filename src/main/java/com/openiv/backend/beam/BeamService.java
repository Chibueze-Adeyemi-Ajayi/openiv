package com.openiv.backend.beam;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.transactions.Transaction;
import com.openiv.backend.transactions.TransactionImport;
import com.openiv.backend.transactions.TransactionProcessingOrchestrator;
import com.openiv.backend.transactions.TransactionService;
import com.openiv.backend.notifications.NotificationService;
import com.openiv.backend.webhooks.WebhookPayloadBuilder;
import com.openiv.backend.webhooks.WebhookService;
import com.openiv.backend.customers.CustomerService;
import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public final class BeamService {

  private static final Logger log = LoggerFactory.getLogger(BeamService.class);
  private static final Set<String> VALID_STREAMS = Set.of(
      "transactions", "logins", "activity", "location", "devices", "otps");

  private final BeamRepository      repository;
  private final UserRepository      users;
  private final OtpAnalyzer         otpAnalyzer;
  private final TransactionService  transactionService;
  private final WebhookService      webhookService;
  private final TransactionProcessingOrchestrator orchestrator;
  private final NotificationService notificationService;
  private final CustomerService customerService;

  public BeamService(BeamRepository repository, UserRepository users, OtpAnalyzer otpAnalyzer, TransactionService transactionService, WebhookService webhookService, CustomerService customerService) {
    this(repository, users, otpAnalyzer, transactionService, webhookService, null, null, customerService);
  }

  public BeamService(BeamRepository repository, UserRepository users, OtpAnalyzer otpAnalyzer,
      TransactionService transactionService, WebhookService webhookService,
      TransactionProcessingOrchestrator orchestrator, NotificationService notificationService,
      CustomerService customerService) {
    this.repository         = repository;
    this.users              = users;
    this.otpAnalyzer        = otpAnalyzer;
    this.transactionService = transactionService;
    this.webhookService     = webhookService;
    this.orchestrator       = orchestrator;
    this.notificationService = notificationService;
    this.customerService    = customerService;
  }

  public Future<BeamRecord> ingest(long institutionId, String stream,
      String idempotencyKey, String payload,
      String ip, String userAgent, String requestHeaders, int bytes, Integer durationMs) {
    if (!VALID_STREAMS.contains(stream))
      return Future.failedFuture(new IllegalArgumentException("Unknown stream: " + stream));
    Future<BeamRecord> saved;
    if (idempotencyKey != null) {
      saved = repository.findByIdempotencyKey(institutionId, idempotencyKey)
          .compose(opt -> opt.isPresent()
              ? Future.succeededFuture(opt.get())
              : repository.saveRecord(institutionId, stream, idempotencyKey, payload,
                  ip, userAgent, requestHeaders, bytes, durationMs));
    } else {
      saved = repository.saveRecord(institutionId, stream, null, payload,
          ip, userAgent, requestHeaders, bytes, durationMs);
    }
    return saved.map(record -> {
      if (customerService != null) {
        processCustomerUpsert(institutionId, payload);
      }
      if ("otps".equals(stream) && otpAnalyzer != null) {
        otpAnalyzer.analyze(institutionId, OtpPayload.parse(payload));
      }
      if ("transactions".equals(stream) && transactionService != null) {
        processTransactionStream(institutionId, record.idempotencyKey(), payload);
      }
      return record;
    });
  }

  private void processCustomerUpsert(long institutionId, String payload) {
    try {
      JsonObject obj = new JsonObject(payload);
      String customerId = obj.getString("customer_id", obj.getString("customerId", obj.getString("user_id", obj.getString("userId"))));
      String name = obj.getString("customer_name", obj.getString("customerName", obj.getString("user_name", obj.getString("userName"))));
      
      if (customerId != null && !customerId.isBlank()) {
        customerService.upsert(institutionId, customerId, name)
            .onFailure(err -> log.warn("Failed to upsert customer {} for institution {}: {}", customerId, institutionId, err.getMessage()));
      }
    } catch (Exception e) {
      // Best effort
    }
  }

  private void processTransactionStream(long institutionId, String idempotencyKey, String payload) {
    try {
      JsonObject obj = new JsonObject(payload);
      String id = idempotencyKey != null ? idempotencyKey : "beam-" + System.currentTimeMillis();

      // Support both snake_case (frontend samples) and camelCase
      String customerId    = obj.getString("customer_id", obj.getString("customerId", ""));
      String customerName  = obj.getString("customer_name", obj.getString("customerName", ""));
      Number amtNum        = obj.getNumber("amount", 0);
      BigDecimal amount    = new BigDecimal(amtNum.toString());
      String channel       = obj.getString("channel", "Unknown");
      String counterparty  = obj.getString("counterparty", "");
      int    riskScore     = obj.getInteger("risk_score", obj.getInteger("riskScore", 0));
      String status        = obj.getString("status", "pending");
      String flaggedStatus = obj.getString("flagged_status", obj.getString("flaggedStatus"));
      String location      = obj.getString("location");
      Double lat           = obj.getDouble("lat");
      Double lng           = obj.getDouble("lng");

      String rawTs = obj.getString("occurred_at", obj.getString("occurredAt"));
      final OffsetDateTime occurredAt = parseOccurredAt(rawTs);

      String senderAccount    = obj.getString("sender_account", obj.getString("senderAccount"));
      String senderBank       = obj.getString("sender_bank", obj.getString("senderBank"));
      String recipientName    = obj.getString("recipient_name", obj.getString("recipientName"));
      String recipientAccount = obj.getString("recipient_account", obj.getString("recipientAccount"));
      String recipientBank    = obj.getString("recipient_bank", obj.getString("recipientBank"));
      String currency         = obj.getString("currency", "NGN");
      String narration        = obj.getString("narration");
      String deviceId         = obj.getString("device_id", obj.getString("deviceId"));
      String ipAddress        = obj.getString("ip_address", obj.getString("ipAddress"));

      TransactionImport imp = new TransactionImport(id, customerId, customerName, amount,
          channel, counterparty, riskScore, status, flaggedStatus, location, lat, lng, occurredAt,
          senderAccount, senderBank, recipientName, recipientAccount, recipientBank,
          currency, narration, deviceId, ipAddress);

      transactionService.ingestFromBeam(institutionId, imp)
          .onSuccess(v -> {
            webhookService.broadcast(institutionId, "tx.received", WebhookPayloadBuilder.txReceived(obj));

            // Trigger hybrid fraud detection if orchestrator available
            if (orchestrator != null) {
              log.info("[Beam] Triggering hybrid fraud detection for txn {}", id);
              // Build Transaction from import data
              OffsetDateTime now = OffsetDateTime.now();
              Transaction txn = new Transaction(id, institutionId, customerId, customerName,
                  amount, channel, counterparty, riskScore, status, flaggedStatus,
                  location, lat, lng, occurredAt, now, now,
                  senderAccount, senderBank, recipientName, recipientAccount, recipientBank,
                  currency, narration, deviceId, ipAddress);

              // TODO: Query actual transaction counts from database
              orchestrator.processTransaction(institutionId, txn, 0, 0, 0, false)
                  .onSuccess(result -> {
                    log.info("[Beam] Fraud analysis complete: risk={} case={} ref={}",
                        result.riskScore(), result.caseId(), result.billingReference());
                  })
                  .onFailure(e -> log.error("[Beam] Fraud analysis failed for txn {}: {}",
                      id, e.getMessage()));
            }
          })
          .onFailure(err -> log.warn("Transaction ingest failed for institution {}: {}", institutionId, err.getMessage()));
    } catch (Exception e) {
      // Best effort ingestion; don't fail the beam if parsing fails
    }
  }

  public Future<String> generateApiKey(Session session) {
    return resolveUser(session).compose(u -> {
      byte[] bytes = new byte[32];
      new SecureRandom().nextBytes(bytes);
      String key = "oivsk_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
      String prefix = key.substring(0, 12);
      String hash = sha256Hex(key);
      return repository.saveApiKey(u.institutionId(), hash, prefix).map(k -> key);
    });
  }

  public Future<Boolean> revokeApiKey(Session session) {
    return resolveUser(session).compose(u -> repository.deleteApiKey(u.institutionId()));
  }

  public Future<Optional<BeamApiKey>> getApiKeyInfo(Session session) {
    return resolveUser(session).compose(u -> repository.findApiKeyInfo(u.institutionId()));
  }

  public Future<List<BeamRecord>> listRecords(Session session, String stream) {
    return resolveUser(session).compose(u ->
        repository.listRecords(u.institutionId(), stream, 100));
  }

  public Future<BeamRecordsResult> listRecords(Session session, String stream, String q, String range, int page, int pageSize) {
    return resolveUser(session).compose(u ->
        repository.listRecords(u.institutionId(), stream, q, range, page, pageSize));
  }

  public Future<Long> resolveInstitution(Session session) {
    return resolveUser(session).map(User::institutionId);
  }

  public Future<Long> resolveInstitution(String bearerKey) {
    String hash = sha256Hex(bearerKey);
    return repository.findInstitutionByKeyHash(hash)
        .compose(opt -> {
          if (opt.isEmpty())
            return Future.failedFuture(new IllegalArgumentException("invalid key"));
          long institutionId = opt.get();
          repository.touchKeyLastUsed(institutionId);
          return Future.succeededFuture(institutionId);
        });
  }

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")));
  }

  private static String sha256Hex(String input) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256")
          .digest(input.getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder(digest.length * 2);
      for (byte b : digest) sb.append(String.format("%02x", b));
      return sb.toString();
    } catch (Exception e) {
      throw new RuntimeException("SHA-256 failed", e);
    }
  }

  private static OffsetDateTime parseOccurredAt(String rawTs) {
    if (rawTs == null) return OffsetDateTime.now();
    try {
      return OffsetDateTime.parse(rawTs);
    } catch (Exception e) {
      return OffsetDateTime.now();
    }
  }
}
