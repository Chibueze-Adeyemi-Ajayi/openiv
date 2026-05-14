package com.openiv.backend.beam;

import com.openiv.backend.aml.AmlSettings;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.kyc.KycService;
import com.openiv.backend.transactions.Transaction;
import com.openiv.backend.transactions.TransactionImport;
import com.openiv.backend.transactions.TransactionProcessingOrchestrator;
import com.openiv.backend.transactions.TransactionService;
import com.openiv.backend.notifications.NotificationService;
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
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public final class BeamService {

  private static final Logger log = LoggerFactory.getLogger(BeamService.class);
  private static final Set<String> VALID_STREAMS = Set.of(
      "transactions", "logins", "activity", "location", "devices", "otps", "kyc");

  private final BeamRepository      repository;
  private final UserRepository      users;
  private final OtpAnalyzer         otpAnalyzer;
  private final TransactionService  transactionService;
  private final WebhookService      webhookService;
  private final TransactionProcessingOrchestrator orchestrator;
  private final NotificationService notificationService;
  private final CustomerService     customerService;
  private final com.openiv.backend.aml.AmlSettingsRepository amlSettingsRepository;
  private final BehavioralBeamAnalyzer behavioralBeamAnalyzer;
  private final KycService kycService;

  public BeamService(BeamRepository repository, UserRepository users, OtpAnalyzer otpAnalyzer,
      TransactionService transactionService, WebhookService webhookService,
      CustomerService customerService, com.openiv.backend.aml.AmlSettingsRepository amlSettingsRepository) {
    this(repository, users, otpAnalyzer, transactionService, webhookService, null, null,
        customerService, amlSettingsRepository, null, null);
  }

  public BeamService(BeamRepository repository, UserRepository users, OtpAnalyzer otpAnalyzer,
      TransactionService transactionService, WebhookService webhookService,
      TransactionProcessingOrchestrator orchestrator, NotificationService notificationService,
      CustomerService customerService, com.openiv.backend.aml.AmlSettingsRepository amlSettingsRepository,
      BehavioralBeamAnalyzer behavioralBeamAnalyzer) {
    this(repository, users, otpAnalyzer, transactionService, webhookService, orchestrator,
        notificationService, customerService, amlSettingsRepository, behavioralBeamAnalyzer, null);
  }

  public BeamService(BeamRepository repository, UserRepository users, OtpAnalyzer otpAnalyzer,
      TransactionService transactionService, WebhookService webhookService,
      TransactionProcessingOrchestrator orchestrator, NotificationService notificationService,
      CustomerService customerService, com.openiv.backend.aml.AmlSettingsRepository amlSettingsRepository,
      BehavioralBeamAnalyzer behavioralBeamAnalyzer, KycService kycService) {
    this.repository              = repository;
    this.users                   = users;
    this.otpAnalyzer             = otpAnalyzer;
    this.transactionService      = transactionService;
    this.webhookService          = webhookService;
    this.orchestrator            = orchestrator;
    this.notificationService     = notificationService;
    this.customerService         = customerService;
    this.amlSettingsRepository   = amlSettingsRepository;
    this.behavioralBeamAnalyzer  = behavioralBeamAnalyzer;
    this.kycService              = kycService;
  }

  public record BeamIngestResult(BeamRecord record, JsonObject analysis) {}

  public Future<BeamIngestResult> ingest(long institutionId, String stream,
      String idempotencyKey, String payload,
      String ip, String userAgent, String requestHeaders, int bytes, Integer durationMs) {
    if (!VALID_STREAMS.contains(stream))
      return Future.failedFuture(new IllegalArgumentException("Unknown stream: " + stream));

    return amlSettingsRepository.getByInstitution(institutionId).compose(settingsOpt -> {
      String tz = settingsOpt.map(com.openiv.backend.aml.AmlSettings::timezone).orElse("Africa/Lagos");
      ZoneId zone = ZoneId.of(tz);

    // Extract occurred_at from payload for all streams
    OffsetDateTime occurredAt = null;
    try {
      JsonObject obj = new JsonObject(payload);
      String rawTs = obj.getString("occurred_at", obj.getString("occurredAt"));
      if (rawTs != null && !rawTs.isBlank()) {
        occurredAt = parseOccurredAt(rawTs, zone);
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

    // Resolve AmlSettings with safe defaults so behavioral analysis always has a config object.
    final com.openiv.backend.aml.AmlSettings amlSettings = settingsOpt.orElse(
        new com.openiv.backend.aml.AmlSettings(
            0L, institutionId, true, List.of(), 51, 81, 60, 85, 30, 30, 180, tz));

    return saved.compose(record -> {
      if (customerService != null) {
        processCustomerUpsert(institutionId, payload);
      }

      if ("otps".equals(stream)) {
        if (otpAnalyzer != null) {
          otpAnalyzer.analyze(institutionId, OtpPayload.parse(payload));
        }
        // Timestamp anomaly for OTP events (micro-timing, stale, future)
        if (behavioralBeamAnalyzer != null && finalOccurredAt != null) {
          behavioralBeamAnalyzer.analyzeOtpTimestamp(
              institutionId, OtpPayload.parse(payload), finalOccurredAt, zone, amlSettings);
        }
      }

      if ("logins".equals(stream)) {
        return analyzeLoginSynchronously(institutionId, record, payload, zone, amlSettings)
            .map(analysis -> new BeamIngestResult(record, analysis));
      }

      if ("activity".equals(stream)) {
        return analyzeActivitySynchronously(institutionId, record, payload, zone, amlSettings)
            .map(analysis -> new BeamIngestResult(record, analysis));
      }

      if ("location".equals(stream) && behavioralBeamAnalyzer != null) {
        behavioralBeamAnalyzer.analyzeLocation(
            institutionId, LocationPayload.parse(payload), finalOccurredAt, zone, amlSettings);
      }

      if ("devices".equals(stream) && behavioralBeamAnalyzer != null) {
        behavioralBeamAnalyzer.analyzeDevice(
            institutionId, DevicePayload.parse(payload), finalOccurredAt, zone, amlSettings);
      }

      if ("transactions".equals(stream) && orchestrator != null) {
        return analyzeTransactionSynchronously(institutionId, record, payload, zone)
            .map(analysis -> new BeamIngestResult(record, analysis));
      }

      if ("kyc".equals(stream)) {
        return processKycSynchronously(institutionId, record, payload)
            .map(analysis -> new BeamIngestResult(record, analysis));
      }

      return Future.succeededFuture(new BeamIngestResult(record, null));
    });
  });
}

  private Future<JsonObject> processKycSynchronously(long institutionId, BeamRecord record, String payload) {
    try {
      JsonObject obj = new JsonObject(payload);
      String customerId = obj.getString("customer_id", obj.getString("customerId"));
      String name       = obj.getString("name");
      String bvn        = obj.getString("bvn");
      String nin        = obj.getString("nin");
      String photo      = obj.getString("photo");

      if (customerId == null || customerId.isBlank()) {
        return Future.failedFuture(new IllegalArgumentException("Missing required field 'customer_id'"));
      }

      return customerService.updateKycProfile(institutionId, customerId, name, bvn, nin, photo)
          .map(customer -> {
            boolean hasKyc = (customer.bvn() != null && !customer.bvn().isBlank())
                || (customer.nin() != null && !customer.nin().isBlank());
            return new JsonObject()
                .put("customer_id",    customerId)
                .put("kyc_status",     hasKyc ? "verified" : "partial")
                .put("bvn_received",   bvn != null && !bvn.isBlank())
                .put("nin_received",   nin != null && !nin.isBlank())
                .put("photo_received", photo != null && !photo.isBlank())
                .put("processed_at",   OffsetDateTime.now().toString());
          })
          .recover(e -> {
            log.error("[Beam/KYC] Failed to process KYC for customer {}: {}", customerId, e.getMessage());
            return Future.succeededFuture(new JsonObject()
                .put("error", "KYC processing failed: " + e.getMessage()));
          });
    } catch (Exception e) {
      log.error("[Beam/KYC] Payload parse error", e);
      return Future.succeededFuture(new JsonObject().put("error", "Invalid payload: " + e.getMessage()));
    }
  }

  private Future<JsonObject> analyzeTransactionSynchronously(long institutionId, BeamRecord record, String payload, ZoneId zone) {
    try {
      JsonObject obj = new JsonObject(payload);

      // Validate occurred_at before doing anything else — it is required and must be
      // a parseable ISO-8601 timestamp.
      String rawTs = obj.getString("occurred_at", obj.getString("occurredAt"));
      if (rawTs == null || rawTs.isBlank()) {
        return Future.failedFuture(new IllegalArgumentException(
            "Missing required field 'occurred_at'. Provide the transaction timestamp in ISO-8601 format."));
      }
      OffsetDateTime occurredAt;
      try {
        occurredAt = parseOccurredAtOrThrow(rawTs, zone);
      } catch (Exception e) {
        return Future.failedFuture(new IllegalArgumentException(
            "Invalid 'occurred_at' value '" + rawTs + "'. Expected ISO-8601 format (e.g. 2026-05-08T14:30:00Z or 2026-05-08T14:30:00)."));
      }

      // Use a stable string ID derived from the beam record so both the
      // transactions row and the orchestrator share the same reference.
      String txnId = "beam-" + record.id();

      // 1. Persist to transactions table FIRST — case_transactions FK requires it.
      TransactionImport imp = buildTransactionImport(txnId, obj, zone);
      Transaction txn = mapToTransactionWithId(institutionId, txnId, obj, zone);

      java.time.LocalDate today = occurredAt.toLocalDate();
      java.time.LocalDate yesterday = today.minusDays(1);

      return transactionService.ingestFromBeam(institutionId, imp)
          .compose(v -> {
            // Fetch real-time context for scoring (all in parallel)
            Future<Long> fToday = transactionService.getTodayCount(institutionId, today);
            Future<Long> fYesterday = transactionService.getYesterdayCount(institutionId, yesterday);
            Future<Long> fCustomer24h = transactionService.getCustomerTxnCount24h(institutionId, txn.customerId());
            Future<Boolean> fOtp = otpAnalyzer != null
                ? otpAnalyzer.hasRecentAlert(institutionId, txn.customerId(), 15)
                : Future.succeededFuture(false);
            // Geo-velocity: previous transaction with coordinates for this customer
            Future<java.util.Optional<com.openiv.backend.transactions.Transaction>> fPrevLocation =
                transactionService.getLastTransactionWithLocation(institutionId, txn.customerId(), txnId);

            return Future.all(fToday, fYesterday, fCustomer24h, fOtp, fPrevLocation);
          })
          .compose(results -> {
            long todayCount    = results.resultAt(0);
            long yesterdayCount = results.resultAt(1);
            long customer24h   = results.resultAt(2);
            boolean hasOtpAlert = results.resultAt(3);
            java.util.Optional<com.openiv.backend.transactions.Transaction> prevLocation = results.resultAt(4);

            // Pass skipKyc=true to rely on institutional thresholds only
            return orchestrator.processTransaction(institutionId, txn, todayCount, yesterdayCount,
                customer24h, hasOtpAlert, true, prevLocation);
          })
          .compose(res -> {
            // Critical security gate: reject the beam request with 400 when a timing
            // anomaly is detected. The transaction has already been persisted and a case
            // opened — flag the transaction, then surface the error to the API consumer.
            String rejectionMessage = null;
            if (res.triggeredRules() != null) {
              if (res.triggeredRules().contains("MICRO_TIMING_ANOMALY")) {
                rejectionMessage = "This transaction's time matches the server clock too precisely, " +
                    "which may indicate an automated injection attempt. It has been flagged for review. " +
                    "Case reference: " + res.caseId();
              } else if (res.triggeredRules().contains("STALE_TIMESTAMP_ANOMALY")) {
                rejectionMessage = "This transaction carries a date that is more than 24 hours in the past. " +
                    "This could mean the transaction was replayed (submitted again after already being processed). " +
                    "It has been flagged and a case has been opened for review. Case reference: " + res.caseId();
              } else if (res.triggeredRules().contains("FUTURE_TIMESTAMP_ANOMALY")) {
                rejectionMessage = "This transaction carries a date that is set ahead of the current time, " +
                    "which is not possible for a legitimate transaction. This may indicate the transaction " +
                    "details were altered. It has been flagged and a case has been opened for review. " +
                    "Case reference: " + res.caseId();
              } else if (res.triggeredRules().contains("TXN_IMPOSSIBLE_TRAVEL")) {
                rejectionMessage = "Geo-velocity check failed: the transaction origin is physically " +
                    "unreachable from the customer's previous transaction location within the elapsed time — " +
                    "no commercial aircraft can travel that fast. The transaction has been flagged and a " +
                    "case has been opened for review. Case reference: " + res.caseId();
              }
            }
            if (rejectionMessage != null) {
              return Future.failedFuture(new IllegalArgumentException(rejectionMessage));
            }
            return Future.succeededFuture(res);
          })
          .map(res -> new JsonObject()
              .put("transaction_id", res.transactionId())
              .put("risk_score", res.riskScore())
              .put("risk_level", res.riskScore() >= 75 ? "CRITICAL"
                  : res.riskScore() >= 60 ? "HIGH"
                  : res.riskScore() >= 30 ? "MEDIUM" : "LOW")
              .put("recommended_action", res.recommendedAction())
              .put("case_id", res.caseId())
              .put("priority", res.priority())
              .put("processed_at", OffsetDateTime.now(zone).toString()))
          .recover(e -> {
            // Re-throw IllegalArgumentException so the handler can return 400.
            // Only swallow generic/unexpected errors here.
            if (e instanceof IllegalArgumentException) {
              return Future.failedFuture(e);
            }
            log.error("[Beam] Sync analysis failed for beam record {}", record.id(), e);
            return Future.succeededFuture(new JsonObject()
                .put("error", "Analysis failed: " + e.getMessage()));
          });
    } catch (Exception e) {
      log.error("[Beam] Sync analysis failed", e);
      return Future.succeededFuture(new JsonObject().put("error", "Analysis failed: " + e.getMessage()));
    }
  }

  private Future<JsonObject> analyzeActivitySynchronously(long institutionId, BeamRecord record,
      String payload, ZoneId zone, AmlSettings amlSettings) {
    try {
      JsonObject obj = new JsonObject(payload);

      String rawTs = obj.getString("occurred_at", obj.getString("occurredAt"));
      if (rawTs == null || rawTs.isBlank()) {
        return Future.failedFuture(new IllegalArgumentException(
            "Missing required field 'occurred_at'. Provide the activity event timestamp in ISO-8601 format."));
      }
      OffsetDateTime occurredAt;
      try {
        occurredAt = parseOccurredAtOrThrow(rawTs, zone);
      } catch (Exception e) {
        return Future.failedFuture(new IllegalArgumentException(
            "Invalid 'occurred_at' value '" + rawTs + "'. Expected ISO-8601 format (e.g. 2026-05-11T14:30:00+01:00)."));
      }

      OffsetDateTime now = OffsetDateTime.now(zone);
      long signedDiff   = java.time.temporal.ChronoUnit.SECONDS.between(occurredAt, now);
      long secondsDiff  = Math.abs(signedDiff);
      int  beamWindow   = amlSettings.beamWindowSeconds();

      String anomalyKind    = null;
      String rejectionMsg   = null;

      if (secondsDiff <= 5) {
        anomalyKind  = "MICRO_TIMING_ANOMALY";
        rejectionMsg = "This activity event's timestamp matches the server clock within 5 seconds — " +
            "a strong indicator of an automated injection. The event has been flagged for security review.";
      } else if (signedDiff < -beamWindow) {
        anomalyKind  = "FUTURE_TIMESTAMP_ANOMALY";
        long minsAhead = Math.max(1, secondsDiff / 60);
        rejectionMsg = "This activity event carries a timestamp " + minsAhead + " minute(s) ahead of " +
            "server time. A legitimate event cannot occur in the future — this may indicate clock " +
            "tampering. The event has been flagged for review.";
      } else if (signedDiff > beamWindow) {
        String ageDesc = signedDiff >= 3600
            ? (signedDiff / 3600) + " hour(s)" : (signedDiff / 60) + " minute(s)";
        anomalyKind  = "STALE_TIMESTAMP_ANOMALY";
        rejectionMsg = "This activity event timestamp is " + ageDesc + " old. This may indicate a " +
            "replay attack or backdated injection. The event has been flagged for review.";
      }

      // Always run behavioral analysis (time-of-day, burst, session, timestamp rules) async.
      if (behavioralBeamAnalyzer != null) {
        behavioralBeamAnalyzer.analyzeActivity(
            institutionId, ActivityPayload.parse(payload), occurredAt, zone, amlSettings);
      }

      if (anomalyKind != null) {
        log.warn("[Beam/Activity] {} on record={} inst={}", anomalyKind, record.id(), institutionId);
        return Future.failedFuture(new IllegalArgumentException(rejectionMsg));
      }

      return Future.succeededFuture(new JsonObject()
          .put("event_id",        "beam-" + record.id())
          .put("processed_at",    now.toString())
          .put("timestamp_valid", true));

    } catch (Exception e) {
      log.error("[Beam/Activity] Sync analysis failed for record={}", record.id(), e);
      return Future.succeededFuture(new JsonObject().put("error", "Analysis failed: " + e.getMessage()));
    }
  }

  private Future<JsonObject> analyzeLoginSynchronously(long institutionId, BeamRecord record,
      String payload, ZoneId zone, AmlSettings amlSettings) {
    try {
      JsonObject obj = new JsonObject(payload);

      String rawTs = obj.getString("occurred_at", obj.getString("occurredAt"));
      if (rawTs == null || rawTs.isBlank()) {
        return Future.failedFuture(new IllegalArgumentException(
            "Missing required field 'occurred_at'. Provide the login event timestamp in ISO-8601 format."));
      }
      OffsetDateTime occurredAt;
      try {
        occurredAt = parseOccurredAtOrThrow(rawTs, zone);
      } catch (Exception e) {
        return Future.failedFuture(new IllegalArgumentException(
            "Invalid 'occurred_at' value '" + rawTs + "'. Expected ISO-8601 format (e.g. 2026-05-11T14:30:00+01:00)."));
      }

      OffsetDateTime now = OffsetDateTime.now(zone);
      long signedDiff  = java.time.temporal.ChronoUnit.SECONDS.between(occurredAt, now);
      long secondsDiff = Math.abs(signedDiff);
      int  beamWindow  = amlSettings.beamWindowSeconds();

      String anomalyKind  = null;
      String rejectionMsg = null;

      if (secondsDiff <= 5) {
        anomalyKind  = "MICRO_TIMING_ANOMALY";
        rejectionMsg = "This login event's timestamp matches the server clock within 5 seconds — " +
            "a strong indicator of an automated injection. The event has been flagged for security review.";
      } else if (signedDiff < -beamWindow) {
        anomalyKind  = "FUTURE_TIMESTAMP_ANOMALY";
        long minsAhead = Math.max(1, secondsDiff / 60);
        rejectionMsg = "This login event carries a timestamp " + minsAhead + " minute(s) ahead of " +
            "server time. A legitimate login cannot occur in the future — this may indicate clock " +
            "tampering. The event has been flagged for review.";
      } else if (signedDiff > beamWindow) {
        String ageDesc = signedDiff >= 3600
            ? (signedDiff / 3600) + " hour(s)" : (signedDiff / 60) + " minute(s)";
        anomalyKind  = "STALE_TIMESTAMP_ANOMALY";
        rejectionMsg = "This login event timestamp is " + ageDesc + " old. This may indicate a " +
            "replay attack or session injection. The event has been flagged for review.";
      }

      if (behavioralBeamAnalyzer != null) {
        behavioralBeamAnalyzer.analyzeLogin(
            institutionId, LoginPayload.parse(payload), occurredAt, zone, amlSettings);
      }

      if (anomalyKind != null) {
        log.warn("[Beam/Login] {} on record={} inst={}", anomalyKind, record.id(), institutionId);
        return Future.failedFuture(new IllegalArgumentException(rejectionMsg));
      }

      return Future.succeededFuture(new JsonObject()
          .put("event_id",        "beam-" + record.id())
          .put("processed_at",    now.toString())
          .put("timestamp_valid", true));

    } catch (Exception e) {
      log.error("[Beam/Login] Sync analysis failed for record={}", record.id(), e);
      return Future.succeededFuture(new JsonObject().put("error", "Analysis failed: " + e.getMessage()));
    }
  }

  /** Build a TransactionImport from the raw beam payload, using the given stable txnId. */
  private TransactionImport buildTransactionImport(String txnId, JsonObject obj, ZoneId zone) {
    String customerId    = obj.getString("customer_id", obj.getString("customerId", ""));
    String customerName  = obj.getString("customer_name", obj.getString("customerName", ""));
    Number amtNum        = obj.getNumber("amount", 0);
    String channel       = obj.getString("channel", "Unknown");
    String counterparty  = obj.getString("counterparty_account", obj.getString("counterparty", ""));
    String status        = sanitizeStatus(obj.getString("status"));
    String flaggedStatus = obj.getString("flagged_status", obj.getString("flaggedStatus"));
    String location      = obj.getString("location", "");
    Double lat           = obj.getDouble("lat");
    Double lng           = obj.getDouble("lng");
    OffsetDateTime occurredAt = parseOccurredAt(
        obj.getString("occurred_at", obj.getString("occurredAt")), zone);
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
        new BigDecimal(amtNum.toString()),
        channel, counterparty, 0, status, flaggedStatus, location, lat, lng, occurredAt,
        senderAccount, senderBank, recipientName, recipientAccount, recipientBank,
        currency, narration, deviceId, ipAddress);
  }

  /** Build a Transaction domain object using an explicit string ID. */
  private Transaction mapToTransactionWithId(long institutionId, String txnId, JsonObject obj, ZoneId zone) {
    String customerId = obj.getString("customer_id", obj.getString("customerId", ""));
    Number amtNum     = obj.getNumber("amount", 0);
    OffsetDateTime occurredAt = parseOccurredAt(
        obj.getString("occurred_at", obj.getString("occurredAt")), zone);
    OffsetDateTime now = OffsetDateTime.now(zone);
    return new Transaction(
        txnId, institutionId, customerId,
        obj.getString("customer_name", obj.getString("customerName", "")),
        new BigDecimal(amtNum.toString()),
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
        obj.getString("ip_address", obj.getString("ipAddress", "")),
        false);
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

  /**
   * Maps any payment status value to the three valid values enforced by transactions_status_check.
   * Pre-V14 payloads may send 'flagged'/'blocked'/'review'/'cleared' which were the old combined column.
   */
  private static String sanitizeStatus(String raw) {
    if (raw == null) return "pending";
    return switch (raw.toLowerCase()) {
      case "successful", "success", "completed", "cleared" -> "successful";
      case "failed",     "blocked",  "declined",  "rejected" -> "failed";
      default -> "pending";
    };
  }

  /**
   * Parses occurred_at with support for multiple formats:
   * 1. ISO-8601 with offset (e.g. 2026-05-09T21:43:00Z, 2026-05-09T21:43:00+01:00)
   * 2. ISO-8601 local (e.g. 2026-05-09T21:43:00) — assumes institution timezone
   * 3. Variants with spaces (e.g. 2026-05-09 21:43:00)
   * 4. Numeric timestamps (milliseconds)
   */
  private static OffsetDateTime parseOccurredAt(String rawTs, ZoneId zone) {
    try {
      return parseOccurredAtOrThrow(rawTs, zone);
    } catch (Exception e) {
      log.warn("[Beam] occurred_at '{}' could not be parsed — falling back to now().", rawTs);
      return OffsetDateTime.now(zone);
    }
  }

  private static OffsetDateTime parseOccurredAtOrThrow(String rawTs, ZoneId zone) {
    if (rawTs == null || rawTs.isBlank()) {
      throw new IllegalArgumentException("Timestamp is null or blank");
    }

    // 1. Try numeric (milliseconds)
    try {
      if (rawTs.length() >= 10 && rawTs.chars().allMatch(Character::isDigit)) {
        long ms = Long.parseLong(rawTs);
        return OffsetDateTime.ofInstant(Instant.ofEpochMilli(ms), zone);
      }
    } catch (NumberFormatException ignored) {}

    // Normalize: replace space with T if present
    String normalized = rawTs.trim().replace(' ', 'T');

    // 2. Try OffsetDateTime (explicit offset)
    try {
      return OffsetDateTime.parse(normalized);
    } catch (Exception ignored) {}

    // 3. Try LocalDateTime (assume institution zone)
    try {
      LocalDateTime ldt = LocalDateTime.parse(normalized);
      return ldt.atZone(zone).toOffsetDateTime();
    } catch (Exception ignored) {}

    throw new IllegalArgumentException("Unsupported timestamp format: " + rawTs);
  }
}
