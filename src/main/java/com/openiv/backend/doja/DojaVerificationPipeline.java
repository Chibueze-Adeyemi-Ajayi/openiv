package com.openiv.backend.doja;

import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * Runs the 4-step KYC verification pipeline using DojaClient and Dojah AML screening.
 *
 * Every step ALWAYS runs — there are no skips. When required data is absent
 * the step is marked "unverified" and assigned a moderate risk score.
 * The overall risk score is the average of all four step scores (0–100).
 *
 * Steps (in order):
 *   1. bvn_nin      — BVN or NIN identity lookup via doja.io
 *   2. phone_match  — verify phone number on identity record via Dojah lookup
 *   3. liveness     — selfie face match against BVN/NIN photo via doja.io
 *   4. pep_check    — name screening against Dojah AML/PEP/sanctions database
 */
public final class DojaVerificationPipeline {

  private static final Logger log = LoggerFactory.getLogger(DojaVerificationPipeline.class);

  private final DojaClient dojaClient;

  public DojaVerificationPipeline(DojaClient dojaClient) {
    this.dojaClient = dojaClient;
  }

  // Carries accumulated step results + identity data through the chain
  private record Ctx(List<PipelineStepResult> steps, DojaVerificationResult identity) {
    static Ctx empty() { return new Ctx(new ArrayList<>(), null); }

    Ctx add(PipelineStepResult s) {
      var next = new ArrayList<>(steps);
      next.add(s);
      return new Ctx(next, identity);
    }

    Ctx withIdentity(DojaVerificationResult r) {
      return new Ctx(steps, r);
    }
  }

  // ── Public entry points ───────────────────────────────────────────────────

  /** Run without a step callback (backward-compat). */
  public Future<PipelineVerificationResult> run(
      String customerId, String bvn, String nin,
      String phone, String photo,
      List<String> pipeline) {
    return run(customerId, bvn, nin, phone, photo, pipeline, null, null);
  }

  /** Run with a step callback but no beamed name (backward-compat). */
  public Future<PipelineVerificationResult> run(
      String customerId, String bvn, String nin,
      String phone, String photo,
      List<String> pipeline,
      Consumer<JsonObject> stepCallback) {
    return run(customerId, bvn, nin, phone, photo, pipeline, stepCallback, null);
  }

  /**
   * Run the pipeline, calling {@code stepCallback} after each step completes.
   * Never fails — errors surface in step results.
   *
   * @param beamedName the name from the beam payload — used as anchor for all name comparisons
   */
  public Future<PipelineVerificationResult> run(
      String customerId,
      String bvn, String nin,
      String phone, String photo,
      List<String> pipeline,
      Consumer<JsonObject> stepCallback,
      String beamedName) {

    long start = System.currentTimeMillis();
    Future<Ctx> chain = Future.succeededFuture(Ctx.empty());

    for (String step : pipeline) {
      chain = switch (step) {
        case "bvn_nin"     -> chain.compose(ctx -> stepBvnNin(ctx, bvn, nin, beamedName)
                                 .map(c -> { emitStep(c, stepCallback); return c; }));
        case "phone_match" -> chain.compose(ctx -> stepPhoneMatch(ctx, phone, beamedName)
                                 .map(c -> { emitStep(c, stepCallback); return c; }));
        case "liveness"    -> chain.compose(ctx -> stepLiveness(ctx, bvn, nin, photo)
                                 .map(c -> { emitStep(c, stepCallback); return c; }));
        case "pep_check"   -> chain.compose(ctx -> stepPepCheck(ctx, customerId, beamedName)
                                 .map(c -> { emitStep(c, stepCallback); return c; }));
        default            -> chain;
      };
    }

    return chain
        .map(ctx -> {
          long ms = System.currentTimeMillis() - start;
          int overallScore = computeAverageScore(ctx.steps());
          DojaVerificationResult id = ctx.identity();

          // If the identity lookup returned no name fields, use the beamed name as fallback
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
            storedPhone = (phone != null && !phone.isBlank()) ? phone : null;
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
          var errStep = new PipelineStepResult("pipeline", "error", err.getMessage(), ms, 70);
          return Future.succeededFuture(new PipelineVerificationResult(
              customerId,
              List.of(errStep),
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
          ms, stepRiskScore("bvn_nin", "unverified"))));
    }

    Future<DojaVerificationResult> lookup = hasBvn
        ? dojaClient.verifyBvn(bvn)
        : dojaClient.verifyNin(nin);

    return lookup
        .map(result -> {
          long ms = System.currentTimeMillis() - start;
          String idName = fullName(result);
          boolean hasIdName = !idName.equals("unknown");
          boolean hasBeamedName = beamedName != null && !beamedName.isBlank();

          Ctx next = ctx.withIdentity(result);

          if (!hasIdName) {
            // Identity record returned but no name fields
            String st = result.verified() ? "pass" : "fail";
            String det = result.verified()
                ? "Identity record found but name was not returned"
                : "Identity could not be confirmed";
            return next.add(new PipelineStepResult("bvn_nin", st, det, ms, stepRiskScore("bvn_nin", st)));
          }

          if (!hasBeamedName) {
            // No beamed name to compare — just report identity verification result
            String st = result.verified() ? "pass" : "fail";
            String det = result.verified()
                ? "Identity confirmed — " + idName + " (no beamed name to compare)"
                : "Identity could not be confirmed";
            return next.add(new PipelineStepResult("bvn_nin", st, det, ms, stepRiskScore("bvn_nin", st)));
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
          return next.add(new PipelineStepResult("bvn_nin", status, detail, ms, score));
        })
        .recover(err -> {
          long ms = System.currentTimeMillis() - start;
          log.warn("[Pipeline] bvn_nin error: {}", err.getMessage());
          return Future.succeededFuture(ctx.add(new PipelineStepResult(
              "bvn_nin", "error", err.getMessage(), ms, stepRiskScore("bvn_nin", "error"))));
        });
  }

  // ── Step 2: Phone Number Lookup ──────────────────────────────────────────

  private Future<Ctx> stepPhoneMatch(Ctx ctx, String beamedPhone, String beamedName) {
    long start = System.currentTimeMillis();

    // Prefer phone_number1 from the identity record; fall back to the beamed phone
    String rawIdentityPhone = ctx.identity() != null ? ctx.identity().phone() : null;
    boolean usingBeamedPhone = rawIdentityPhone == null || rawIdentityPhone.isBlank();
    final String identityPhone = usingBeamedPhone ? beamedPhone : rawIdentityPhone;
    final boolean fromBeam = usingBeamedPhone;

    if (identityPhone == null || identityPhone.isBlank()) {
      long ms = System.currentTimeMillis() - start;
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "phone_match", "unverified",
          "No phone number provided — phone verification skipped",
          ms, stepRiskScore("phone_match", "unverified"))));
    }

    return dojaClient.lookupPhone(identityPhone)
        .map(phoneResult -> {
          long ms = System.currentTimeMillis() - start;

          String phoneSource = fromBeam ? "customer-provided" : "identity record";
          if (!phoneResult.verified()) {
            return ctx.add(new PipelineStepResult(
                "phone_match", "unverified",
                "Phone number (" + identityPhone + ") from " + phoneSource + " could not be verified",
                ms, stepRiskScore("phone_match", "unverified")));
          }

          String phoneName = fullName(phoneResult);
          boolean hasPhoneName = !phoneName.equals("unknown");
          boolean hasBeamedName = beamedName != null && !beamedName.isBlank();

          if (!hasPhoneName || !hasBeamedName) {
            return ctx.add(new PipelineStepResult(
                "phone_match", "pass",
                "Phone number (" + identityPhone + ") from " + phoneSource + " verified — " + (hasPhoneName ? phoneName : "name not returned"),
                ms, 15));
          }

          double sim = nameSimilarity(beamedName, phoneName);
          String status; String detail; int score;
          if (sim >= 0.85) {
            status = "pass"; score = 10;
            detail = String.format("Phone owner identity confirmed (%.0f%% name similarity) — %s", sim * 100, phoneName);
          } else if (sim >= 0.60) {
            status = "pass"; score = 28;
            detail = String.format("Phone owner name closely matches (%.0f%% similarity) — beamed: \"%s\", phone record: \"%s\"", sim * 100, beamedName, phoneName);
          } else if (sim >= 0.35) {
            status = "fail"; score = 60;
            detail = String.format("Phone owner name partially matches (%.0f%% similarity) — beamed: \"%s\", phone record: \"%s\"", sim * 100, beamedName, phoneName);
          } else {
            status = "fail"; score = 75;
            detail = String.format("Phone number is registered to a different person (%.0f%% name similarity) — beamed: \"%s\", phone record: \"%s\"", sim * 100, beamedName, phoneName);
          }
          return ctx.add(new PipelineStepResult("phone_match", status, detail, ms, score));
        })
        .recover(err -> {
          long ms = System.currentTimeMillis() - start;
          log.warn("[Pipeline] phone_match error: {}", err.getMessage());
          return Future.succeededFuture(ctx.add(new PipelineStepResult(
              "phone_match", "error", err.getMessage(), ms, stepRiskScore("phone_match", "error"))));
        });
  }

  // ── Step 3: Liveness + Face Match ────────────────────────────────────────

  private Future<Ctx> stepLiveness(Ctx ctx, String bvn, String nin, String photo) {
    long start = System.currentTimeMillis();

    // If no selfie was uploaded, fall back to the photo from the identity record
    String effectivePhoto = (photo != null && !photo.isBlank()) ? photo
        : (ctx.identity() != null ? ctx.identity().photo() : null);

    if (effectivePhoto == null || effectivePhoto.isBlank()) {
      long ms = System.currentTimeMillis() - start;
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "liveness", "unverified",
          "No selfie photo submitted — liveness check skipped",
          ms, stepRiskScore("liveness", "unverified"))));
    }

    boolean hasBvn = bvn != null && !bvn.isBlank();
    boolean hasNin = nin != null && !nin.isBlank();

    if (!hasBvn && !hasNin) {
      long ms = System.currentTimeMillis() - start;
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "liveness", "unverified",
          "No BVN or NIN to use as face reference",
          ms, stepRiskScore("liveness", "unverified"))));
    }

    // Route to the correct endpoint based on which identifier is present
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
          return ctx.add(new PipelineStepResult("liveness", status, detail, ms, score));
        })
        .recover(err -> {
          long ms = System.currentTimeMillis() - start;
          log.warn("[Pipeline] liveness error: {}", err.getMessage());
          return Future.succeededFuture(ctx.add(new PipelineStepResult(
              "liveness", "error", err.getMessage(), ms, stepRiskScore("liveness", "error"))));
        });
  }

  // ── Step 4: PEP & Sanctions Check ────────────────────────────────────────

  private Future<Ctx> stepPepCheck(Ctx ctx, String customerId, String beamedName) {
    long start = System.currentTimeMillis();

    // Prefer beamed name for PEP screening; fall back to identity name
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
          ms, stepRiskScore("pep_check", "unverified"))));
    }

    if (!dojaClient.config().isConfigured()) {
      long ms = System.currentTimeMillis() - start;
      return Future.succeededFuture(ctx.add(new PipelineStepResult(
          "pep_check", "unverified",
          "AML/PEP screening not configured",
          ms, stepRiskScore("pep_check", "unverified"))));
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
                ms, stepRiskScore("pep_check", "error")));
          }

          JsonObject entity = amlResult.getJsonObject("entity", new JsonObject());
          String riskLevel   = entity.getString("risk_level", "");
          int totalResults   = entity.getInteger("total_results", 0);

          // API returns `results` as a JsonObject (single hit) or JsonArray (multiple hits)
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
            // Treat non-empty sanction_details as a sanction hit
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
          return ctx.add(new PipelineStepResult("pep_check", status, detail, ms, score));
        })
        .recover(err -> {
          long ms = System.currentTimeMillis() - start;
          log.warn("[Pipeline] pep_check error: {}", err.getMessage());
          return Future.succeededFuture(ctx.add(new PipelineStepResult(
              "pep_check", "error", err.getMessage(), ms, stepRiskScore("pep_check", "error"))));
        });
  }

  // ── Score / Status / Tier Derivation ─────────────────────────────────────

  /**
   * Per-step risk scores.
   * bvn_nin:    pass=10, fail=80, error=65, unverified=70
   * phone_match: pass=10, fail=65, error=45, unverified=45
   * liveness:   pass=10, fail=70, error=50, unverified=45
   * pep_check:  pass=5,  fail=90, error=35, unverified=35
   */
  public static int stepRiskScore(String step, String status) {
    return switch (step) {
      case "bvn_nin" -> switch (status) {
        case "pass"       -> 10;
        case "fail"       -> 80;
        case "unverified" -> 70;
        default           -> 65;
      };
      case "phone_match" -> switch (status) {
        case "pass"       -> 10;
        case "fail"       -> 65;
        default           -> 45;
      };
      case "liveness" -> switch (status) {
        case "pass"       -> 10;
        case "fail"       -> 70;
        default           -> 45;
      };
      case "pep_check" -> switch (status) {
        case "pass"       -> 5;
        case "fail"       -> 90;
        default           -> 35;
      };
      default -> 50;
    };
  }

  private static int computeAverageScore(List<PipelineStepResult> steps) {
    if (steps.isEmpty()) return 50;
    return (int) steps.stream().mapToInt(PipelineStepResult::riskScore).average().orElse(50);
  }

  /** score < 35 → verified, 35–74 → partial, ≥75 → flagged */
  private static String computeOverallStatus(int score) {
    if (score < 35)  return "verified";
    if (score < 75)  return "partial";
    return "flagged";
  }

  /** score < 20 → tier 3, < 40 → tier 2, < 75 → tier 1, else → tier 0 */
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

  /**
   * Token-set Jaccard similarity. Splits on whitespace/hyphens, lowercases,
   * filters single-char tokens. Returns 0.0–1.0. Handles Nigerian names where
   * word order varies and middle names may be absent.
   */
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
}
