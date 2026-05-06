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
  private final CustomerService     customerService;

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

  public record BeamIngestResult(BeamRecord record, JsonObject analysis) {}

  public Future<BeamIngestResult> ingest(long institutionId, String stream,
      String idempotencyKey, String payload,
      String ip, String userAgent, String requestHeaders, int bytes, Integer durationMs) {
    if (!VALID_STREAMS.contains(stream))
      return Future.failedFuture(new IllegalArgumentException("Unknown stream: " + stream));

    // Extract occurred_at from payload for all streams
    OffsetDateTime occurredAt = null;
    try {
      JsonObject obj = new JsonObject(payload);
      String rawTs = obj.getString("occurred_at", obj.getString("occurredAt"));
      if (rawTs != null && !rawTs.isBlank()) {
        occurredAt = parseOccurredAt(rawTs);
      }
    } catch (Exception e) {
      // Best effort
    }

    final OffsetDateTime finalOccurredAt = occurredAt;
    Future<BeamRecord> saved;
    if (idempotencyKey != null) {
      saved = repository.findByIdempotencyKey(institutionId, idempotencyKey)
          .compose(opt -> opt.isPresent()
              ? Future.succeededFuture(opt.get())
              : repository.saveRecord(institutionId, stream, idempotencyKey, payload,
                  ip, userAgent, requestHeaders, bytes, durationMs, finalOccurredAt));
    } else {
      saved = repository.saveRecord(institutionId, stream, null, payload,
          ip, userAgent, requestHeaders, bytes, durationMs, finalOccurredAt);
    }

    return saved.compose(record -> {
      if (customerService != null) {
        processCustomerUpsert(institutionId, payload);
      }
      if ("otps".equals(stream) && otpAnalyzer != null) {
        otpAnalyzer.analyze(institutionId, OtpPayload.parse(payload));
      }

      if ("transactions".equals(stream) && orchestrator != null) {
        // Timestamp anomaly gate — reject future-dated or stale transactions
        try {
          JsonObject obj  = new JsonObject(payload);
          String rawTs    = obj.getString("occurred_at", obj.getString("occurredAt"));
          if (rawTs != null && !rawTs.isBlank()) {
            OffsetDateTime txnTime = parseOccurredAt(rawTs);
            OffsetDateTime now     = OffsetDateTime.now();
            long diffSeconds = java.time.temporal.ChronoUnit.SECONDS.between(txnTime, now);

            if (diffSeconds < -300) {
              log.warn("Transaction timestamp is " + Math.abs(diffSeconds) + " seconds ahead of server time. Permitting but it will trigger timestamp anomaly.");
            }
            if (diffSeconds > 86_400) {
              log.warn("Transaction timestamp is " + (diffSeconds / 3600) + " hours old. Permitting but it will trigger timestamp anomaly.");
            }
          }
        } catch (IllegalArgumentException e) {
          return Future.failedFuture(e);
        } catch (Exception ignored) {
          // Malformed timestamp — let analysis handle it
        }

        return analyzeTransactionSynchronously(institutionId, record, payload)
            .map(analysis -> new BeamIngestResult(record, analysis));
      }

      return Future.succeededFuture(new BeamIngestResult(record, null));
    });
  }

  private Future<JsonObject> analyzeTransactionSynchronously(long institutionId, BeamRecord record, String payload) {
    try {
      JsonObject obj = new JsonObject(payload);

      // Use a stable string ID derived from the beam record so both the
      // transactions row and the orchestrator share the same reference.
      // This prevents the FK violation on case_transactions.transaction_id.
      String txnId = "beam-" + record.id();

      // 1. Persist to transactions table FIRST — case_transactions FK requires it.
      TransactionImport imp = buildTransactionImport(txnId, obj);
      Transaction txn = mapToTransactionWithId(institutionId, txnId, obj);

      return transactionService.ingestFromBeam(institutionId, imp)
          .compose(v -> orchestrator.processTransaction(institutionId, txn, 0, 0, 0, false))
          .compose(res -> {
            if (res.caseId() != null) {
              return transactionService.markFlagged(res.transactionId(), institutionId)
                  .map(v -> res);
            }
            return Future.succeededFuture(res);
          })
          .map(res -> new JsonObject()
              .put("transaction_id", res.transactionId())
              .put("risk_score", res.riskScore())
              .put("risk_level", res.riskScore() >= 75 ? "CRITICAL"
                  : res.riskScore() >= 60 ? "HIGH"
                  : res.riskScore() >= 30 ? "MEDIUM" : "LOW")
              .put("recommended_action", res.riskScore() >= 75 ? "DECLINE"
                  : res.riskScore() >= 60 ? "HOLD" : "ALLOW")
              .put("case_id", res.caseId())
              .put("priority", res.priority())
              .put("processed_at", OffsetDateTime.now().toString()))
          .recover(e -> {
            log.error("[Beam] Sync analysis failed for beam record {}", record.id(), e);
            return Future.succeededFuture(new JsonObject()
                .put("error", "Analysis failed: " + e.getMessage()));
          });
    } catch (Exception e) {
      log.error("[Beam] Sync analysis failed", e);
      return Future.succeededFuture(new JsonObject().put("error", "Analysis failed: " + e.getMessage()));
    }
  }

  /** Build a TransactionImport from the raw beam payload, using the given stable txnId. */
  private TransactionImport buildTransactionImport(String txnId, JsonObject obj) {
    String customerId    = obj.getString("customer_id", obj.getString("customerId", ""));
    String customerName  = obj.getString("customer_name", obj.getString("customerName", ""));
    Number amtNum        = obj.getNumber("amount", 0);
    String channel       = obj.getString("channel", "Unknown");
    String counterparty  = obj.getString("counterparty_account", obj.getString("counterparty", ""));
    String status        = obj.getString("status", "pending");
    String flaggedStatus = obj.getString("flagged_status", obj.getString("flaggedStatus"));
    String location      = obj.getString("location", "");
    Double lat           = obj.getDouble("lat");
    Double lng           = obj.getDouble("lng");
    OffsetDateTime occurredAt = parseOccurredAt(
        obj.getString("occurred_at", obj.getString("occurredAt")));
    String senderAccount    = obj.getString("sender_account", obj.getString("senderAccount"));
    String senderBank       = obj.getString("sender_bank", obj.getString("senderBank"));
    String recipientName    = obj.getString("recipient_name", obj.getString("recipientName"));
    String recipientAccount = obj.getString("recipient_account", obj.getString("recipientAccount"));
    String recipientBank    = obj.getString("recipient_bank", obj.getString("recipientBank"));
    String currency         = obj.getString("currency", "NGN");
    String narration        = obj.getString("narration");
    String deviceId         = obj.getString("device_id", obj.getString("deviceId"));
    String ipAddress        = obj.getString("ip_address", obj.getString("ipAddress"));

    return new TransactionImport(
        txnId, customerId, customerName,
        new java.math.BigDecimal(amtNum.toString()),
        channel, counterparty, 0, status, flaggedStatus, location, lat, lng, occurredAt,
        senderAccount, senderBank, recipientName, recipientAccount, recipientBank,
        currency, narration, deviceId, ipAddress);
  }

  /** Build a Transaction domain object using an explicit string ID. */
  private Transaction mapToTransactionWithId(long institutionId, String txnId, JsonObject obj) {
    String customerId = obj.getString("customer_id", obj.getString("customerId", ""));
    Number amtNum     = obj.getNumber("amount", 0);
    OffsetDateTime occurredAt = parseOccurredAt(
        obj.getString("occurred_at", obj.getString("occurredAt")));
    OffsetDateTime now = OffsetDateTime.now();
    return new Transaction(
        txnId, institutionId, customerId,
        obj.getString("customer_name", obj.getString("customerName", "")),
        new java.math.BigDecimal(amtNum.toString()),
        obj.getString("channel", "Unknown"),
        obj.getString("counterparty_account", obj.getString("counterparty", "")),
        0, obj.getString("status", "pending"), null,
        obj.getString("location", ""),
        obj.getDouble("lat"), obj.getDouble("lng"),
        occurredAt, now, now,
        obj.getString("sender_account", obj.getString("senderAccount", "")),
        obj.getString("sender_bank", obj.getString("senderBank", "")),
        obj.getString("recipient_name", obj.getString("recipientName", "")),
        obj.getString("recipient_account", obj.getString("recipientAccount", "")),
        obj.getString("recipient_bank", obj.getString("recipientBank", "")),
        obj.getString("currency", "NGN"),
        obj.getString("narration", ""),
        obj.getString("device_id", obj.getString("deviceId", "")),
        obj.getString("ip_address", obj.getString("ipAddress", "")));
  }

  private Transaction mapToTransaction(long institutionId, long id, JsonObject obj) {
    String customerId = obj.getString("customer_id", obj.getString("customerId", ""));
    Number amtNum = obj.getNumber("amount", 0);
    OffsetDateTime occurredAt = parseOccurredAt(obj.getString("occurred_at", obj.getString("occurredAt")));
    OffsetDateTime now = OffsetDateTime.now();

    return new Transaction(
        String.valueOf(id),
        institutionId,
        customerId,
        obj.getString("customer_name", obj.getString("customerName", "")),
        new BigDecimal(amtNum.toString()),
        obj.getString("channel", "Unknown"),
        obj.getString("counterparty_account", obj.getString("counterparty", "")),
        0, // riskScore
        obj.getString("status", "pending"),
        null, // flaggedStatus
        obj.getString("location", ""),
        obj.getDouble("lat"),
        obj.getDouble("lng"),
        occurredAt,
        now, // createdAt
        now, // updatedAt
        obj.getString("sender_account", obj.getString("senderAccount", "")),
        obj.getString("sender_bank", obj.getString("senderBank", "")),
        obj.getString("recipient_name", obj.getString("recipientName", "")),
        obj.getString("recipient_account", obj.getString("recipientAccount", "")),
        obj.getString("recipient_bank", obj.getString("recipientBank", "")),
        obj.getString("currency", "NGN"),
        obj.getString("narration", ""),
        obj.getString("device_id", obj.getString("deviceId", "")),
        obj.getString("ip_address", obj.getString("ipAddress", ""))
    );
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
      String status        = obj.getString("status", "pending");
      String flaggedStatus = obj.getString("flagged_status", obj.getString("flaggedStatus"));
      String location      = obj.getString("location");
      Double lat           = obj.getDouble("lat");
      Double lng           = obj.getDouble("lng");

      // Extract and validate occurred_at: this is when the transaction actually occurred (source of truth)
      String rawTs = obj.getString("occurred_at", obj.getString("occurredAt"));
      if (rawTs == null || rawTs.isBlank()) {
        log.error("[Beam] Missing required field 'occurred_at' in payload for txn {}", id);
        throw new IllegalArgumentException("Transaction timestamp (occurred_at) is required");
      }
      final OffsetDateTime occurredAt = parseOccurredAt(rawTs);

      // Timestamp anomaly detection: use occurred_at (user's time) as source of truth
      // This detects if the user's transaction time is in the future or unusually stale
      final OffsetDateTime now = OffsetDateTime.now();
      final long secondsDiff = java.time.temporal.ChronoUnit.SECONDS.between(occurredAt, now);
      boolean timestampAnomaly = false;
      String anomalyReason = "";

      if (secondsDiff < -15) {
        // Future timestamp: occurred_at is ahead of system time (device tamper)
        long futureSecsDiff = Math.abs(secondsDiff);
        timestampAnomaly = true;
        anomalyReason = String.format("future timestamp (%d seconds ahead)", futureSecsDiff);
      } else if (secondsDiff > 15) {
        // Stale timestamp: transaction is too old
        timestampAnomaly = true;
        anomalyReason = String.format("stale timestamp (%d seconds old)", secondsDiff);
      }

      int riskScore = obj.getInteger("risk_score", obj.getInteger("riskScore", 0));
      if (timestampAnomaly) {
        riskScore = 95; // Critical risk score triggers case auto-creation
        log.warn("[Beam] Timestamp anomaly detected for txn {}: {} - escalating to critical", id, anomalyReason);
      }
      final int finalRiskScore = riskScore;
      final boolean isTimestampAnomaly = timestampAnomaly;

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
          channel, counterparty, finalRiskScore, status, flaggedStatus, location, lat, lng, occurredAt,
          senderAccount, senderBank, recipientName, recipientAccount, recipientBank,
          currency, narration, deviceId, ipAddress);

      transactionService.ingestFromBeam(institutionId, imp)
          .onSuccess(v -> {
            webhookService.broadcast(institutionId, "tx.received", WebhookPayloadBuilder.txReceived(obj));

            // Send cyber breach notification if timestamp anomaly detected
            if (isTimestampAnomaly) {
              if (notificationService != null) {
                notificationService.notifyCyberBreachTimestampAnomaly(institutionId, id, Math.abs(secondsDiff))
                    .onFailure(e -> log.warn("[Beam] Failed to create cyber breach notification: {}", e.getMessage()));
              }
            }

            // Trigger hybrid fraud detection if orchestrator available
            if (orchestrator != null) {
              log.info("[Beam] Triggering hybrid fraud detection for txn {}", id);
              // Build Transaction from import data
              Transaction txn = new Transaction(id, institutionId, customerId, customerName,
                  amount, channel, counterparty, finalRiskScore, status, flaggedStatus,
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
