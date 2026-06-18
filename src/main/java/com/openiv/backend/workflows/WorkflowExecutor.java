package com.openiv.backend.workflows;

import com.openiv.backend.cases.CaseRepository;
import com.openiv.backend.customers.CustomerService;
import com.openiv.backend.dojah.DojahClient;
import com.openiv.backend.notifications.NotificationService;

import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Executes workflow runs: scheduled (periodic timer scanning customers whose
 * last_evaluated_at exceeds their tier interval), manual, or import-triggered.
 *
 * Customers are processed sequentially within a run to keep third-party
 * screening (Doja) call rates predictable. Every customer outcome is persisted
 * as a workflow_run_item — the CBN 5.3.b.iii evidence trail.
 *
 * A customer whose screening produces any match automatically gets an
 * investigation case — case creation is engine behaviour, not a block.
 *
 * Each step now produces an authenticity score (0-100). The weighted average
 * across scoreable steps is inverted to produce a cddRiskScore stored on the
 * customer record. Steps that returned 404 are excluded from scoring but stored
 * as concerns visible on the customer profile.
 */
public final class WorkflowExecutor {

  private static final Logger log = LoggerFactory.getLogger(WorkflowExecutor.class);
  private static final long TICK_MS = 15 * 60 * 1000L; // 15 min
  private static final int BATCH_LIMIT = 500; // customers per scheduled run
  private static final SecureRandom RNG = new SecureRandom();

  // Blocks skipped on re-evaluate — must be resolved manually via Compare & Resolve.
  private static final Set<String> SKIP_IN_RESCREEN = Set.of(
      WorkflowBlocks.LIVENESS_MATCH, WorkflowBlocks.PHONE_BASIC, WorkflowBlocks.PHONE_FRAUD
  );

  // Weights for weighted authenticity → cddRiskScore. Higher = more influential.
  private static final Map<String, Integer> STEP_WEIGHTS = Map.of(
      WorkflowBlocks.IDENTITY_VERIFY,      35,
      WorkflowBlocks.LIVENESS_MATCH,       25,
      WorkflowBlocks.PEP_SANCTIONS_SCREEN, 20,
      WorkflowBlocks.CASE_HISTORY,         20,
      WorkflowBlocks.DOCUMENT_VERIFY,      15,
      WorkflowBlocks.PHONE_BASIC,          12,
      WorkflowBlocks.PHONE_FRAUD,           8,
      WorkflowBlocks.FLAGGED_TRANSACTIONS,  5
  );

  private final WorkflowRepository workflows;
  private final DojahClient doja;
  private final CaseRepository cases;
  private final com.openiv.backend.transactions.TransactionRepository txns;
  private final CustomerService customers;
  private final NotificationService notifications;

  public WorkflowExecutor(WorkflowRepository workflows, DojahClient doja,
      CaseRepository cases, com.openiv.backend.transactions.TransactionRepository txns,
      CustomerService customers, NotificationService notifications) {
    this.workflows = workflows;
    this.doja = doja;
    this.cases = cases;
    this.txns = txns;
    this.customers = customers;
    this.notifications = notifications;
  }

  /** Install the periodic scheduler tick. Call once from Main after deploy. */
  public void start(Vertx vertx) {
    vertx.setPeriodic(TICK_MS, id -> tick());
    log.info("[Workflows] Scheduler started (tick every {} min)", TICK_MS / 60000);
  }

  private void tick() {
    workflows.listActiveScheduled()
        .onSuccess(defs -> defs.forEach(def -> workflows.hasRunningRun(def.id()).onSuccess(running -> {
          if (running)
            return; // previous run still going — skip this tick
          JsonObject s = def.schedule();
          int highDays, mediumDays, lowDays;
          if (def.rescheduleDays() != null) {
            highDays = mediumDays = lowDays = def.rescheduleDays();
          } else {
            highDays   = s.getInteger("highDays",   30);
            mediumDays = s.getInteger("mediumDays", 90);
            lowDays    = s.getInteger("lowDays",    365);
          }
          workflows.listDueCustomers(def.institutionId(),
              highDays, mediumDays, lowDays,
              BATCH_LIMIT)
              .onSuccess(due -> {
                if (due.isEmpty())
                  return;
                log.info("[Workflows] wf={} inst={}: {} customers due", def.id(), def.institutionId(), due.size());
                executeRun(def, "scheduled", due)
                    .onFailure(e -> log.error("[Workflows] scheduled run failed wf={}: {}", def.id(), e.getMessage()));
              });
        })))
        .onFailure(e -> log.error("[Workflows] tick failed: {}", e.getMessage()));
  }

  /**
   * Streaming variant: fires onCustomer after each customer completes so the
   * HTTP layer can push SSE events as results arrive.
   */
  public Future<Long> executeRunStreaming(WorkflowDefinition def, String trigger,
      List<WorkflowRepository.DueCustomer> batch,
      java.util.function.Consumer<io.vertx.core.json.JsonObject> onCustomer) {
    return workflows.createRun(def.id(), def.version(), def.institutionId(), trigger)
        .compose(runId -> {
          int[] stats = new int[3];
          Future<Void> chain = Future.succeededFuture();
          for (var customer : batch) {
            final var c = customer;
            chain = chain.compose(v -> screenCustomer(def, runId, c)
                .map(result -> {
                  String outcome = result.getString("outcome", "error");
                  switch (outcome) {
                    case "match" -> stats[1]++;
                    case "error" -> stats[2]++;
                    default -> stats[0]++;
                  }
                  onCustomer.accept(result);
                  return (Void) null;
                })
                .otherwise(err -> {
                  stats[2]++;
                  onCustomer.accept(new io.vertx.core.json.JsonObject()
                      .put("outcome",    "error")
                      .put("customerId", c.externalId())
                      .put("name",       c.name() != null ? c.name() : "")
                      .put("error",      err.getMessage()));
                  return null;
                }));
          }
          return chain
              .compose(v -> workflows.finishRun(runId, "completed",
                  batch.size(), stats[0], stats[1], stats[2]))
              .map(v -> runId)
              .recover(err -> workflows
                  .finishRun(runId, "failed", batch.size(), stats[0], stats[1], stats[2])
                  .map(runId));
        });
  }

  /**
   * Run a workflow over an explicit customer list. Shared by
   * scheduled/manual/import.
   */
  public Future<Long> executeRun(WorkflowDefinition def, String trigger,
      List<WorkflowRepository.DueCustomer> batch) {
    return workflows.createRun(def.id(), def.version(), def.institutionId(), trigger)
        .compose(runId -> {
          int[] stats = new int[3]; // clear, match, error
          Future<Void> chain = Future.succeededFuture();
          for (var customer : batch) {
            chain = chain.compose(v -> screenCustomer(def, runId, customer)
                .map(result -> {
                  String outcome = result.getString("outcome", "error");
                  switch (outcome) {
                    case "match" -> stats[1]++;
                    case "error" -> stats[2]++;
                    default -> stats[0]++;
                  }
                  return (Void) null;
                })
                .otherwise(err -> {
                  stats[2]++;
                  return null;
                }));
          }
          return chain
              .compose(v -> workflows.finishRun(runId, "completed",
                  batch.size(), stats[0], stats[1], stats[2]))
              .map(v -> runId)
              .recover(err -> workflows
                  .finishRun(runId, "failed", batch.size(), stats[0], stats[1], stats[2])
                  .map(runId));
        });
  }

  /**
   * Partial rescreen: re-runs BVN/NIN, PEP, case history, and flagged transactions only.
   * Facial recognition and phone checks (SKIP_IN_RESCREEN) are preserved from the prior run
   * and must be resolved manually via Compare & Resolve.
   */
  public Future<String> rescreenSingle(long institutionId, String externalId) {
    return customers.findAsDueCustomer(institutionId, externalId)
        .compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture("Customer not found: " + externalId);
          return customers.getCustomer(institutionId, externalId)
              .compose(custOpt -> {
                Map<String, JsonObject> preserved = new HashMap<>();
                if (custOpt.isPresent() && custOpt.get().cddStepScores() != null) {
                  try {
                    JsonArray arr = new JsonArray(custOpt.get().cddStepScores());
                    for (int j = 0; j < arr.size(); j++) {
                      JsonObject s = arr.getJsonObject(j);
                      if (s != null) {
                        String t = s.getString("type", "");
                        if (SKIP_IN_RESCREEN.contains(t)) preserved.put(t, s.copy());
                      }
                    }
                  } catch (Exception ignored) {}
                }
                return workflows.list(institutionId)
                    .compose(defs -> {
                      var active = defs.stream().filter(d -> "active".equals(d.status())).toList();
                      if (active.isEmpty()) return Future.failedFuture("No active workflow found for institution");
                      WorkflowDefinition def = active.get(0);
                      return workflows.createRun(def.id(), def.version(), institutionId, "manual_rescreen")
                          .compose(runId -> screenCustomerPartial(def, runId, opt.get(), preserved)
                              .compose(result -> {
                                String outcome = result.getString("outcome", "error");
                                return workflows.finishRun(runId, "completed", 1,
                                    "clear".equals(outcome) ? 1 : 0,
                                    "match".equals(outcome) ? 1 : 0, 0)
                                    .map(outcome);
                              }));
                    });
              });
        });
  }

  /**
   * Runs only the re-screeable blocks (identity, PEP, case history, transactions).
   * SKIP_IN_RESCREEN blocks use preserved results from the prior run if available,
   * contributing their stored score to the risk calculation without calling Dojah.
   */
  private Future<JsonObject> screenCustomerPartial(WorkflowDefinition def, long runId,
      WorkflowRepository.DueCustomer c, Map<String, JsonObject> preserved) {
    JsonArray stepResults = new JsonArray();
    boolean[] hardMatched = new boolean[1];

    Map<String, Integer> blockWeights = new HashMap<>();
    for (int i = 0; i < def.blocks().size(); i++) {
      JsonObject blk = def.blocks().getJsonObject(i);
      String t = blk.getString("type", "");
      Integer customW = blk.getInteger("weight");
      blockWeights.put(t, customW != null ? Math.max(1, customW) : STEP_WEIGHTS.getOrDefault(t, 10));
    }

    Future<Void> chain = customers.upsertFromWorkflow(
        def.institutionId(), c.externalId(), c.name(), c.phone(), c.bvn(), c.nin(), c.dob());

    for (int i = 0; i < def.blocks().size(); i++) {
      JsonObject block = def.blocks().getJsonObject(i);
      String type = block.getString("type", "");
      int usedWeight = blockWeights.getOrDefault(type, STEP_WEIGHTS.getOrDefault(type, 10));

      if (SKIP_IN_RESCREEN.contains(type)) {
        JsonObject pres = preserved.get(type);
        if (pres != null) {
          final JsonObject preservedStep = pres.copy().put("weight", usedWeight).put("preserved", true);
          chain = chain.compose(v -> {
            stepResults.add(preservedStep);
            return Future.<Void>succeededFuture();
          });
        }
        continue;
      }

      chain = chain.compose(v -> runBlock(type, c, def.institutionId())
          .map(step -> {
            step.put("weight", usedWeight);
            stepResults.add(step);
            if ("match".equals(step.getString("status")) && isHardSignalBlock(type))
              hardMatched[0] = true;
            return (Void) null;
          }));
    }

    return chain
        .<JsonObject>compose(v -> {
          String[] idPhoto = new String[]{ null };
          for (int i = 0; i < stepResults.size(); i++) {
            JsonObject s = stepResults.getJsonObject(i);
            String p = s.getString("idPhoto");
            if (p != null && !p.isBlank()) { idPhoto[0] = p; s.remove("idPhoto"); }
          }

          JsonArray concerns = buildConcerns(stepResults);
          int cddRisk = computeCddRiskScore(stepResults);

          boolean shouldOpenCase = hardMatched[0] || cddRisk >= def.caseRiskThreshold();
          String outcome = shouldOpenCase ? "match" : "clear";

          Future<Void> caseStep = shouldOpenCase
              ? openCase(def, c, stepResults, cddRisk, concerns, hardMatched[0]).map(caseId -> {
                  stepResults.add(new JsonObject()
                      .put("type",   "case")
                      .put("status", "match")
                      .put("detail", "Investigation case opened: " + caseId
                          + ". Risk score: " + cddRisk + "/100.")
                      .put("ms", 0));
                  return (Void) null;
                })
              : Future.<Void>succeededFuture();

          return caseStep
              .<JsonObject>compose(x -> workflows.addRunItem(runId, c.externalId(), stepResults, outcome, null)
                  .compose(y -> customers.updateCddEvaluation(
                      def.institutionId(), c.externalId(),
                      cddRisk, concerns, stepResults, c.selfie(), idPhoto[0]))
                  .compose(y -> customers.updateLastEvaluated(def.institutionId(), c.externalId(), def.id()))
                  .map(y -> new JsonObject()
                      .put("outcome",      outcome)
                      .put("customerId",   c.externalId())
                      .put("name",         c.name() != null ? c.name() : "")
                      .put("cddRiskScore", cddRisk)
                      .put("concerns",     concerns)
                      .put("stepResults",  stepResults)
                      .put("caseFlagged",  shouldOpenCase)));
        })
        .recover(err -> {
          log.warn("[Workflows] partial rescreen failed for {}: {}", c.externalId(), err.getMessage());
          return workflows.addRunItem(runId, c.externalId(), stepResults, "error", err.getMessage())
              .map(x -> new JsonObject()
                  .put("outcome",     "error")
                  .put("customerId",  c.externalId())
                  .put("stepResults", stepResults)
                  .put("error",       err.getMessage()));
        });
  }

  /**
   * Execute the workflow's blocks for one customer.
   * Returns a JsonObject with outcome, stepResults, concerns, cddRiskScore, and profile fields.
   */
  private Future<JsonObject> screenCustomer(WorkflowDefinition def, long runId,
      WorkflowRepository.DueCustomer c) {
    JsonArray stepResults = new JsonArray();
    // hardMatched = a serious finding that warrants a case regardless of overall score
    // (PEP/sanctions hit, identity verification failure, liveness mismatch).
    // Phone/document soft signals alone do NOT open a case.
    boolean[] hardMatched = new boolean[1];

    // Build per-block weight map: block JSON "weight" field overrides the hardcoded default.
    Map<String, Integer> blockWeights = new HashMap<>();
    for (int i = 0; i < def.blocks().size(); i++) {
      JsonObject blk = def.blocks().getJsonObject(i);
      String t = blk.getString("type", "");
      Integer customW = blk.getInteger("weight");
      blockWeights.put(t, customW != null ? Math.max(1, customW) : STEP_WEIGHTS.getOrDefault(t, 10));
    }

    // Ensure customer row exists with all import fields before running blocks
    Future<Void> upsert = customers.upsertFromWorkflow(
        def.institutionId(), c.externalId(), c.name(), c.phone(), c.bvn(), c.nin(), c.dob());

    Future<Void> chain = upsert;
    for (int i = 0; i < def.blocks().size(); i++) {
      JsonObject block = def.blocks().getJsonObject(i);
      String type = block.getString("type", "");
      int usedWeight = blockWeights.getOrDefault(type, STEP_WEIGHTS.getOrDefault(type, 10));
      chain = chain.compose(v -> runBlock(type, c, def.institutionId())
          .map(step -> {
            step.put("weight", usedWeight);   // carries through to run-item & frontend breakdown
            stepResults.add(step);
            // Only hard-signal blocks promote to a case match
            if ("match".equals(step.getString("status")) && isHardSignalBlock(type))
              hardMatched[0] = true;
            return (Void) null;
          }));
    }

    return chain
        .<JsonObject>compose(v -> {
          // ── Extract idPhoto from identity step, remove internal field ──
          String[] idPhoto = new String[]{ null };
          for (int i = 0; i < stepResults.size(); i++) {
            JsonObject s = stepResults.getJsonObject(i);
            String p = s.getString("idPhoto");
            if (p != null && !p.isBlank()) { idPhoto[0] = p; s.remove("idPhoto"); }
          }

          // ── Build concerns and CDD risk score ──
          JsonArray concerns = buildConcerns(stepResults);
          int cddRisk = computeCddRiskScore(stepResults);

          // Open a case when there is a hard-signal match OR the risk score meets the workflow threshold.
          boolean shouldOpenCase = hardMatched[0] || cddRisk >= def.caseRiskThreshold();
          String outcome = shouldOpenCase ? "match" : "clear";

          Future<Void> caseStep = shouldOpenCase
              ? openCase(def, c, stepResults, cddRisk, concerns, hardMatched[0]).map(caseId -> {
                  stepResults.add(new JsonObject()
                      .put("type",   "case")
                      .put("status", "match")
                      .put("detail", "Investigation case opened: " + caseId
                          + ". Risk score: " + cddRisk + "/100.")
                      .put("ms", 0));
                  return (Void) null;
                })
              : Future.<Void>succeededFuture();

          return caseStep
              .<JsonObject>compose(x -> workflows.addRunItem(runId, c.externalId(), stepResults, outcome, null)
                  .compose(y -> customers.updateCddEvaluation(
                      def.institutionId(), c.externalId(),
                      cddRisk, concerns, stepResults, c.selfie(), idPhoto[0]))
                  .compose(y -> customers.updateLastEvaluated(def.institutionId(), c.externalId(), def.id()))
                  .map(y -> new JsonObject()
                      .put("outcome",      outcome)
                      .put("customerId",   c.externalId())
                      .put("name",         c.name() != null ? c.name() : "")
                      .put("bvn",          c.bvn()  != null ? c.bvn()  : "")
                      .put("nin",          c.nin()  != null ? c.nin()  : "")
                      .put("dob",          c.dob()  != null ? c.dob()  : "")
                      .put("phone",        c.phone() != null ? c.phone() : "")
                      .put("cddRiskScore", cddRisk)
                      .put("concerns",     concerns)
                      .put("stepResults",  stepResults)
                      .put("caseFlagged",  shouldOpenCase)));
        })
        .recover(err -> {
          log.warn("[Workflows] customer {} failed: {}", c.externalId(), err.getMessage());
          return workflows.addRunItem(runId, c.externalId(), stepResults, "error", err.getMessage())
              .map(x -> new JsonObject()
                  .put("outcome",     "error")
                  .put("customerId",  c.externalId())
                  .put("name",        c.name() != null ? c.name() : "")
                  .put("stepResults", stepResults)
                  .put("error",       err.getMessage()));
        });
  }

  /** Hard-signal blocks: a "match" on any of these warrants opening a case. */
  private static boolean isHardSignalBlock(String type) {
    return WorkflowBlocks.IDENTITY_VERIFY.equals(type)
        || WorkflowBlocks.PEP_SANCTIONS_SCREEN.equals(type)
        || WorkflowBlocks.LIVENESS_MATCH.equals(type);
  }

  // ── Block execution ────────────────────────────────────────────────────────

  private Future<JsonObject> runBlock(String type, WorkflowRepository.DueCustomer c, long institutionId) {
    long start = System.currentTimeMillis();
    return switch (type) {

      // ── Identity Verify ──────────────────────────────────────────────────
      case WorkflowBlocks.IDENTITY_VERIFY -> {
        boolean hasBvn = c.bvn() != null && !c.bvn().isBlank();
        boolean hasNin = c.nin() != null && !c.nin().isBlank();
        if (!hasBvn && !hasNin) {
          yield Future.succeededFuture(step(type, "skipped", "No BVN or NIN supplied", start, null));
        }
        if (hasBvn) {
          yield doja.verifyBvn(c.bvn()).map(r -> {
            if (!r.verified())
              return step(type, "match", "BVN verification failed", start, 0);
            int score  = scoreNameMatch(c.name(), r.firstName(), r.lastName(), r.middleName());
            return stepWithPhoto(type, score < 60 ? "match" : "pass", "BVN verified. " + nameVerdict(score), start, score, r.photo());
          });
        } else {
          yield doja.verifyNin(c.nin()).map(r -> {
            if (!r.verified())
              return step(type, "match", "NIN verification failed", start, 0);
            int score  = scoreNameMatch(c.name(), r.firstName(), r.lastName(), r.middleName());
            return stepWithPhoto(type, score < 60 ? "match" : "pass", "NIN verified. " + nameVerdict(score), start, score, r.photo());
          });
        }
      }

      // ── PEP & Sanctions ──────────────────────────────────────────────────
      case WorkflowBlocks.PEP_SANCTIONS_SCREEN -> {
        if (c.name() == null || c.name().isBlank()) {
          yield Future.succeededFuture(step(type, "skipped", "No name on record", start, null));
        }
        yield doja.screenAml(c.name(), c.dob(), "wf-" + c.externalId()).map(aml -> {
          if (aml.containsKey("error"))
            return step(type, "error", aml.getString("error"), start, null);
          JsonObject entity   = aml.getJsonObject("entity", new JsonObject());
          String riskLevel    = entity.getString("risk_level", "");
          int totalResults    = entity.getInteger("total_results", 0);
          boolean hit         = "High".equalsIgnoreCase(riskLevel)
              || "Medium".equalsIgnoreCase(riskLevel) || totalResults > 0;
          return hit
              ? step(type, "match",
                  "PEP/sanctions match — risk level " + riskLevel + " (" + totalResults + " results)",
                  start, 0)
              : step(type, "pass", "No PEP or sanctions matches found", start, 100);
        });
      }

      // ── Liveness / Face Match ────────────────────────────────────────────
      case WorkflowBlocks.LIVENESS_MATCH -> {
        if (c.selfie() == null || c.selfie().isBlank()) {
          yield Future.succeededFuture(step(type, "skipped", "No selfie in payload", start, null));
        }
        boolean hasBvn = c.bvn() != null && !c.bvn().isBlank();
        boolean hasNin = c.nin() != null && !c.nin().isBlank();
        if (!hasBvn && !hasNin) {
          yield Future.succeededFuture(step(type, "skipped", "No BVN or NIN to match selfie against", start, null));
        }
        if (hasBvn) {
          yield doja.verifyBvnWithSelfie(c.bvn(), c.selfie()).map(r -> {
            int score   = r.faceMatch() ? (int) Math.max(0, Math.min(100, r.matchScore())) : 0;
            String det  = r.faceMatch()
                ? String.format("Selfie matches BVN record (confidence: %.1f%%)", r.matchScore())
                : "Selfie does not match BVN record";
            return step(type, r.verified() ? "pass" : "match", det, start, score);
          });
        } else {
          yield doja.verifyNinWithSelfie(c.nin(), c.selfie()).map(r -> {
            int score   = r.faceMatch() ? (int) Math.max(0, Math.min(100, r.matchScore())) : 0;
            String det  = r.faceMatch()
                ? String.format("Selfie matches NIN record (confidence: %.1f%%)", r.matchScore())
                : "Selfie does not match NIN record";
            return step(type, r.verified() ? "pass" : "match", det, start, score);
          });
        }
      }

      // ── Phone Basic ──────────────────────────────────────────────────────
      case WorkflowBlocks.PHONE_BASIC -> {
        if (c.phone() == null || c.phone().isBlank()) {
          yield Future.succeededFuture(step(type, "skipped", "No phone on record", start, null));
        }
        yield doja.lookupPhone(c.phone()).map(r -> {
          if (r.isNotFound())
            return step(type, "not_found",
                "Phone number not found in carrier registry — cannot verify subscriber identity",
                start, null);
          if (!r.verified())
            return step(type, "match", "Phone number invalid or not active with any carrier", start, 10);

          boolean hasIdName = (r.firstName() != null && !r.firstName().isBlank())
              || (r.lastName() != null && !r.lastName().isBlank());

          if (!hasIdName) {
            // No subscriber name returned — carrier confirmed active but cannot name-match
            return step(type, "pass", "Phone number active and registered with a carrier", start, 75);
          }

          // Name contributes 75%, DOB contributes 25%
          int nameScore    = scoreNameMatch(c.name(), r.firstName(), r.lastName(), r.middleName());
          int namePoints   = (int) Math.round(nameScore * 0.75);

          boolean hasDobRecord   = r.dateOfBirth() != null && !r.dateOfBirth().isBlank();
          boolean hasDobCustomer = c.dob() != null && !c.dob().isBlank();
          boolean dobMatch       = false;
          boolean dobMismatch    = false;

          if (hasDobRecord && hasDobCustomer) {
            // Compare as date strings normalised to YYYY-MM-DD
            dobMatch    = c.dob().equals(r.dateOfBirth());
            dobMismatch = !dobMatch;
          }

          int totalScore = namePoints + (dobMatch ? 25 : 0);
          StringBuilder det = new StringBuilder("Phone active and registered. ").append(nameVerdict(nameScore));
          if (hasDobRecord && hasDobCustomer) {
            det.append(dobMatch ? " DOB confirmed." : " DOB mismatch: submitted date does not match phone record.");
          }

          String status = nameScore < 55 ? "match" : "pass";
          JsonObject s = step(type, status, det.toString(), start, totalScore);
          if (dobMismatch) s.put("dobMismatch", true);
          return s;
        });
      }

      // ── Phone Fraud ──────────────────────────────────────────────────────
      case WorkflowBlocks.PHONE_FRAUD -> {
        if (c.phone() == null || c.phone().isBlank()) {
          yield Future.succeededFuture(step(type, "skipped", "No phone on record", start, null));
        }
        yield doja.screenPhoneFraud(c.phone()).map(r -> {
          if (r.isNotFound())
            return step(type, "not_found",
                "Phone not found in fraud database — no record to screen against",
                start, null);
          if (!r.resolved())
            return step(type, "error", "Phone fraud lookup unavailable", start, null);
          // Compute authenticity: start at 100 - dojah_riskScore, deduct per signal
          int auth = Math.max(0, 100 - r.riskScore());
          int signals = 0;
          if (r.spammer())   signals++;
          if (r.leaked())    signals++;
          if (r.disposable()) signals++;
          if (r.suspicious()) signals++;
          if (r.recentAbuse()) signals++;
          auth = Math.max(0, auth - signals * 12);
          boolean flagged = auth < 50;
          StringBuilder det = new StringBuilder("Risk score " + r.riskScore());
          if (r.spammer())    det.append(" · spammer");
          if (r.leaked())     det.append(" · leaked credentials");
          if (r.suspicious()) det.append(" · suspicious activity");
          if (r.recentAbuse()) det.append(" · recent abuse");
          if (r.disposable()) det.append(" · disposable number");
          if (!flagged)       det.append(" · no fraud signals");
          return step(type, flagged ? "match" : "pass", det.toString(), start, auth);
        });
      }

      // ── Document Verify ──────────────────────────────────────────────────
      case WorkflowBlocks.DOCUMENT_VERIFY -> {
        if (c.docFront() == null || c.docFront().isBlank()) {
          yield Future.succeededFuture(step(type, "skipped", "No document image in payload", start, null));
        }
        yield doja.verifyDocument(c.docFront(), c.docBack()).map(result -> {
          if (result.containsKey("error"))
            return step(type, "error", result.getString("error"), start, null);
          JsonObject entity  = result.getJsonObject("entity", new JsonObject());
          JsonObject status  = entity.getJsonObject("status", new JsonObject());
          int overall        = status.getInteger("overall_status", 0);
          String reason      = status.getString("reason", "UNKNOWN");
          String docName     = entity.getJsonObject("document_type", new JsonObject())
              .getString("document_name", "");
          return overall == 1
              ? step(type, "pass", "Document valid" + (docName.isEmpty() ? "" : " — " + docName), start, 100)
              : step(type, "match", "Document not valid — " + reason
                  + (docName.isEmpty() ? "" : " (" + docName + ")"), start, 0);
        });
      }

      // ── Case History ─────────────────────────────────────────────────────
      case WorkflowBlocks.CASE_HISTORY -> {
        yield cases.historySummaryForCustomer(institutionId, c.externalId()).map(summary -> {
          long total           = summary.getLong("totalCount", 0L);
          long escalated       = summary.getLong("escalatedCount", 0L);
          long recentEscalated = summary.getLong("recentEscalatedCount", 0L);

          if (total == 0) {
            return step(type, "pass", "No investigation history on file", start, 100);
          }
          if (escalated == 0) {
            return step(type, "pass",
                total + " case" + (total == 1 ? "" : "s") + " on file — none were escalated",
                start, 75);
          }
          if (recentEscalated > 0) {
            int score = (int) Math.max(5, 20 - recentEscalated * 10);
            return step(type, "match",
                recentEscalated + " escalated case" + (recentEscalated == 1 ? "" : "s")
                + " in the last 6 months (" + escalated + " total escalated)",
                start, score);
          }
          int score = (int) Math.max(20, 50 - escalated * 10);
          return step(type, "match",
              escalated + " escalated case" + (escalated == 1 ? "" : "s")
              + " on record — none in the last 6 months",
              start, score);
        });
      }

      // ── Flagged Transactions ─────────────────────────────────────────────
      case WorkflowBlocks.FLAGGED_TRANSACTIONS -> {
        yield txns.flaggedSummaryForCustomer(institutionId, c.externalId()).map(summary -> {
          long total  = summary.getLong("totalFlagged",  0L);
          long recent = summary.getLong("recentFlagged", 0L);

          if (total == 0) {
            return step(type, "pass", "No flagged transactions on record", start, 100);
          }
          if (recent == 0) {
            return step(type, "pass",
                total + " flagged transaction" + (total == 1 ? "" : "s") + " on record — none in the last 6 months",
                start, 65);
          }
          int score = (int) Math.max(5, 40 - recent * 15);
          return step(type, "match",
              recent + " flagged transaction" + (recent == 1 ? "" : "s") + " in the last 6 months"
              + " (" + total + " total flagged)",
              start, score);
        });
      }

      default -> Future.succeededFuture(step(type, "error", "Unknown block type", start, null));
    };
  }

  // ── Case opening ──────────────────────────────────────────────────────────

  private Future<String> openCase(WorkflowDefinition def, WorkflowRepository.DueCustomer c,
      JsonArray stepResults, int cddRiskScore, JsonArray concerns, boolean hardSignal) {
    String caseId = "CASE-WF-" + Long.toHexString(RNG.nextLong()).toUpperCase();
    OffsetDateTime slaDeadline = OffsetDateTime.now().plusDays(7);

    String customerLabel = (c.name() != null && !c.name().isBlank())
        ? c.name() + " (" + c.externalId() + ")"
        : c.externalId();

    String riskLabel = cddRiskScore >= 85 ? "CRITICAL"
        : cddRiskScore >= 70 ? "HIGH"
        : cddRiskScore >= 50 ? "MEDIUM"
        : "LOW";

    String priority = cddRiskScore >= 70 ? "high" : cddRiskScore >= 50 ? "medium" : "low";

    boolean isLowRisk = cddRiskScore < 50 && !hardSignal;

    String title = isLowRisk
        ? "Low risk customer requires completion of standard CDD due to missing mandatory KYC fields."
        : riskLabel + " RISK — " + customerLabel
            + " flagged during \"" + def.name() + "\" screening";

    String brief = isLowRisk
        ? customerLabel + " is a low-risk customer (score " + cddRiskScore + "/100) who requires completion "
            + "of standard Customer Due Diligence (CDD). The workflow identified missing mandatory KYC fields "
            + "that must be collected and verified before this customer's profile can be marked complete. "
            + "No elevated risk indicators were detected — this is a routine CDD completion task."
        : customerLabel + " was automatically screened through your \""
            + def.name() + "\" compliance workflow and produced a risk score of "
            + cddRiskScore + "/100 (" + riskLabel + "). "
            + "This customer requires Enhanced Due Diligence (EDD) — a deeper review of their identity, "
            + "source of funds, and business relationships before they can be onboarded or allowed to transact. "
            + "This case has been opened automatically so that your compliance team can carry out and document that review.";

    String notes = buildCaseNarrative(def, c, stepResults, cddRiskScore, riskLabel, concerns, hardSignal);

    return cases.create(caseId, def.institutionId(),
        title, brief,
        "CDD Workflow Screening", priority, cddRiskScore,
        null, notes, slaDeadline, def.createdBy(), "workflow_screening", null,
        c.externalId(), c.name())
        .map(cr -> cr.id())
        .onSuccess(id -> notifications.notifyCaseCreated(def.institutionId(), id, title, priority)
            .onFailure(e -> log.warn("[Workflows] Failed to notify case {}: {}", id, e.getMessage())));
  }

  private static String buildCaseNarrative(WorkflowDefinition def, WorkflowRepository.DueCustomer c,
      JsonArray stepResults, int cddRiskScore, String riskLabel, JsonArray concerns, boolean hardSignal) {

    String customerLabel = (c.name() != null && !c.name().isBlank()) ? c.name() : "Unknown";
    String today = java.time.LocalDate.now().toString();

    var sb = new StringBuilder();

    sb.append("AUTOMATED SCREENING REPORT\n");
    sb.append("==========================\n\n");

    boolean isLowRisk = cddRiskScore < 50 && !hardSignal;
    if (isLowRisk) {
      sb.append("ACTION REQUIRED: STANDARD CDD COMPLETION\n");
      sb.append("-----------------------------------------\n");
      sb.append("Low risk customer requires completion of standard CDD due to missing mandatory KYC fields. ");
      sb.append("This is a routine compliance task — no elevated risk indicators were detected. ");
      sb.append("Collect and verify the outstanding KYC fields, confirm the customer's identity documents are on file, ");
      sb.append("and mark each completed step in the CDD workflow. No Enhanced Due Diligence is required at this stage.\n\n");
    } else {
      sb.append("ACTION REQUIRED: ENHANCED DUE DILIGENCE (EDD)\n");
      sb.append("----------------------------------------------\n");
      sb.append("This customer's risk profile requires Enhanced Due Diligence before any account activity is permitted. ");
      sb.append("EDD means going beyond standard KYC checks — you must independently verify the customer's identity, ");
      sb.append("understand the nature and purpose of their account, and document the source of their funds. ");
      sb.append("All EDD findings must be recorded here and reviewed by a senior compliance officer or the CCO.\n\n");
    }

    // ── WHO WAS SCREENED ──────────────────────────────────────────────────────
    sb.append("WHO WAS SCREENED\n");
    sb.append("----------------\n");
    sb.append("Customer name : ").append(customerLabel).append("\n");
    sb.append("Customer ID   : ").append(c.externalId()).append("\n");
    if (c.bvn() != null && !c.bvn().isBlank())
      sb.append("BVN           : ").append(c.bvn()).append("\n");
    if (c.nin() != null && !c.nin().isBlank())
      sb.append("NIN           : ").append(c.nin()).append("\n");
    if (c.phone() != null && !c.phone().isBlank())
      sb.append("Phone         : ").append(c.phone()).append("\n");
    if (c.dob() != null && !c.dob().isBlank())
      sb.append("Date of birth : ").append(c.dob()).append("\n");
    sb.append("Screened on   : ").append(today).append("\n");
    sb.append("Workflow      : ").append(def.name()).append(" (version ").append(def.version()).append(")\n\n");

    // ── RISK SCORE ────────────────────────────────────────────────────────────
    sb.append("OVERALL RISK SCORE\n");
    sb.append("------------------\n");
    sb.append(cddRiskScore).append(" out of 100 — ").append(riskLabel).append("\n");
    if (cddRiskScore >= 85) {
      sb.append("This is an extremely high-risk profile. Immediate review is required. "
          + "Do not approve any transactions or account changes for this customer until this case is resolved.\n");
    } else if (cddRiskScore >= 70) {
      sb.append("This customer presents a high risk of financial crime or identity fraud. "
          + "All pending account actions should be paused until the findings below have been reviewed and a decision documented.\n");
    } else if (hardSignal) {
      sb.append("This case was opened because a hard-signal block detected a critical finding — ")
          .append(firstHardSignalLabel(stepResults))
          .append(". Regardless of the overall risk score, this type of finding always triggers an investigation case.\n");
    } else if (isLowRisk) {
      sb.append("This customer is low risk. The case was opened because one or more mandatory KYC fields are missing or incomplete. ")
          .append("Standard CDD completion is required — no enhanced review is needed at this stage.\n");
    } else {
      sb.append("This customer's risk score of ").append(cddRiskScore)
          .append(" met or crossed the investigation threshold set on this workflow (")
          .append(def.caseRiskThreshold()).append("). ")
          .append("The findings below explain what raised the score.\n");
    }
    sb.append("\n");

    // ── WHAT THE SCREENING FOUND ──────────────────────────────────────────────
    sb.append("WHAT THE SCREENING FOUND\n");
    sb.append("------------------------\n");
    for (int i = 0; i < stepResults.size(); i++) {
      JsonObject step = stepResults.getJsonObject(i);
      if (step == null) continue;
      String type   = step.getString("type",   "");
      String status = step.getString("status", "");
      String detail = step.getString("detail", "");
      Integer score = step.containsKey("score") ? step.getInteger("score") : null;

      if ("case".equals(type)) continue; // skip the case-opened meta step

      String icon   = "match".equals(status) ? "[FAILED]" : "not_found".equals(status) ? "[NOT FOUND]" : "[PASSED]";
      String label  = stepLabel(type);
      sb.append(icon).append(" ").append(label).append("\n");
      if (detail != null && !detail.isBlank())
        sb.append("   Finding   : ").append(detail).append("\n");
      if (score != null)
        sb.append("   Confidence: ").append(score).append("/100\n");
      sb.append("   ").append(stepPlainExplanation(type, status, score, detail)).append("\n\n");
    }

    // ── CONCERNS ──────────────────────────────────────────────────────────────
    if (concerns != null && !concerns.isEmpty()) {
      sb.append("ADDITIONAL CONCERNS\n");
      sb.append("-------------------\n");
      for (int i = 0; i < concerns.size(); i++) {
        JsonObject con = concerns.getJsonObject(i);
        if (con == null) continue;
        sb.append("• ").append(con.getString("message", "")).append("\n");
      }
      sb.append("\n");
    }

    // ── WHAT TO DO NEXT ───────────────────────────────────────────────────────
    sb.append("WHAT YOU SHOULD DO NEXT\n");
    sb.append("-----------------------\n");
    sb.append(buildNextSteps(stepResults, cddRiskScore));
    sb.append("\n");

    sb.append("SLA REMINDER\n");
    sb.append("------------\n");
    sb.append("This case must be reviewed and a decision documented within 7 days. "
        + "If no action is taken by then, this will be escalated automatically. "
        + "Even if you decide that the customer is low risk after manual review, you must document "
        + "your reasoning here — this protects your institution during a CBN audit.\n");

    return sb.toString();
  }

  private static String firstHardSignalLabel(JsonArray stepResults) {
    for (int i = 0; i < stepResults.size(); i++) {
      JsonObject s = stepResults.getJsonObject(i);
      if (s == null) continue;
      String type   = s.getString("type", "");
      String status = s.getString("status", "");
      if ("match".equals(status) && isHardSignalBlock(type))
        return stepLabel(type).toLowerCase();
    }
    return "a critical screening check";
  }

  private static String stepLabel(String type) {
    return switch (type) {
      case "identity_verify"      -> "Identity Verification (BVN / NIN)";
      case "pep_sanctions_screen" -> "PEP & Sanctions Screening";
      case "liveness_match"       -> "Facial Recognition Check";
      case "phone_basic"          -> "Phone Number Check";
      case "phone_fraud"          -> "Phone Fraud Intelligence";
      case "document_verify"      -> "Document Verification";
      default                     -> type;
    };
  }

  private static String stepPlainExplanation(String type, String status, Integer score, String detail) {
    boolean failed    = "match".equals(status);
    boolean notFound  = "not_found".equals(status);

    if (notFound) {
      return switch (type) {
        case "identity_verify" ->
            "We could not find a BVN or NIN record for this customer. "
            + "This could mean the number was entered incorrectly, is unregistered, or is fake. "
            + "Ask the customer to provide the correct BVN/NIN and rescreen.";
        case "pep_sanctions_screen" ->
            "Insufficient identity data was available to run a PEP/sanctions search. "
            + "Ensure the customer's full legal name and date of birth are on file before rescreening.";
        case "liveness_match" ->
            "No facial recognition data was provided, so we could not verify that the person completing "
            + "this onboarding is the same person on the identity document. The facial recognition check "
            + "must be completed and resolved manually by a compliance officer.";
        case "phone_basic", "phone_fraud" ->
            "No phone number was provided for this customer. "
            + "A valid phone number is required for fraud intelligence checks.";
        default -> "This check could not run because required data was missing.";
      };
    }

    if (failed) {
      return switch (type) {
        case "identity_verify" ->
            score != null && score < 40
            ? "The identity check failed with very low confidence (" + score + "/100). "
              + "The name, date of birth, or other details on the BVN/NIN record do not match "
              + "what the customer provided. This is a strong indicator of identity fraud or "
              + "use of someone else's credentials. Do not proceed with this customer until "
              + "they present an original, physical government-issued ID for manual verification."
            : "The identity check returned a mismatch. The name on the BVN/NIN record does not "
              + "closely match the customer's recorded name (confidence: "
              + (score != null ? score : "—") + "/100). "
              + "This may be a data-entry error or the customer may be using an ID that does not belong to them. "
              + "Request a physical ID and compare in person.";
        case "pep_sanctions_screen" ->
            "This customer's name was matched against international PEP and sanctions databases. "
            + "A PEP (Politically Exposed Person) is someone who holds or has held a prominent public position "
            + "and is considered higher risk for bribery and corruption. "
            + "A sanctions match means this customer may appear on a government or international watchlist. "
            + "You must conduct Enhanced Due Diligence (EDD) before this customer can transact. "
            + "If the match is confirmed, you are legally required to file a Suspicious Activity Report (SAR) with the NFIU.";
        case "liveness_match" ->
            "Facial recognition failed — the customer's face does not match the photo on their BVN or NIN record "
            + "(confidence: " + (score != null ? score : "—") + "/100). "
            + "This means the person completing this onboarding may not be the legitimate ID holder. "
            + "This is a serious fraud indicator — a third party may be using this customer's credentials. "
            + "A compliance officer must resolve this check manually after verifying the customer in person.";
        case "phone_basic" ->
            "The phone number provided is either inactive, unregistered, or the subscriber name "
            + "registered to it does not match the customer's identity. "
            + "Ask the customer to confirm their phone number and verify it matches their registered SIM.";
        case "phone_fraud" ->
            "This phone number has fraud signals associated with it. " + detail + ". "
            + "This could indicate the number has been used in previous fraud attempts, "
            + "or has been recently SIM-swapped. Treat any transactions from this customer "
            + "with heightened scrutiny and consider requesting an alternative contact number.";
        case "document_verify" ->
            "The identity document submitted by the customer failed verification. "
            + "This could mean the document is expired, tampered with, or does not belong to the customer. "
            + "Request the customer to present the original document at a branch for physical inspection.";
        default -> "This check failed. Review the finding detail above and take appropriate action.";
      };
    }

    // passed
    return switch (type) {
      case "identity_verify"      -> "Identity confirmed. The BVN/NIN record matches the customer's details.";
      case "pep_sanctions_screen" -> "No PEP or sanctions matches found. Customer is not on any watchlist.";
      case "liveness_match"       -> "Facial recognition confirmed. The customer's face matches their identity record and they are verified as the legitimate ID holder.";
      case "phone_basic"          -> "Phone is active and the registered subscriber name is consistent with the customer's identity.";
      case "phone_fraud"          -> "No fraud signals detected on this phone number.";
      case "document_verify"      -> "Document verified successfully.";
      default                     -> "This check passed.";
    };
  }

  private static String buildNextSteps(JsonArray stepResults, int cddRiskScore) {
    var sb = new StringBuilder();
    boolean hasPep      = false;
    boolean hasIdFail   = false;
    boolean hasLiveness = false;
    boolean hasPhone    = false;
    boolean hasDoc      = false;

    for (int i = 0; i < stepResults.size(); i++) {
      JsonObject s = stepResults.getJsonObject(i);
      if (s == null) continue;
      String type   = s.getString("type", "");
      String status = s.getString("status", "");
      boolean bad   = "match".equals(status) || "not_found".equals(status);
      if (!bad) continue;
      switch (type) {
        case "pep_sanctions_screen" -> hasPep      = true;
        case "identity_verify"      -> hasIdFail   = true;
        case "liveness_match"       -> hasLiveness = true;
        case "phone_basic",
             "phone_fraud"          -> hasPhone    = true;
        case "document_verify"      -> hasDoc      = true;
      }
    }

    int step = 1;
    sb.append(step++).append(". Open this customer's profile in openIV and read the full screening report above.\n");

    if (hasPep) {
      sb.append(step++).append(". PRIORITY — PEP/SANCTIONS HIT: Conduct Enhanced Due Diligence (EDD) immediately. "
          + "Verify whether the match is genuine or a false positive (common with shared names). "
          + "If confirmed, freeze any pending transactions and file a Suspicious Activity Report (SAR) with the NFIU "
          + "at www.nfiu.gov.ng. Document your findings here before taking any further action.\n");
    }

    if (hasLiveness) {
      sb.append(step++).append(". IDENTITY FRAUD RISK — Facial recognition check failed: Do not allow this customer "
          + "to conduct any transactions remotely. A compliance officer must manually resolve the facial recognition "
          + "check by verifying the customer in person with their original ID document (use Compare & Resolve in the customer profile).\n");
    }

    if (hasIdFail) {
      sb.append(step++).append(". IDENTITY MISMATCH: Request the customer to provide their original "
          + "BVN/NIN slip or any government-issued photo ID (national ID card, international passport, or driver's licence). "
          + "Compare the name and date of birth on the document against what is on file. "
          + "If they match, update the customer record and rescreen. If they do not match, escalate to your compliance officer.\n");
    }

    if (hasDoc) {
      sb.append(step++).append(". DOCUMENT ISSUE: The submitted document failed verification. "
          + "Ask the customer to bring the physical document to a branch for manual inspection. "
          + "Do not accept scanned or photographed copies until the original has been seen.\n");
    }

    if (hasPhone) {
      sb.append(step++).append(". PHONE CONCERN: Contact the customer on the number on file to confirm "
          + "they are the legitimate SIM owner. If the number is incorrect or they deny owning it, "
          + "update the contact details and flag the account for monitoring.\n");
    }

    if (cddRiskScore >= 70) {
      sb.append(step++).append(". Given the high risk score, place this customer's account under "
          + "enhanced transaction monitoring. Any transaction above ₦500,000 should require "
          + "manual approval until this case is closed.\n");
    }

    sb.append(step++).append(". Once you have completed your review, close this case with one of the following outcomes:\n"
        + "   - CLEARED: You reviewed the findings and are satisfied that the customer is legitimate. Document your reasons.\n"
        + "   - SAR FILED: You found credible evidence of suspicious activity and filed a report with the NFIU.\n"
        + "   - WATCHLISTED: The customer has been added to your internal watchlist pending further monitoring.\n");

    return sb.toString();
  }

  // ── Scoring helpers ───────────────────────────────────────────────────────

  /**
   * Weighted average of per-step authenticity scores → inverted to risk.
   * Steps with no score (null) are excluded. Returns 50 if no steps scored.
   */
  private static int computeCddRiskScore(JsonArray steps) {
    long weightedSum = 0, totalWeight = 0;
    for (int i = 0; i < steps.size(); i++) {
      JsonObject s = steps.getJsonObject(i);
      if (s == null) continue;
      String type = s.getString("type");
      if (!s.containsKey("score")) continue;  // null score — not scored
      int score = s.getInteger("score", -1);
      if (score < 0) continue;
      int w = s.containsKey("weight") ? s.getInteger("weight", 10) : STEP_WEIGHTS.getOrDefault(type, 10);
      weightedSum += (long) score * w;
      totalWeight += w;
    }
    if (totalWeight == 0) return 50;
    int authenticity = (int) (weightedSum / totalWeight);
    return Math.max(0, Math.min(100, 100 - authenticity));
  }

  /**
   * Collect concerns: 404 not-found gaps + name-mismatch warnings.
   * These are stored on the customer record and shown in the profile.
   */
  private static JsonArray buildConcerns(JsonArray steps) {
    JsonArray concerns = new JsonArray();
    for (int i = 0; i < steps.size(); i++) {
      JsonObject s = steps.getJsonObject(i);
      if (s == null) continue;
      String type   = s.getString("type", "");
      String status = s.getString("status", "");

      if ("not_found".equals(status)) {
        concerns.add(new JsonObject()
            .put("step",          type)
            .put("type",          "not_found")
            .put("field",         stepField(type))
            .put("message",       notFoundMessage(type))
            .put("resolveAction", "rescreen"));
      }

      // Identity verify passed but name match was weak
      if (WorkflowBlocks.IDENTITY_VERIFY.equals(type) && "pass".equals(status)
          && s.containsKey("score") && s.getInteger("score", 100) < 60) {
        concerns.add(new JsonObject()
            .put("step",    type)
            .put("type",    "name_mismatch")
            .put("field",   "name")
            .put("message", "Customer name does not closely match the name on the BVN/NIN record "
                + "(match score: " + s.getInteger("score") + "%). "
                + "Possible identity substitution or data-entry error.")
            .put("resolveAction", "investigate"));
      }

      // Phone basic active but subscriber name doesn't match
      if (WorkflowBlocks.PHONE_BASIC.equals(type) && "match".equals(status)
          && s.containsKey("score") && s.getInteger("score", 100) < 55) {
        concerns.add(new JsonObject()
            .put("step",    type)
            .put("type",    "phone_name_mismatch")
            .put("field",   "phone")
            .put("message", "Phone is active but the registered subscriber name does not match the "
                + "customer's identity record. Possible SIM-swap or number sharing.")
            .put("resolveAction", "investigate"));
      }

      // Phone fraud signals
      if (WorkflowBlocks.PHONE_FRAUD.equals(type) && "match".equals(status)) {
        concerns.add(new JsonObject()
            .put("step",    type)
            .put("type",    "fraud_signals")
            .put("field",   "phone")
            .put("message", "Fraud signals detected on this phone number: " + s.getString("detail", ""))
            .put("resolveAction", "investigate"));
      }
    }
    return concerns;
  }

  /** Fuzzy name match between the customer's recorded name and an ID-document name. */
  private static int scoreNameMatch(String customerName,
      String firstName, String lastName, String middleName) {
    if (customerName == null || customerName.isBlank()) return 70;
    if ((firstName == null || firstName.isBlank()) && (lastName == null || lastName.isBlank())) return 55;

    String idFull = Stream.of(firstName, middleName, lastName)
        .filter(s -> s != null && !s.isBlank())
        .map(s -> s.trim().toLowerCase())
        .collect(Collectors.joining(" "));

    String custLower = customerName.trim().toLowerCase();
    String[] idTokens   = idFull.split("\\s+");
    String[] custTokens = custLower.split("\\s+");

    long meaningful = Arrays.stream(custTokens).filter(t -> t.length() >= 2).count();
    if (meaningful == 0) return 60;

    long matched = Arrays.stream(custTokens)
        .filter(ct -> ct.length() >= 2)
        .filter(ct -> Arrays.stream(idTokens).anyMatch(it ->
            it.equals(ct) ||
            (ct.length() >= 3 && it.length() >= 3 &&
                (it.startsWith(ct.substring(0, Math.min(4, ct.length()))) ||
                 ct.startsWith(it.substring(0, Math.min(4, it.length())))))))
        .count();

    return (int) Math.round((double) matched / meaningful * 100);
  }

  private static String nameVerdict(int score) {
    if (score >= 80) return "Name matches record (" + score + "%).";
    if (score >= 60) return "Partial name match (" + score + "%) — minor discrepancy.";
    return "Name mismatch (" + score + "%) — customer name differs from identity record.";
  }

  private static String stepField(String type) {
    return switch (type) {
      case WorkflowBlocks.PHONE_BASIC, WorkflowBlocks.PHONE_FRAUD -> "phone";
      case WorkflowBlocks.IDENTITY_VERIFY -> "bvn_nin";
      default -> type;
    };
  }

  private static String notFoundMessage(String type) {
    return switch (type) {
      case WorkflowBlocks.PHONE_BASIC ->
          "Phone number not found in carrier registry. The number may be recently registered, "
          + "ported, or non-standard. Subscriber identity could not be verified.";
      case WorkflowBlocks.PHONE_FRAUD ->
          "Phone number not found in the fraud database. No fraud history record exists for this "
          + "number — this is not necessarily clean; the absence of a record is itself a concern.";
      default -> "Record not found — " + type + " check could not be completed.";
    };
  }

  // ── Step result builders ──────────────────────────────────────────────────

  /** Build a step result. score=null means not scored (not_found / error / skipped). */
  private static JsonObject step(String type, String status, String detail, long start, Integer score) {
    JsonObject j = new JsonObject()
        .put("type",   type)
        .put("status", status)
        .put("detail", detail)
        .put("ms",     System.currentTimeMillis() - start);
    if (score != null)            j.put("score",     score);
    if ("not_found".equals(status)) j.put("isConcern", true);
    return j;
  }

  /** Step result that also carries a BVN/NIN photo for the customer profile fallback. */
  private static JsonObject stepWithPhoto(String type, String status, String detail,
      long start, Integer score, String photo) {
    JsonObject j = step(type, status, detail, start, score);
    if (photo != null && !photo.isBlank()) j.put("idPhoto", photo); // stripped before persisting
    return j;
  }
}
