package com.openiv.backend.doja;

import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * Runs the 7-step KYC verification pipeline using DojaClient and Dojah AML screening.
 *
 * <p>Step order:
 * <ol>
 *   <li>{@code bvn_nin} — identity lookup (BVN preferred, NIN fallback).</li>
 *   <li>{@code phone_record_basic} — basic lookup on the phone returned by
 *       BVN/NIN, name-match against identity + beamed name.</li>
 *   <li>{@code phone_record_fraud} — fraud screening on the BVN/NIN-registered
 *       phone (risk_score, leaked, spammer, recent_abuse).</li>
 *   <li>{@code phone_beam_basic} — runs only when the beamed phone differs from
 *       the BVN/NIN-registered phone (so the active number gets the same
 *       owner-name check).</li>
 *   <li>{@code phone_beam_fraud} — fraud screening on the beamed phone, only
 *       when it differs from the BVN/NIN-registered phone.</li>
 *   <li>{@code liveness} — selfie match against the BVN/NIN photo.</li>
 *   <li>{@code pep_check} — AML/PEP/sanctions screening on the resolved name.</li>
 * </ol>
 *
 * <p>Each step ALWAYS produces a {@link PipelineStepResult}. Steps that could
 * not make a Dojah call (missing input, identity unresolved, same phone) emit
 * an {@code unverified} or {@code skipped} status and report
 * {@code dojahCalled = false} so callers can refund unused points to the
 * institution's monthly KYC cap.
 *
 * <p>The pipeline never fails — every error surfaces as a step result.
 */
public final class DojaVerificationPipeline {

  private static final Logger log = LoggerFactory.getLogger(DojaVerificationPipeline.class);

  /** Default step order. {@code phone_beam_*} entries are conditional. */
  public static final List<String> DEFAULT_PIPELINE = List.of(
      "bvn_nin",
      "phone_record_basic", "phone_record_fraud",
      "phone_beam_basic",   "phone_beam_fraud",
      "liveness", "pep_check");

  private final DojaClient dojaClient;

  public DojaVerificationPipeline(DojaClient dojaClient) {
    this.dojaClient = dojaClient;
  }

  /**
   * Pipeline accumulator. Carries identity, resolved phones, and every step
   * result through the chain.
   */
  private record Ctx(
      List<PipelineStepResult> steps,
      DojaVerificationResult   identity,
      String                   recordPhone,    // phone returned by BVN/NIN lookup
      String                   beamPhone       // phone the customer beamed
  ) {
    static Ctx initial(String beamPhone) {
      return new Ctx(new ArrayList<>(), null, null, beamPhone);
    }

    Ctx add(PipelineStepResult s) {
      var next = new ArrayList<>(steps);
      next.add(s);
      return new Ctx(next, identity, recordPhone, beamPhone);
    }

    Ctx withIdentity(DojaVerificationResult r) {
      String rp = r != null ? normalisePhone(r.phone()) : null;
      return new Ctx(steps, r, rp, beamPhone);
    }
  }

  // ── Public entry points ───────────────────────────────────────────────────

  public Future<PipelineVerificationResult> run(
      String customerId, String bvn, String nin,
      String phone, String photo, List<String> pipeline) {
    return run(customerId, bvn, nin, phone, photo, pipeline, null, null);
  }

  public Future<PipelineVerificationResult> run(
      String customerId, String bvn, String nin,
      String phone, String photo, List<String> pipeline, Consumer<JsonObject> stepCallback) {
    return run(customerId, bvn, nin, phone, photo, pipeline, stepCallback, null);
  }

  /**
   * Run the pipeline, calling {@code stepCallback} after every step completes.
   *
   * @param beamedName name from the beam payload — anchor for all name comparisons
   */
  public Future<PipelineVerificationResult> run(
      String customerId,
      String bvn, String nin,
      String phone, String photo,
      List<String> pipeline,
      Consumer<JsonObject> stepCallback,
      String beamedName) {

    long start = System.currentTimeMillis();
    final String beamPhone = normalisePhone(phone);
    Future<Ctx> chain = Future.succeededFuture(Ctx.initial(beamPhone));

    for (String step : pipeline) {
      chain = switch (step) {
        case "bvn_nin"            -> chain.compose(ctx -> stepBvnNin(ctx, bvn, nin, beamedName)
                                          .map(c -> { emitStep(c, stepCallback); return c; }));
        case "phone_record_basic" -> chain.compose(ctx -> stepPhoneRecordBasic(ctx, beamedName)
                                          .map(c -> { emitStep(c, stepCallback); return c; }));
        case "phone_record_fraud" -> chain.compose(ctx -> stepPhoneRecordFraud(ctx)
                                          .map(c -> { emitStep(c, stepCallback); return c; }));
        case "phone_beam_basic"   -> chain.compose(ctx -> stepPhoneBeamBasic(ctx, beamedName)
                                          .map(c -> { emitStep(c, stepCallback); return c; }));
        case "phone_beam_fraud"   -> chain.compose(ctx -> stepPhoneBeamFraud(ctx)
                                          .map(c -> { emitStep(c, stepCallback); return c; }));
        case "liveness"           -> chain.compose(ctx -> stepLiveness(ctx, bvn, nin, photo)
                                          .map(c -> { emitStep(c, stepCallback); return c; }));
        case "pep_check"          -> chain.compose(ctx -> stepPepCheck(ctx, customerId, beamedName)
                                          .map(c -> { emitStep(c, stepCallback); return c; }));
        default                   -> chain;
      };
    }

    return chain
        .map(ctx -> {
          long ms = System.currentTimeMillis() - start;
          int overallScore = computeAverageScore(ctx.steps());
          DojaVerificationResult id = ctx.identity();

          String firstName   = id != null ? id.firstName()   : null;
          String lastName    = id != null ? id.lastName()    : null;
          String storedPhone = id != null ? id.phone()       : null;
          String dob         = id != null ? id.dateOfBirth() : null;

          if ((firstName == null || firstName.isBlank()) && beamedName != null && !beamedName.isBlank()) {
            String[] parts = beamedName.trim().split("\\s+", 2);
            firstName = parts[0];
            lastName  = parts.length > 1 ? parts[1] : lastName;
          }
          if (storedPhone == null || storedPhone.isBlank()) {
            storedPhone = beamPhone;
          }

          return new PipelineVerificationResult(
              customerId,
              List.copyOf(ctx.steps()),
              computeOverallStatus(overallScore),
              computeTier(overallScore),
              ms,
              overallScore,
              (photo != null && !photo.isBlank()) ? photo : (id != null ? id.photo() : null),
              firstName,
              lastName,
              storedPhone,
              dob);
        })
        .recover(err -> {
          log.error("[Pipeline] Unexpected failure for {}: {}", customerId, err.getMessage());
          long ms = System.currentTimeMillis() - start;
          var errStep = new PipelineStepResult("pipeline", "error", err.getMessage(), ms, 70, false);
          return Future.succeededFuture(new PipelineVerificationResult(
              customerId, List.of(errStep),
              "flagged", 0, ms, 70, null, null, null, null, null));
        });
  }

  // ── Step callback emission ────────────────────────────────────────────────

  private void emitStep(Ctx ctx, Consumer<JsonObject> cb) {
    if (cb == null || ctx.steps().isEmpty()) return;
    var last = ctx.steps().get(ctx.steps().size() - 1);
    int running = computeAverageScore(ctx.steps());
    cb.accept(new JsonObject()
        .put("step",          last.step())
        .put("status",        last.status())
        .put("detail",        last.detail())
        .put("durationMs",    last.durationMs())
        .put("stepRiskScore", last.riskScore())
        .put("dojahCalled",   last.dojahCalled())
        .put("runningScore",  running));
  }

  // ── Step 1: BVN / NIN Lookup ──────────────────────────────────────────────

  private Future<Ctx> stepBvnNin(Ctx ctx, String bvn, String nin, String beamedName) {
    long start = System.currentTimeMillis();
    boolean hasBvn = bvn != null && !bvn.isBlank();
    boolean hasNin = nin != null && !nin.isBlank();

    if (!hasBvn && !hasNin) {
      long ms = System.currentTimeMillis() - start;
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "bvn_nin", "unverified",
          "No BVN or NIN provided — identity unverifiable",
          ms, stepRiskScore("bvn_nin", "unverified"), false)));
    }

    Future<DojaVerificationResult> lookup = hasBvn
        ? dojaClient.verifyBvn(bvn)
        : dojaClient.verifyNin(nin);

    return lookup
        .map(result -> {
          long ms = System.currentTimeMillis() - start;
          String idName = fullName(result);
          boolean hasIdName     = !idName.equals("unknown");
          boolean hasBeamedName = beamedName != null && !beamedName.isBlank();

          Ctx next = ctx.withIdentity(result);

          if (!hasIdName) {
            String st  = result.verified() ? "pass" : "fail";
            String det = result.verified()
                ? "Identity record found but name was not returned"
                : "Identity could not be confirmed";
            return next.add(new PipelineStepResult("bvn_nin", st, det, ms, stepRiskScore("bvn_nin", st), true));
          }

          if (!hasBeamedName) {
            String st  = result.verified() ? "pass" : "fail";
            String det = result.verified()
                ? "Identity confirmed — " + idName + " (no beamed name to compare)"
                : "Identity could not be confirmed";
            return next.add(new PipelineStepResult("bvn_nin", st, det, ms, stepRiskScore("bvn_nin", st), true));
          }

          double sim = nameSimilarity(beamedName, idName);
          String status; String detail; int score;
          if (sim >= 0.85) {
            status = "pass"; score = 10;
            detail = String.format("Name matched identity record (%.0f%% similarity) — %s", sim * 100, idName);
          } else if (sim >= 0.60) {
            status = "pass"; score = 22;
            detail = String.format("Name closely matches identity record (%.0f%% similarity) — beamed: \"%s\", record: \"%s\"", sim * 100, beamedName, idName);
          } else if (sim >= 0.35) {
            status = "fail"; score = 55;
            detail = String.format("Name partially matches identity record (%.0f%% similarity) — beamed: \"%s\", record: \"%s\"", sim * 100, beamedName, idName);
          } else {
            status = "fail"; score = 78;
            detail = String.format("Name does not match identity record (%.0f%% similarity) — beamed: \"%s\", record: \"%s\"", sim * 100, beamedName, idName);
          }
          return next.add(new PipelineStepResult("bvn_nin", status, detail, ms, score, true));
        })
        .recover(err -> {
          long ms = System.currentTimeMillis() - start;
          log.warn("[Pipeline] bvn_nin error: {}", err.getMessage());
          return Future.succeededFuture(ctx.add(new PipelineStepResult(
              "bvn_nin", "error", err.getMessage(), ms, stepRiskScore("bvn_nin", "error"), true)));
        });
  }

  // ── Step 2: Basic lookup on the BVN/NIN-registered phone ──────────────────

  private Future<Ctx> stepPhoneRecordBasic(Ctx ctx, String beamedName) {
    long start = System.currentTimeMillis();
    String recordPhone = ctx.recordPhone();

    if (recordPhone == null || recordPhone.isBlank()) {
      long ms = System.currentTimeMillis() - start;
      String detail = ctx.identity() != null
          ? "No phone on identity record — basic lookup skipped"
          : "Identity lookup did not return a phone — basic lookup skipped";
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "phone_record_basic", "unverified", detail, ms,
          stepRiskScore("phone_record_basic", "unverified"), false)));
    }

    return dojaClient.lookupPhone(recordPhone)
        .map(phoneResult -> {
          long ms = System.currentTimeMillis() - start;
          if (!phoneResult.verified()) {
            return ctx.add(new PipelineStepResult(
                "phone_record_basic", "unverified",
                "Identity-registered phone (" + recordPhone + ") could not be verified",
                ms, stepRiskScore("phone_record_basic", "unverified"), true));
          }
          return ctx.add(scorePhoneOwnerStep(
              "phone_record_basic", phoneResult, recordPhone, "identity-registered",
              ctx.identity(), beamedName, ms));
        })
        .recover(err -> {
          long ms = System.currentTimeMillis() - start;
          log.warn("[Pipeline] phone_record_basic error: {}", err.getMessage());
          return Future.succeededFuture(ctx.add(new PipelineStepResult(
              "phone_record_basic", "error", err.getMessage(), ms,
              stepRiskScore("phone_record_basic", "error"), true)));
        });
  }

  // ── Step 3: Fraud screening on the BVN/NIN-registered phone ───────────────

  private Future<Ctx> stepPhoneRecordFraud(Ctx ctx) {
    long start = System.currentTimeMillis();
    String recordPhone = ctx.recordPhone();
    if (recordPhone == null || recordPhone.isBlank()) {
      long ms = System.currentTimeMillis() - start;
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "phone_record_fraud", "unverified",
          "No identity-registered phone available for fraud screening",
          ms, stepRiskScore("phone_record_fraud", "unverified"), false)));
    }
    return runFraudCheck(ctx, "phone_record_fraud", recordPhone, "identity-registered", start);
  }

  // ── Step 4: Basic lookup on the beamed phone (only if it differs) ─────────

  private Future<Ctx> stepPhoneBeamBasic(Ctx ctx, String beamedName) {
    long start = System.currentTimeMillis();
    String beamPhone = ctx.beamPhone();
    String recordPhone = ctx.recordPhone();

    if (beamPhone == null || beamPhone.isBlank()) {
      long ms = System.currentTimeMillis() - start;
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "phone_beam_basic", "skipped",
          "No beamed phone provided",
          ms, 0, false)));
    }
    if (Objects.equals(beamPhone, recordPhone)) {
      long ms = System.currentTimeMillis() - start;
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "phone_beam_basic", "skipped",
          "Beamed phone matches identity-registered phone — no additional lookup needed",
          ms, 0, false)));
    }

    return dojaClient.lookupPhone(beamPhone)
        .map(phoneResult -> {
          long ms = System.currentTimeMillis() - start;
          if (!phoneResult.verified()) {
            return ctx.add(new PipelineStepResult(
                "phone_beam_basic", "fail",
                "Beamed phone (" + beamPhone + ") could not be verified — possible burner / unregistered SIM",
                ms, 65, true));
          }
          return ctx.add(scorePhoneOwnerStep(
              "phone_beam_basic", phoneResult, beamPhone, "beamed",
              ctx.identity(), beamedName, ms));
        })
        .recover(err -> {
          long ms = System.currentTimeMillis() - start;
          log.warn("[Pipeline] phone_beam_basic error: {}", err.getMessage());
          return Future.succeededFuture(ctx.add(new PipelineStepResult(
              "phone_beam_basic", "error", err.getMessage(), ms,
              stepRiskScore("phone_beam_basic", "error"), true)));
        });
  }

  // ── Step 5: Fraud screening on the beamed phone (only if it differs) ─────

  private Future<Ctx> stepPhoneBeamFraud(Ctx ctx) {
    long start = System.currentTimeMillis();
    String beamPhone = ctx.beamPhone();
    String recordPhone = ctx.recordPhone();

    if (beamPhone == null || beamPhone.isBlank()) {
      long ms = System.currentTimeMillis() - start;
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "phone_beam_fraud", "skipped",
          "No beamed phone provided",
          ms, 0, false)));
    }
    if (Objects.equals(beamPhone, recordPhone)) {
      long ms = System.currentTimeMillis() - start;
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "phone_beam_fraud", "skipped",
          "Beamed phone matches identity-registered phone — fraud already evaluated",
          ms, 0, false)));
    }
    return runFraudCheck(ctx, "phone_beam_fraud", beamPhone, "beamed", start);
  }

  // ── Step 6: Liveness + Face Match ────────────────────────────────────────

  private Future<Ctx> stepLiveness(Ctx ctx, String bvn, String nin, String photo) {
    long start = System.currentTimeMillis();

    String effectivePhoto = (photo != null && !photo.isBlank()) ? photo
        : (ctx.identity() != null ? ctx.identity().photo() : null);

    if (effectivePhoto == null || effectivePhoto.isBlank()) {
      long ms = System.currentTimeMillis() - start;
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "liveness", "unverified",
          "No selfie photo submitted — liveness check skipped",
          ms, stepRiskScore("liveness", "unverified"), false)));
    }

    boolean hasBvn = bvn != null && !bvn.isBlank();
    boolean hasNin = nin != null && !nin.isBlank();
    if (!hasBvn && !hasNin) {
      long ms = System.currentTimeMillis() - start;
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "liveness", "unverified",
          "No BVN or NIN to use as face reference",
          ms, stepRiskScore("liveness", "unverified"), false)));
    }

    Future<DojaVerificationResult> verify = hasBvn
        ? dojaClient.verifyBvnWithSelfie(bvn, effectivePhoto)
        : dojaClient.verifyNinWithSelfie(nin, effectivePhoto);
    String refType = hasBvn ? "BVN" : "NIN";

    return verify
        .map(result -> {
          long ms = System.currentTimeMillis() - start;
          double confidence = result.matchScore();
          String status; String detail; int score;
          if (confidence < 0) {
            status = "unverified"; score = stepRiskScore("liveness", "unverified");
            detail = "Liveness check could not be completed — selfie could not be matched against the identity record";
          } else if (confidence >= 90) {
            status = "pass"; score = 10;
            detail = String.format("Liveness confirmed — selfie matches %s photo (%.1f%% confidence)", refType, confidence);
          } else if (confidence >= 70) {
            status = "pass"; score = 28;
            detail = String.format("Selfie likely matches %s photo (%.1f%% confidence — borderline)", refType, confidence);
          } else if (confidence >= 50) {
            status = "fail"; score = 58;
            detail = String.format("Selfie weakly matches %s photo (%.1f%% confidence — below threshold)", refType, confidence);
          } else {
            status = "fail"; score = 78;
            detail = String.format("Selfie does not match %s photo (%.1f%% confidence)", refType, confidence);
          }
          return ctx.add(new PipelineStepResult("liveness", status, detail, ms, score, true));
        })
        .recover(err -> {
          long ms = System.currentTimeMillis() - start;
          log.warn("[Pipeline] liveness error: {}", err.getMessage());
          return Future.succeededFuture(ctx.add(new PipelineStepResult(
              "liveness", "error", err.getMessage(), ms,
              stepRiskScore("liveness", "error"), true)));
        });
  }

  // ── Step 7: PEP & Sanctions Check ────────────────────────────────────────

  private Future<Ctx> stepPepCheck(Ctx ctx, String customerId, String beamedName) {
    long start = System.currentTimeMillis();

    String name = (beamedName != null && !beamedName.isBlank()) ? beamedName : null;
    if (name == null && ctx.identity() != null) {
      String idName = fullName(ctx.identity());
      if (!idName.equals("unknown")) name = idName;
    }

    if (name == null) {
      long ms = System.currentTimeMillis() - start;
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "pep_check", "unverified",
          "No name available for PEP/AML screening",
          ms, stepRiskScore("pep_check", "unverified"), false)));
    }

    if (!dojaClient.config().isConfigured()) {
      long ms = System.currentTimeMillis() - start;
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "pep_check", "unverified",
          "AML/PEP screening not configured",
          ms, stepRiskScore("pep_check", "unverified"), false)));
    }

    String dob = ctx.identity() != null ? ctx.identity().dateOfBirth() : null;
    final String screenName = name;

    return dojaClient.screenAml(screenName, dob, customerId)
        .map(amlResult -> {
          long ms = System.currentTimeMillis() - start;
          if (amlResult.containsKey("error")) {
            return ctx.add(new PipelineStepResult(
                "pep_check", "error",
                "AML screening error: " + amlResult.getString("error"),
                ms, stepRiskScore("pep_check", "error"), true));
          }

          JsonObject entity = amlResult.getJsonObject("entity", new JsonObject());
          String riskLevel  = entity.getString("risk_level", "");
          int totalResults  = entity.getInteger("total_results", 0);

          List<JsonObject> resultList = new ArrayList<>();
          Object raw = entity.getValue("results");
          if (raw instanceof io.vertx.core.json.JsonArray arr) {
            for (int i = 0; i < arr.size(); i++) resultList.add(arr.getJsonObject(i));
          } else if (raw instanceof JsonObject obj) {
            resultList.add(obj);
          }

          boolean hasSanction = false;
          boolean hasPepMatch = false;
          for (JsonObject r : resultList) {
            String src = r.getString("source_type", "");
            if ("SANCTION".equalsIgnoreCase(src)) hasSanction = true;
            if ("PEP".equalsIgnoreCase(src))      hasPepMatch = true;
            io.vertx.core.json.JsonArray sd = r.getJsonArray("sanction_details");
            if (sd != null && !sd.isEmpty()) hasSanction = true;
          }

          String status; String detail; int score;
          if (hasSanction) {
            status = "fail"; score = 90;
            detail = "Customer name matched an active sanctions entry — immediate review required";
          } else if ("High".equalsIgnoreCase(riskLevel)) {
            status = "fail"; score = 82;
            detail = "High PEP risk — confirmed match in AML screening database";
          } else if ("Medium".equalsIgnoreCase(riskLevel) || hasPepMatch) {
            status = "fail"; score = 55;
            detail = "Medium PEP risk — name appears in politically exposed persons database";
          } else if ("Unknown".equalsIgnoreCase(riskLevel) && totalResults > 0) {
            status = "fail"; score = 55;
            detail = "PEP/AML match found — risk level undetermined; manual review required";
          } else if ("Low".equalsIgnoreCase(riskLevel) && totalResults > 0) {
            status = "pass"; score = 18;
            detail = "Low PEP risk — minor presence detected in public databases";
          } else {
            status = "pass"; score = 5;
            detail = "No PEP or sanctions matches found — AML screening clear";
          }
          return ctx.add(new PipelineStepResult("pep_check", status, detail, ms, score, true));
        })
        .recover(err -> {
          long ms = System.currentTimeMillis() - start;
          log.warn("[Pipeline] pep_check error: {}", err.getMessage());
          return Future.succeededFuture(ctx.add(new PipelineStepResult(
              "pep_check", "error", err.getMessage(), ms,
              stepRiskScore("pep_check", "error"), true)));
        });
  }

  // ── Shared sub-routines ───────────────────────────────────────────────────

  /**
   * Owner-name match — scores how well the name registered on a phone number
   * lines up against the identity name and the beamed name.
   */
  private static PipelineStepResult scorePhoneOwnerStep(
      String stepName, DojaVerificationResult phoneResult, String phoneNumber,
      String phoneLabel, DojaVerificationResult identity, String beamedName, long ms) {

    String phoneName = fullName(phoneResult);
    boolean hasPhoneName = !phoneName.equals("unknown");

    if (!hasPhoneName) {
      return new PipelineStepResult(stepName, "pass",
          "Phone " + phoneNumber + " (" + phoneLabel + ") verified — no name returned",
          ms, 15, true);
    }

    String anchorName = beamedName != null && !beamedName.isBlank()
        ? beamedName
        : (identity != null ? fullName(identity) : null);
    if (anchorName == null || anchorName.equals("unknown")) {
      return new PipelineStepResult(stepName, "pass",
          "Phone " + phoneNumber + " (" + phoneLabel + ") registered to " + phoneName + " (no reference name to compare)",
          ms, 18, true);
    }

    double sim = nameSimilarity(anchorName, phoneName);
    String status; String detail; int score;
    if (sim >= 0.85) {
      status = "pass"; score = 10;
      detail = String.format("Phone %s owner confirmed (%.0f%% match) — %s", phoneLabel, sim * 100, phoneName);
    } else if (sim >= 0.60) {
      status = "pass"; score = 28;
      detail = String.format("Phone %s owner closely matches (%.0f%%) — anchor: \"%s\", phone record: \"%s\"",
          phoneLabel, sim * 100, anchorName, phoneName);
    } else if (sim >= 0.35) {
      status = "fail"; score = 60;
      detail = String.format("Phone %s owner partially matches (%.0f%%) — anchor: \"%s\", phone record: \"%s\"",
          phoneLabel, sim * 100, anchorName, phoneName);
    } else {
      status = "fail"; score = 75;
      detail = String.format("Phone %s is registered to a different person (%.0f%%) — anchor: \"%s\", phone record: \"%s\"",
          phoneLabel, sim * 100, anchorName, phoneName);
    }
    return new PipelineStepResult(stepName, status, detail, ms, score, true);
  }

  /**
   * Fraud screening shared between {@code phone_record_fraud} and {@code phone_beam_fraud}.
   * Hard fraud signals (leaked / spammer / recent_abuse / disposable) fail outright.
   * High risk score (≥70) also fails. Below that, score decays toward pass.
   */
  private Future<Ctx> runFraudCheck(Ctx ctx, String stepName, String phone, String label, long start) {
    return dojaClient.screenPhoneFraud(phone)
        .map(fraud -> {
          long ms = System.currentTimeMillis() - start;
          if (!fraud.resolved()) {
            return ctx.add(new PipelineStepResult(
                stepName, "unverified",
                "Fraud screening for " + label + " phone (" + phone + ") could not be resolved",
                ms, stepRiskScore(stepName, "unverified"), true));
          }

          boolean hardFraud = fraud.leaked() || fraud.spammer() || fraud.recentAbuse() || fraud.disposable();
          int riskScore = fraud.riskScore();

          String status; String detail; int score;
          if (hardFraud) {
            status = "fail"; score = 90;
            detail = String.format(
                "Hard fraud signals on %s phone (%s): leaked=%s spammer=%s disposable=%s recent_abuse=%s — block recommended",
                label, phone, fraud.leaked(), fraud.spammer(), fraud.disposable(), fraud.recentAbuse());
          } else if (riskScore >= 70) {
            status = "fail"; score = 75;
            detail = String.format("High fraud risk on %s phone (%s) — Dojah risk score %d", label, phone, riskScore);
          } else if (riskScore >= 40) {
            status = "pass"; score = 35;
            detail = String.format("Moderate fraud risk on %s phone (%s) — Dojah risk score %d; monitor", label, phone, riskScore);
          } else {
            status = "pass"; score = 10;
            detail = String.format("Clean fraud screen on %s phone (%s) — Dojah risk score %d", label, phone, riskScore);
          }
          return ctx.add(new PipelineStepResult(stepName, status, detail, ms, score, true));
        })
        .recover(err -> {
          long ms = System.currentTimeMillis() - start;
          log.warn("[Pipeline] {} error: {}", stepName, err.getMessage());
          return Future.succeededFuture(ctx.add(new PipelineStepResult(
              stepName, "error", err.getMessage(), ms, stepRiskScore(stepName, "error"), true)));
        });
  }

  // ── Score / Status / Tier Derivation ─────────────────────────────────────

  public static int stepRiskScore(String step, String status) {
    return switch (step) {
      case "bvn_nin" -> switch (status) {
        case "pass" -> 10; case "fail" -> 80; case "unverified" -> 70; default -> 65;
      };
      case "phone_record_basic", "phone_beam_basic" -> switch (status) {
        case "pass" -> 10; case "fail" -> 65; default -> 45;
      };
      case "phone_record_fraud", "phone_beam_fraud" -> switch (status) {
        case "pass" -> 10; case "fail" -> 80; default -> 45;
      };
      case "liveness" -> switch (status) {
        case "pass" -> 10; case "fail" -> 70; default -> 45;
      };
      case "pep_check" -> switch (status) {
        case "pass" -> 5; case "fail" -> 90; default -> 35;
      };
      default -> 50;
    };
  }

  private static int computeAverageScore(List<PipelineStepResult> steps) {
    // Skipped steps contribute neutrally — exclude them from the average so a
    // same-phone pipeline isn't dragged down by zero-risk skip rows.
    var contributing = steps.stream().filter(s -> !s.skipped()).toList();
    if (contributing.isEmpty()) return 50;
    return (int) contributing.stream().mapToInt(PipelineStepResult::riskScore).average().orElse(50);
  }

  private static String computeOverallStatus(int score) {
    if (score < 35) return "verified";
    if (score < 75) return "partial";
    return "flagged";
  }

  private static int computeTier(int score) {
    if (score < 20) return 3;
    if (score < 40) return 2;
    if (score < 75) return 1;
    return 0;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static String fullName(DojaVerificationResult r) {
    StringBuilder sb = new StringBuilder();
    appendNamePart(sb, r.firstName());
    appendNamePart(sb, r.middleName());
    appendNamePart(sb, r.lastName());
    return sb.isEmpty() ? "unknown" : sb.toString();
  }

  private static void appendNamePart(StringBuilder sb, String part) {
    if (part != null && !part.isBlank()) {
      if (sb.length() > 0) sb.append(' ');
      sb.append(part.trim());
    }
  }

  static double nameSimilarity(String a, String b) {
    if (a == null || b == null || a.isBlank() || b.isBlank()) return 0.0;
    Set<String> tokA = tokenizeNameToSet(a);
    Set<String> tokB = tokenizeNameToSet(b);
    if (tokA.isEmpty() || tokB.isEmpty()) return 0.0;
    Set<String> intersection = new HashSet<>(tokA);
    intersection.retainAll(tokB);
    Set<String> union = new HashSet<>(tokA);
    union.addAll(tokB);
    return (double) intersection.size() / union.size();
  }

  private static Set<String> tokenizeNameToSet(String name) {
    return Arrays.stream(name.toLowerCase().split("[\\s\\-]+"))
        .filter(t -> t.length() > 1)
        .collect(Collectors.toSet());
  }

  /**
   * Normalise phones to enable beam-vs-record comparison: strip everything
   * except digits + a leading '+'. Carriers / Dojah return numbers in
   * inconsistent formats (e.g. "0803...", "+234803...", "234803...").
   */
  static String normalisePhone(String phone) {
    if (phone == null) return null;
    String trimmed = phone.trim();
    if (trimmed.isEmpty()) return null;
    StringBuilder sb = new StringBuilder(trimmed.length());
    for (int i = 0; i < trimmed.length(); i++) {
      char c = trimmed.charAt(i);
      if (c >= '0' && c <= '9') sb.append(c);
    }
    String digits = sb.toString();
    if (digits.isEmpty()) return null;
    // Canonical to local-Nigerian format: strip leading "234" country code and
    // restore the local trunk '0' so beamed "08031234567" matches record "+2348031234567".
    if (digits.startsWith("234") && digits.length() >= 13) {
      digits = "0" + digits.substring(3);
    }
    return digits;
  }
}
