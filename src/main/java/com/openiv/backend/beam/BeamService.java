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

import io.vertx.core.json.JsonArray;

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
import java.util.function.Consumer;

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
  private final com.openiv.backend.cases.AutoCaseCreationService autoCaseService;

  public BeamService(BeamRepository repository, UserRepository users, OtpAnalyzer otpAnalyzer,
      TransactionService transactionService, WebhookService webhookService,
      CustomerService customerService, com.openiv.backend.aml.AmlSettingsRepository amlSettingsRepository) {
    this(repository, users, otpAnalyzer, transactionService, webhookService, null, null,
        customerService, amlSettingsRepository, null, null, null);
  }

  public BeamService(BeamRepository repository, UserRepository users, OtpAnalyzer otpAnalyzer,
      TransactionService transactionService, WebhookService webhookService,
      TransactionProcessingOrchestrator orchestrator, NotificationService notificationService,
      CustomerService customerService, com.openiv.backend.aml.AmlSettingsRepository amlSettingsRepository,
      BehavioralBeamAnalyzer behavioralBeamAnalyzer) {
    this(repository, users, otpAnalyzer, transactionService, webhookService, orchestrator,
        notificationService, customerService, amlSettingsRepository, behavioralBeamAnalyzer, null, null);
  }

  public BeamService(BeamRepository repository, UserRepository users, OtpAnalyzer otpAnalyzer,
      TransactionService transactionService, WebhookService webhookService,
      TransactionProcessingOrchestrator orchestrator, NotificationService notificationService,
      CustomerService customerService, com.openiv.backend.aml.AmlSettingsRepository amlSettingsRepository,
      BehavioralBeamAnalyzer behavioralBeamAnalyzer, KycService kycService) {
    this(repository, users, otpAnalyzer, transactionService, webhookService, orchestrator,
        notificationService, customerService, amlSettingsRepository, behavioralBeamAnalyzer, kycService, null);
  }

  public BeamService(BeamRepository repository, UserRepository users, OtpAnalyzer otpAnalyzer,
      TransactionService transactionService, WebhookService webhookService,
      TransactionProcessingOrchestrator orchestrator, NotificationService notificationService,
      CustomerService customerService, com.openiv.backend.aml.AmlSettingsRepository amlSettingsRepository,
      BehavioralBeamAnalyzer behavioralBeamAnalyzer, KycService kycService,
      com.openiv.backend.cases.AutoCaseCreationService autoCaseService) {
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
    this.autoCaseService         = autoCaseService;
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
            0L, institutionId, true, List.of(), 51, 81, 60, 85, 30, 30, 180, tz, 40, 75));

    return saved.compose(record -> {
      // Transaction beams must not create or update customer records —
      // the customer must already exist with a completed KYC record.
      if (customerService != null && !"transactions".equals(stream)) {
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
        return analyzeTransactionSynchronously(institutionId, record, payload, zone, amlSettings)
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
      String phone      = obj.getString("phone", obj.getString("phone_number"));
      String photo      = obj.getString("photo");

      if (customerId == null || customerId.isBlank()) {
        return Future.failedFuture(new IllegalArgumentException("Missing required field 'customer_id'"));
      }

      // 1. Store / update the customer KYC profile first
      return customerService.updateKycProfile(institutionId, customerId, name, bvn, nin, photo)
          .compose(customer -> {
            // 2. Run the Doja verification pipeline if kycService is wired
            if (kycService == null) {
              return Future.succeededFuture(new JsonObject()
                  .put("customer_id",    customerId)
                  .put("kyc_status",     "partial")
                  .put("bvn_received",   bvn   != null && !bvn.isBlank())
                  .put("nin_received",   nin   != null && !nin.isBlank())
                  .put("photo_received", photo != null && !photo.isBlank())
                  .put("processed_at",   OffsetDateTime.now().toString()));
            }

            return kycService.runPipeline(institutionId, customerId, bvn, nin, phone, photo, name)
                .map(result -> {
                  io.vertx.core.json.JsonArray stepsJson = new io.vertx.core.json.JsonArray();
                  result.steps().forEach(s -> stepsJson.add(new JsonObject()
                      .put("step",       s.step())
                      .put("status",     s.status())
                      .put("detail",     s.detail())
                      .put("durationMs", s.durationMs())));
                  return new JsonObject()
                      .put("customer_id",    customerId)
                      .put("kyc_status",     result.overallStatus())
                      .put("kyc_tier",       result.kycTier())
                      .put("risk_score",     result.overallRiskScore())
                      .put("bvn_received",   bvn   != null && !bvn.isBlank())
                      .put("nin_received",   nin   != null && !nin.isBlank())
                      .put("photo_received", photo != null && !photo.isBlank())
                      .put("pipeline_ms",    result.totalDurationMs())
                      .put("steps",          stepsJson)
                      .put("processed_at",   OffsetDateTime.now().toString());
                })
                .recover(pipelineErr -> {
                  log.error("[Beam/KYC] Pipeline failed for {}: {}", customerId, pipelineErr.getMessage());
                  return Future.succeededFuture(new JsonObject()
                      .put("customer_id",  customerId)
                      .put("kyc_status",   "partial")
                      .put("pipeline_error", pipelineErr.getMessage())
                      .put("processed_at", OffsetDateTime.now().toString()));
                });
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

  /**
   * SSE-aware KYC processing. Saves the beam record, runs the pipeline with a
   * per-step callback, stores the result, updates the customer risk score, and
   * takes action based on the institution's AML thresholds.
   */
  public Future<JsonObject> processKycStream(
      long institutionId, String payload,
      String ip, String userAgent, int bytes,
      Consumer<io.vertx.core.json.JsonObject> stepCallback) {

    if (kycService == null)
      return Future.failedFuture(new IllegalStateException("KYC service not configured"));

    try {
      JsonObject obj       = new JsonObject(payload);
      String customerId    = obj.getString("customer_id", obj.getString("customerId"));
      String name          = obj.getString("name");
      String bvn           = obj.getString("bvn");
      String nin           = obj.getString("nin");
      String phone         = obj.getString("phone", obj.getString("phone_number"));
      String photo         = obj.getString("photo");

      if (customerId == null || customerId.isBlank())
        return Future.failedFuture(new IllegalArgumentException("Missing required field 'customer_id'"));

      return amlSettingsRepository.getByInstitution(institutionId).compose(settingsOpt -> {
        AmlSettings settings = settingsOpt.orElse(
            new AmlSettings(0L, institutionId, true, List.of(), 51, 81, 60, 85, 30, 30, 180, "Africa/Lagos", 40, 75));

        return repository.saveRecord(institutionId, "kyc", null, payload,
                ip, userAgent, "{}", bytes, 0, null)
            .compose(record -> customerService.updateKycProfile(institutionId, customerId, name, bvn, nin, photo)
                .compose(ignored -> kycService.runPipelineWithCallback(
                    institutionId, customerId, bvn, nin, phone, photo, stepCallback, name))
                .compose(result -> {
                  int score = result.overallRiskScore();
                  String actionTaken;
                  String actionDetail;
                  if (score < settings.kycRiskNormalThreshold()) {
                    actionTaken  = "clear";
                    actionDetail = "Customer KYC cleared — risk score within normal range";
                  } else if (score < settings.kycRiskCaseThreshold()) {
                    actionTaken  = "flagged";
                    actionDetail = "Customer queued for analyst review — risk score elevated";
                  } else {
                    actionTaken  = "case_opened";
                    actionDetail = "Investigation case auto-opened — risk score exceeded threshold";
                  }

                  return customerService.updateRiskScore(institutionId, customerId, score)
                      .compose(v -> kycService.savePipelineResult(
                          institutionId, customerId, result, actionTaken))
                      .map(saved -> {
                        JsonArray stepsJson = new JsonArray();
                        result.steps().forEach(s -> stepsJson.add(new JsonObject()
                            .put("step",          s.step())
                            .put("status",        s.status())
                            .put("detail",        s.detail())
                            .put("durationMs",    s.durationMs())
                            .put("stepRiskScore", s.riskScore())));
                        return new JsonObject()
                            .put("customerId",       customerId)
                            .put("kycStatus",        result.overallStatus())
                            .put("kycTier",          result.kycTier())
                            .put("overallRiskScore", score)
                            .put("action",           actionTaken)
                            .put("actionDetail",     actionDetail)
                            .put("bvnReceived",      bvn   != null && !bvn.isBlank())
                            .put("ninReceived",      nin   != null && !nin.isBlank())
                            .put("photoReceived",    photo != null && !photo.isBlank())
                            .put("pipelineMs",       result.totalDurationMs())
                            .put("steps",            stepsJson)
                            .put("processedAt",      OffsetDateTime.now().toString());
                      });
                }));
      });
    } catch (Exception e) {
      log.error("[Beam/KYC/Stream] Payload parse error", e);
      return Future.failedFuture(new IllegalArgumentException("Invalid payload: " + e.getMessage()));
    }
  }

  private Future<JsonObject> analyzeTransactionSynchronously(long institutionId, BeamRecord record, String payload, ZoneId zone, AmlSettings settings) {
    try {
      JsonObject obj = new JsonObject(payload);

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
            "Invalid 'occurred_at' value '" + rawTs + "'. Expected ISO-8601 format."));
      }

      String txnId     = "beam-" + record.id();
      String customerId = obj.getString("customer_id", obj.getString("customerId", ""));

      TransactionImport imp = buildTransactionImport(txnId, obj, zone);
      Transaction       txn = mapToTransactionWithId(institutionId, txnId, obj, zone);

      java.time.LocalDate today     = occurredAt.toLocalDate();
      java.time.LocalDate yesterday = today.minusDays(1);

      // ── Step 1: parallel lookups — KYC record + sender account conflict ──
      String senderAccount = obj.getString("sender_account", obj.getString("senderAccount", ""));

      Future<Optional<com.openiv.backend.kyc.KycPipelineResult>> fKyc =
          (kycService != null && !customerId.isBlank())
              ? kycService.getCustomerKycByInstitution(institutionId, customerId)
              : Future.succeededFuture(Optional.empty());

      Future<Optional<String>> fConflict =
          (!senderAccount.isBlank() && !customerId.isBlank())
              ? transactionService.findCustomerBySenderAccount(institutionId, senderAccount, customerId)
              : Future.succeededFuture(Optional.empty());

      return Future.all(fKyc, fConflict).compose(combined -> {
        Optional<com.openiv.backend.kyc.KycPipelineResult> kycOpt    = combined.resultAt(0);
        Optional<String>                                   conflictOpt = combined.resultAt(1);
        boolean hasAccountConflict = conflictOpt.isPresent();

        // ── No KYC on file: flag and return kyc_required ─────────────────
        if (kycOpt.isEmpty()) {
          int noKycScore = hasAccountConflict ? 90 : 75;
          String noKycReason = hasAccountConflict
              ? "No KYC on file and sender account '" + senderAccount + "' is already linked to customer '"
                  + conflictOpt.get() + "'. Possible account sharing or fraudulent reuse."
              : "Customer identity verification is required before transactions can be processed. "
                  + "This transaction has been flagged and held pending KYC completion.";
          log.warn("[Beam/Txn] No KYC for customer={} inst={} conflict={} — flagging txn={} score={}",
              customerId, institutionId, hasAccountConflict, txnId, noKycScore);

          boolean shouldOpenCase = autoCaseService != null
              && settings.autoOpenCase()
              && noKycScore >= settings.riskScoreCaseThreshold();

          var noKycFlags = new java.util.ArrayList<String>();
          noKycFlags.add("KYC_REQUIRED");
          if (hasAccountConflict) noKycFlags.add("SENDER_ACCOUNT_CONFLICT");
          var noKycScoring = new com.openiv.backend.transactions.TransactionScorer.ScoringResult(
              noKycScore, noKycFlags, noKycReason);

          Future<String> fCase = shouldOpenCase
              ? autoCaseService.createCaseFromTransaction(institutionId, txn, noKycScoring)
                    .compose(cas -> {
                      if (notificationService != null) {
                        notificationService.notifyCaseCreated(institutionId, cas.id(),
                            cas.priority(), txn.customerName(),
                            txn.amount().toPlainString(),
                            txn.currency() != null ? txn.currency() : "NGN",
                            txn.channel()).onFailure(e ->
                            log.warn("[Beam/Txn] Case notify failed: {}", e.getMessage()));
                      }
                      return Future.succeededFuture(cas.id());
                    })
              : Future.succeededFuture(null);

          String noKycPanelReason = buildNoKycFlagReason(noKycScore, hasAccountConflict,
              senderAccount, conflictOpt.orElse(null));

          return transactionService.ingestFromBeam(institutionId, imp)
              .compose(v -> transactionService.markFlaggedWithReason(txnId, institutionId, noKycScore, noKycPanelReason))
              .compose(v -> notificationService != null
                  ? notificationService.notifyTransactionFlagged(institutionId, txnId, noKycReason, noKycScore)
                  : Future.<NotificationService.Notification>succeededFuture(null))
              .compose(notif -> fCase.map(caseId -> {
                var resp = new JsonObject()
                    .put("transaction_id",     txnId)
                    .put("kyc_required",       true)
                    .put("risk_score",         noKycScore)
                    .put("risk_level",         noKycScore >= 75 ? "CRITICAL" : "HIGH")
                    .put("recommended_action", "KYC_REQUIRED")
                    .put("account_conflict",   hasAccountConflict)
                    .put("message",            noKycReason)
                    .put("case_id",            caseId)
                    .put("processed_at",       OffsetDateTime.now(zone).toString());
                if (notif != null) resp.put("notification_id", notif.id());
                if (hasAccountConflict) resp.put("conflicting_customer_id", conflictOpt.get());
                return resp;
              }));
        }

        int kycRiskScore = kycOpt.get().overallRiskScore();

        // ── KYC exists: run orchestrator, blend KYC as major contributor (40%) ─
        return transactionService.ingestFromBeam(institutionId, imp)
            .compose(v -> {
              Future<Long>    fToday      = transactionService.getTodayCount(institutionId, today);
              Future<Long>    fYesterday  = transactionService.getYesterdayCount(institutionId, yesterday);
              Future<Long>    fCust24h    = transactionService.getCustomerTxnCount24h(institutionId, txn.customerId());
              Future<Boolean> fOtp        = otpAnalyzer != null
                  ? otpAnalyzer.hasRecentAlert(institutionId, txn.customerId(), 15)
                  : Future.succeededFuture(false);
              Future<Optional<Transaction>> fPrevLoc =
                  transactionService.getLastTransactionWithLocation(institutionId, txn.customerId(), txnId);
              return Future.all(fToday, fYesterday, fCust24h, fOtp, fPrevLoc);
            })
            .compose(results -> {
              long    todayCount    = results.resultAt(0);
              long    yestCount     = results.resultAt(1);
              long    cust24h       = results.resultAt(2);
              boolean hasOtpAlert   = results.resultAt(3);
              Optional<Transaction> prevLoc = results.resultAt(4);
              return orchestrator.processTransaction(institutionId, txn,
                  todayCount, yestCount, cust24h, hasOtpAlert, false, prevLoc);
            })
            .compose(res -> {
              String rejection = null;
              if (res.triggeredRules() != null) {
                if (res.triggeredRules().contains("MICRO_TIMING_ANOMALY"))
                  rejection = "This transaction's time matches the server clock too precisely, indicating a possible automated injection. Flagged for review. Case: " + res.caseId();
                else if (res.triggeredRules().contains("STALE_TIMESTAMP_ANOMALY"))
                  rejection = "Transaction date is more than 24 hours old — possible replay. Flagged and case opened. Case: " + res.caseId();
                else if (res.triggeredRules().contains("FUTURE_TIMESTAMP_ANOMALY"))
                  rejection = "Transaction is dated in the future — details may have been tampered with. Flagged and case opened. Case: " + res.caseId();
                else if (res.triggeredRules().contains("TXN_IMPOSSIBLE_TRAVEL"))
                  rejection = "Geo-velocity check failed: location physically unreachable in elapsed time. Case: " + res.caseId();
              }
              if (rejection != null) return Future.failedFuture(new IllegalArgumentException(rejection));

              // KYC risk is a major contributor: 60% transaction score + 40% customer KYC risk score.
              // A high-risk customer profile significantly boosts the blended transaction risk.
              int rawScore     = res.riskScore();
              int conflictBump = hasAccountConflict ? 20 : 0;
              int blendedScore = Math.min(100, (int)(rawScore * 0.60 + kycRiskScore * 0.40) + conflictBump);

              String blendedReason = buildBlendedFlagReason(
                  res.triggeredRules(), kycRiskScore, blendedScore, hasAccountConflict);
              Future<Void> fUpdate = (blendedScore != rawScore)
                  ? transactionService.markFlaggedWithReason(txnId, institutionId, blendedScore, blendedReason)
                  : Future.succeededFuture();

              Future<?> fConflictNotify = (hasAccountConflict && notificationService != null)
                  ? notificationService.notifyTransactionFlagged(institutionId, txnId,
                      "Sender account '" + senderAccount + "' is already linked to customer '"
                          + conflictOpt.get() + "'. Possible account sharing or fraudulent reuse.",
                      blendedScore)
                  : Future.succeededFuture(null);

              // Open a case immediately if the blended score now crosses the case threshold
              // and the orchestrator didn't already open one at the raw-score level.
              boolean needsCase = autoCaseService != null
                  && settings.autoOpenCase()
                  && blendedScore >= settings.riskScoreCaseThreshold()
                  && res.caseId() == null;

              var blendedFlags = new java.util.ArrayList<String>();
              if (res.triggeredRules() != null) blendedFlags.addAll(res.triggeredRules());
              if (hasAccountConflict) blendedFlags.add("SENDER_ACCOUNT_CONFLICT");
              var blendedScoring = new com.openiv.backend.transactions.TransactionScorer.ScoringResult(
                  blendedScore, blendedFlags,
                  "Blended score: " + blendedScore + " (txn=" + rawScore + " kyc=" + kycRiskScore + ")");

              Future<String> fNewCase = needsCase
                  ? autoCaseService.createCaseFromTransaction(institutionId, txn, blendedScoring)
                        .compose(cas -> {
                          if (notificationService != null) {
                            notificationService.notifyCaseCreated(institutionId, cas.id(),
                                cas.priority(), txn.customerName(),
                                txn.amount().toPlainString(),
                                txn.currency() != null ? txn.currency() : "NGN",
                                txn.channel()).onFailure(e ->
                                log.warn("[Beam/Txn] Case notify failed: {}", e.getMessage()));
                          }
                          return Future.succeededFuture(cas.id());
                        })
                  : Future.succeededFuture(res.caseId());

              return Future.all(fUpdate, fConflictNotify, fNewCase).map(all -> {
                String finalCaseId = all.resultAt(2);
                String finalPriority = finalCaseId != null && res.caseId() == null
                    ? com.openiv.backend.transactions.TransactionScorer.getPriority(blendedScore)
                    : res.priority();
                var resp = new JsonObject()
                    .put("transaction_id",      res.transactionId())
                    .put("risk_score",          blendedScore)
                    .put("kyc_risk_score",      kycRiskScore)
                    .put("risk_level",          blendedScore >= 75 ? "CRITICAL"
                        : blendedScore >= 60 ? "HIGH"
                        : blendedScore >= 30 ? "MEDIUM" : "LOW")
                    .put("recommended_action",  blendedScore >= settings.riskScoreCaseThreshold() ? "DECLINE"
                        : blendedScore >= settings.riskScoreFlagThreshold() ? "HOLD"
                        : res.recommendedAction())
                    .put("case_id",             finalCaseId)
                    .put("priority",            finalPriority)
                    .put("account_conflict",    hasAccountConflict)
                    .put("processed_at",        OffsetDateTime.now(zone).toString());
                if (hasAccountConflict) resp.put("conflicting_customer_id", conflictOpt.get());
                return resp;
              });
            })
            .recover(e -> {
              if (e instanceof IllegalArgumentException) return Future.failedFuture(e);
              log.error("[Beam] Sync analysis failed for beam record {}", record.id(), e);
              return Future.succeededFuture(new JsonObject().put("error", "Analysis failed: " + e.getMessage()));
            });
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
    String category         = obj.getString("category");
    String dirRaw           = obj.getString("direction", "outward");
    String direction        = "inward".equalsIgnoreCase(dirRaw) ? "inward" : "outward";

    return new TransactionImport(
        txnId, customerId, customerName,
        new BigDecimal(amtNum.toString()),
        channel, counterparty, 0, status, flaggedStatus, location, lat, lng, occurredAt,
        senderAccount, senderBank, recipientName, recipientAccount, recipientBank,
        currency, narration, deviceId, ipAddress, category, direction);
  }

  /** Build a Transaction domain object using an explicit string ID. */
  private Transaction mapToTransactionWithId(long institutionId, String txnId, JsonObject obj, ZoneId zone) {
    String customerId = obj.getString("customer_id", obj.getString("customerId", ""));
    Number amtNum     = obj.getNumber("amount", 0);
    OffsetDateTime occurredAt = parseOccurredAt(
        obj.getString("occurred_at", obj.getString("occurredAt")), zone);
    OffsetDateTime now = OffsetDateTime.now(zone);
    String dirRaw   = obj.getString("direction", "outward");
    String direction = "inward".equalsIgnoreCase(dirRaw) ? "inward" : "outward";
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
        false, null,
        obj.getString("category"), direction, java.util.List.of());
  }

  private static String buildNoKycFlagReason(int score, boolean hasConflict,
      String senderAccount, String conflictingCustomer) {
    if (hasConflict) {
      return "This transaction has been automatically placed on hold due to two serious concerns that "
          + "require immediate attention. First, the customer has not completed identity verification (KYC). "
          + "Under regulatory and anti-money laundering requirements, transactions from unverified customers "
          + "must be reviewed before they can be processed. Second — and more critically — the sender account "
          + "number on this transaction (" + senderAccount + ") is already linked to a different customer "
          + "profile (" + conflictingCustomer + ") in our system. This is a strong indicator of account "
          + "sharing, identity fraud, or account misuse. We recommend escalating this to your fraud and "
          + "compliance team immediately and verifying the identities of both customers before taking any action.";
    }
    return "This transaction has been automatically placed on hold. Our records show that the customer "
        + "associated with this transaction has not completed identity verification (KYC). Under regulatory "
        + "and anti-money laundering requirements, we are not permitted to process transactions from customers "
        + "whose identities have not been verified. The transaction has been flagged with a risk score of "
        + score + "/100 pending KYC completion. To release this hold, the customer must complete their "
        + "identity verification process with your institution. Please do not release these funds until "
        + "verification is complete.";
  }

  private static String buildBlendedFlagReason(java.util.List<String> triggeredRules,
      int kycRiskScore, int blendedScore, boolean hasConflict) {
    var sb = new StringBuilder();
    sb.append("This transaction has been automatically flagged by our fraud monitoring system. ");

    if (triggeredRules != null && !triggeredRules.isEmpty()) {
      sb.append("Our transaction monitoring detected the following: ");
      var rules = triggeredRules.stream()
          .map(r -> switch (r) {
            case "high-value-wire"        -> "an unusually large wire transfer";
            case "velocity-cluster"       -> "multiple rapid transactions from this account";
            case "late-night-large"       -> "a large late-night transfer";
            case "OTP_ALERT"              -> "recent failed authentication attempts on this account";
            case "VELOCITY_SPIKE"         -> "an institution-wide transaction volume spike";
            case "KYC_TIER_LIMIT_EXCEEDED"-> "the transaction amount exceeds this customer's KYC tier limit";
            case "cross-border-bdc"       -> "a high-value cross-border foreign exchange transfer";
            case "STALE_TIMESTAMP_ANOMALY"-> "a suspiciously old transaction timestamp";
            case "FUTURE_TIMESTAMP_ANOMALY"-> "a future-dated transaction timestamp";
            case "MICRO_TIMING_ANOMALY"   -> "a timestamp that is suspiciously precise";
            case "TXN_IMPOSSIBLE_TRAVEL"  -> "an impossible travel distance between transactions";
            case "TXN_SUSPICIOUS_TRAVEL"  -> "an unusually fast travel distance between transactions";
            default -> r.toLowerCase().replace("_", " ");
          })
          .distinct().toList();
      for (int i = 0; i < rules.size(); i++) {
        String rule = rules.get(i);
        if (i == 0) sb.append(Character.toUpperCase(rule.charAt(0))).append(rule.substring(1));
        else if (i == rules.size() - 1) sb.append("; and ").append(rule);
        else sb.append("; ").append(rule);
      }
      sb.append(". ");
    }

    if (kycRiskScore >= 70) {
      sb.append("The customer's identity verification profile also shows a high-risk score of ")
        .append(kycRiskScore).append("/100, which has significantly increased the overall risk assessment. ");
    } else if (kycRiskScore >= 40) {
      sb.append("The customer's identity verification profile shows a moderate risk score of ")
        .append(kycRiskScore).append("/100, which has been factored into the final risk assessment. ");
    } else {
      sb.append("The customer's identity verification profile has been factored into the overall risk score. ");
    }

    if (hasConflict) {
      sb.append("In addition, the sender account number on this transaction is already linked to a "
          + "different customer profile in our system — a strong indicator of account sharing or fraudulent "
          + "activity that should be investigated immediately. ");
    }

    if (blendedScore >= 75) {
      sb.append("The combined risk score of ").append(blendedScore)
        .append("/100 is in the critical range. This transaction should be placed on hold and an "
            + "investigation opened immediately. Do not release funds until the review is complete.");
    } else if (blendedScore >= 60) {
      sb.append("The combined risk score of ").append(blendedScore)
        .append("/100 is elevated. Review the transaction carefully and verify the details with "
            + "the customer before releasing any funds.");
    } else {
      sb.append("The combined risk score of ").append(blendedScore)
        .append("/100 warrants a review as part of your standard compliance process.");
    }

    return sb.toString();
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
