package com.openiv.backend.workflows;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.customers.CustomerService;
import com.openiv.backend.notifications.NotificationService;
import io.vertx.core.Future;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;

/**
 * Workflow lifecycle: draft → pending_approval → active → retired.
 *
 * Maker-checker (CBN 5.7.a.ii / 5.12.a.iv): the approver must be a different
 * user than the workflow's creator. Editing an active workflow never mutates
 * it — a new draft version is created instead, so every historical run keeps
 * pointing at the exact definition that executed.
 */
public final class WorkflowService {

  private final WorkflowRepository repository;
  private final UserRepository users;
  private final WorkflowExecutor executor;
  private final WorkflowAuditRepository audit;
  private final NotificationService notifications;
  private final CustomerService customers;

  public WorkflowService(WorkflowRepository repository, UserRepository users,
                         WorkflowExecutor executor, WorkflowAuditRepository audit,
                         NotificationService notifications, CustomerService customers) {
    this.repository    = repository;
    this.users         = users;
    this.executor      = executor;
    this.audit         = audit;
    this.notifications = notifications;
    this.customers     = customers;
  }

  public Future<List<WorkflowDefinition>> list(Session session) {
    return resolveUser(session).compose(u ->
        repository.seedIfEmpty(u.institutionId(), u.id())
            .compose(v -> repository.list(u.institutionId())));
  }

  public Future<Optional<WorkflowDefinition>> get(Session session, long id) {
    return resolveUser(session).compose(u -> repository.findById(id, u.institutionId()));
  }

  public Future<WorkflowDefinition> create(Session session, String name, JsonArray blocks,
      JsonObject schedule, Integer rescheduleDays, int caseRiskThreshold) {
    return resolveUser(session).compose(u -> {
      String err = validateBlocks(blocks);
      if (err != null) return Future.failedFuture(new IllegalArgumentException(err));
      String reschedErr = validateRescheduleDays(rescheduleDays);
      if (reschedErr != null) return Future.failedFuture(new IllegalArgumentException(reschedErr));
      return repository.create(u.institutionId(), name, blocks,
              schedule != null ? schedule : defaultSchedule(), u.id(), rescheduleDays,
              clampThreshold(caseRiskThreshold))
          .compose(def -> {
            audit.log(u.institutionId(), def.id(), def.name(), "create", u.id(),
                new JsonObject().put("version", def.version()));
            return Future.succeededFuture(def);
          });
    });
  }

  public Future<Optional<WorkflowDefinition>> updateDraft(
      Session session, long id, String name, JsonArray blocks, JsonObject schedule,
      boolean scheduleEnabled, Integer rescheduleDays, int caseRiskThreshold) {
    return resolveUser(session).compose(u -> {
      String err = validateBlocks(blocks);
      if (err != null) return Future.failedFuture(new IllegalArgumentException(err));
      String reschedErr = validateRescheduleDays(rescheduleDays);
      if (reschedErr != null) return Future.failedFuture(new IllegalArgumentException(reschedErr));
      return repository.updateDraft(id, u.institutionId(), name, blocks, schedule,
              scheduleEnabled, rescheduleDays, clampThreshold(caseRiskThreshold))
          .compose(opt -> {
            opt.ifPresent(def -> audit.log(u.institutionId(), def.id(), def.name(), "update", u.id(),
                new JsonObject().put("scheduleEnabled", scheduleEnabled)));
            return Future.succeededFuture(opt);
          });
    });
  }

  /** Delete a draft or pending-approval workflow. Active/retired cannot be deleted. */
  public Future<Boolean> delete(Session session, long id) {
    return resolveUser(session).compose(u ->
        repository.findById(id, u.institutionId()).compose(opt -> {
          if (opt.isEmpty()) return Future.succeededFuture(false);
          String name = opt.get().name();
          return repository.delete(id, u.institutionId()).compose(deleted -> {
            if (deleted) {
              audit.log(u.institutionId(), null, name, "delete", u.id(),
                  new JsonObject().put("deletedWorkflowId", id).put("status", opt.get().status()));
            }
            return Future.succeededFuture(deleted);
          });
        }));
  }

  /** Creator submits a draft for approval.
   *  Admin and CCO bypass maker-checker — the workflow is activated immediately. */
  public Future<Boolean> submit(Session session, long id) {
    return resolveUser(session).compose(u -> {
      boolean privileged = "admin".equalsIgnoreCase(u.role()) || "cco".equalsIgnoreCase(u.role());
      if (privileged) {
        // Activate directly: draft → active (skip pending_approval)
        return repository.findById(id, u.institutionId()).compose(opt -> {
          if (opt.isEmpty()) return Future.succeededFuture(false);
          WorkflowDefinition def = opt.get();
          return repository.findActiveByName(u.institutionId(), def.name(), id)
              .compose(prevActiveOpt ->
                  repository.updateStatus(id, u.institutionId(),
                          WorkflowDefinition.STATUS_DRAFT, WorkflowDefinition.STATUS_ACTIVE, u.id())
                      .compose(ok -> {
                        if (!ok) return Future.succeededFuture(false);
                        audit.log(u.institutionId(), id, def.name(), "approve", u.id(),
                            new JsonObject().put("auto", true).put("reason", "creator is " + u.role()));
                        String actorName = u.fullName() != null ? u.fullName() : u.email();
                        notifications.notifyWorkflowApproved(u.institutionId(), id, def.name(), actorName);
                        Future<Void> rebind = prevActiveOpt.isPresent()
                            ? customers.rebindWorkflowCustomers(u.institutionId(), prevActiveOpt.get().id(), id)
                            : Future.succeededFuture();
                        return rebind
                            .compose(v -> repository.retireActiveByName(u.institutionId(), def.name(), id))
                            .map(true);
                      }));
        });
      }
      return repository.updateStatus(id, u.institutionId(),
              WorkflowDefinition.STATUS_DRAFT, WorkflowDefinition.STATUS_PENDING, null)
          .compose(ok -> {
            if (ok) repository.findById(id, u.institutionId())
                .onSuccess(opt -> opt.ifPresent(def -> {
                  audit.log(u.institutionId(), id, def.name(), "submit", u.id(), new JsonObject());
                  String actorName = u.fullName() != null ? u.fullName() : u.email();
                  notifications.notifyWorkflowSubmitted(u.institutionId(), id, def.name(), actorName);
                }));
            return Future.succeededFuture(ok);
          });
    });
  }

  /**
   * Approve a pending workflow — must be a different user than the creator.
   * Activating retires any previously-active version of the same name.
   */
  public Future<Boolean> approve(Session session, long id) {
    return resolveUser(session).compose(u ->
        repository.findById(id, u.institutionId()).compose(opt -> {
          if (opt.isEmpty()) return Future.succeededFuture(false);
          WorkflowDefinition def = opt.get();
          if (def.createdBy() == u.id()) {
            return Future.failedFuture(new IllegalStateException(
                "Maker-checker: a workflow cannot be approved by its creator"));
          }
          // Capture the current active version before promoting the new one.
          return repository.findActiveByName(u.institutionId(), def.name(), id)
              .compose(prevActiveOpt ->
                  repository.updateStatus(id, u.institutionId(),
                          WorkflowDefinition.STATUS_PENDING, WorkflowDefinition.STATUS_ACTIVE, u.id())
                      .compose(ok -> {
                        if (!ok) return Future.succeededFuture(false);
                        audit.log(u.institutionId(), id, def.name(), "approve", u.id(),
                            new JsonObject().put("createdBy", def.createdBy()));
                        String actorName = u.fullName() != null ? u.fullName() : u.email();
                        notifications.notifyWorkflowApproved(u.institutionId(), id, def.name(), actorName);
                        // Rebind customers from the old version to the new one, then retire the old.
                        Future<Void> rebind = prevActiveOpt.isPresent()
                            ? customers.rebindWorkflowCustomers(u.institutionId(), prevActiveOpt.get().id(), id)
                            : Future.succeededFuture();
                        return rebind
                            .compose(v -> repository.retireActiveByName(u.institutionId(), def.name(), id))
                            .map(true);
                      }));
        }));
  }

  public Future<Boolean> retire(Session session, long id) {
    return resolveUser(session).compose(u ->
        repository.updateStatus(id, u.institutionId(),
                WorkflowDefinition.STATUS_ACTIVE, WorkflowDefinition.STATUS_RETIRED, null)
            .compose(ok -> {
              if (!ok) return Future.succeededFuture(false);
              return repository.findById(id, u.institutionId())
                  .compose(opt -> {
                    opt.ifPresent(def ->
                        audit.log(u.institutionId(), id, def.name(), "retire", u.id(), new JsonObject()));
                    // Flag customers of this workflow as needing enrichment — they cannot be
                    // re-screened until re-onboarded through a workflow matching their data.
                    return customers.flagEnrichmentNeeded(u.institutionId(), id)
                        .map(true);
                  });
            }));
  }

  /** Editing an active workflow: clone it into a new draft version. */
  public Future<WorkflowDefinition> newVersion(Session session, long id) {
    return resolveUser(session).compose(u ->
        repository.findById(id, u.institutionId()).compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("Workflow not found"));
          return repository.createNextVersion(opt.get(), u.id())
              .compose(def -> {
                audit.log(u.institutionId(), def.id(), def.name(), "new_version", u.id(),
                    new JsonObject().put("version", def.version()).put("fromId", id));
                return Future.succeededFuture(def);
              });
        }));
  }

  /** Manual run over all currently-due customers. */
  public Future<Long> runNow(Session session, long id) {
    return resolveUser(session).compose(u ->
        repository.findById(id, u.institutionId()).compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("Workflow not found"));
          WorkflowDefinition def = opt.get();
          if (!WorkflowDefinition.STATUS_ACTIVE.equals(def.status())) {
            return Future.failedFuture(new IllegalStateException("Only active workflows can be run"));
          }
          JsonObject s = def.schedule();
          return repository.listDueCustomers(u.institutionId(),
                  s.getInteger("highDays", 30), s.getInteger("mediumDays", 90),
                  s.getInteger("lowDays", 365), 500)
              .compose(due -> executor.executeRun(def, "manual", due))
              .compose(runId -> {
                audit.log(u.institutionId(), id, def.name(), "run_now", u.id(),
                    new JsonObject().put("runId", runId));
                return Future.succeededFuture(runId);
              });
        }));
  }

  /**
   * Streaming import: validates the batch then delegates to executeRunStreaming,
   * invoking onCustomer after each record so the HTTP handler can SSE-push results.
   */
  public Future<JsonObject> importBatchStream(long institutionId, long workflowId,
      JsonArray customers, java.util.function.Consumer<JsonObject> onCustomer) {
    return repository.findById(workflowId, institutionId).compose(opt -> {
      if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("Workflow not found"));
      WorkflowDefinition def = opt.get();
      if (!WorkflowDefinition.STATUS_ACTIVE.equals(def.status()))
        return Future.failedFuture(new IllegalStateException("Only active workflows accept import batches"));
      if (customers == null || customers.isEmpty())
        return Future.failedFuture(new IllegalArgumentException("customers array is required and must not be empty"));

      var due = new ArrayList<WorkflowRepository.DueCustomer>(customers.size());
      var seenIds = new LinkedHashMap<String, Integer>(); // externalId → first index
      for (int i = 0; i < customers.size(); i++) {
        JsonObject c = customers.getJsonObject(i);
        String externalId = resolveCustomerId(c);
        if (externalId == null || externalId.isBlank())
          return Future.failedFuture(new IllegalArgumentException("customers[" + i + "].customerId is required"));
        if (seenIds.containsKey(externalId))
          return Future.failedFuture(new IllegalArgumentException(
              "customers[" + seenIds.get(externalId) + "] and customers[" + i
              + "]: duplicate customerId '" + externalId + "' in the same batch"));
        seenIds.put(externalId, i);
        due.add(new WorkflowRepository.DueCustomer(
            externalId,
            resolveName(c),
            c.getString("phone"),
            resolveId(c, "bvn"),
            resolveId(c, "nin"),
            c.getString("dob"),
            c.getInteger("riskScore", 0),
            c.getString("selfie"),
            c.getString("docFront"),
            c.getString("docBack")));
      }

      return this.customers.findCredentialConflicts(institutionId, new ArrayList<>(seenIds.keySet()))
          .compose(existing -> {
            for (int i = 0; i < due.size(); i++) {
              WorkflowRepository.DueCustomer d = due.get(i);
              String[] stored = existing.get(d.externalId());
              if (stored == null) continue;
              String storedBvn = stored[0], storedNin = stored[1];
              if (d.bvn() != null && !d.bvn().isBlank() && storedBvn != null && !d.bvn().equals(storedBvn))
                return Future.failedFuture(new IllegalArgumentException(
                    "customers[" + i + "]: customerId '" + d.externalId()
                    + "' is already registered with a different BVN"));
              if (d.nin() != null && !d.nin().isBlank() && storedNin != null && !d.nin().equals(storedNin))
                return Future.failedFuture(new IllegalArgumentException(
                    "customers[" + i + "]: customerId '" + d.externalId()
                    + "' is already registered with a different NIN"));
            }
            return executor.executeRunStreaming(def, "import", due, onCustomer);
          })
          .compose(runId -> {
        audit.log(institutionId, workflowId, def.name(), "import", null,
            new JsonObject().put("runId", runId).put("totalCustomers", due.size()));
        return Future.succeededFuture(new JsonObject()
            .put("runId", runId)
            .put("totalCustomers", due.size()));
      });
    });
  }

  /**
   * API-key-authenticated batch import. Caller supplies customer records including
   * optional image fields (selfie, docFront, docBack) that scheduled runs cannot provide.
   * Only active workflows accept imports.
   */
  public Future<JsonObject> importBatch(long institutionId, long workflowId, JsonArray customers) {
    return repository.findById(workflowId, institutionId).compose(opt -> {
      if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("Workflow not found"));
      WorkflowDefinition def = opt.get();
      if (!WorkflowDefinition.STATUS_ACTIVE.equals(def.status()))
        return Future.failedFuture(new IllegalStateException("Only active workflows accept import batches"));
      if (customers == null || customers.isEmpty())
        return Future.failedFuture(new IllegalArgumentException("customers array is required and must not be empty"));

      var due = new ArrayList<WorkflowRepository.DueCustomer>(customers.size());
      var seenIds = new LinkedHashMap<String, Integer>();
      for (int i = 0; i < customers.size(); i++) {
        JsonObject c = customers.getJsonObject(i);
        String externalId = resolveCustomerId(c);
        if (externalId == null || externalId.isBlank())
          return Future.failedFuture(new IllegalArgumentException("customers[" + i + "].customerId is required"));
        if (seenIds.containsKey(externalId))
          return Future.failedFuture(new IllegalArgumentException(
              "customers[" + seenIds.get(externalId) + "] and customers[" + i
              + "]: duplicate customerId '" + externalId + "' in the same batch"));
        seenIds.put(externalId, i);
        due.add(new WorkflowRepository.DueCustomer(
            externalId,
            resolveName(c),
            c.getString("phone"),
            resolveId(c, "bvn"),
            resolveId(c, "nin"),
            c.getString("dob"),
            c.getInteger("riskScore", 0),
            c.getString("selfie"),
            c.getString("docFront"),
            c.getString("docBack")));
      }

      return this.customers.findCredentialConflicts(institutionId, new ArrayList<>(seenIds.keySet()))
          .compose(existing -> {
            for (int i = 0; i < due.size(); i++) {
              WorkflowRepository.DueCustomer d = due.get(i);
              String[] stored = existing.get(d.externalId());
              if (stored == null) continue;
              String storedBvn = stored[0], storedNin = stored[1];
              if (d.bvn() != null && !d.bvn().isBlank() && storedBvn != null && !d.bvn().equals(storedBvn))
                return Future.failedFuture(new IllegalArgumentException(
                    "customers[" + i + "]: customerId '" + d.externalId()
                    + "' is already registered with a different BVN"));
              if (d.nin() != null && !d.nin().isBlank() && storedNin != null && !d.nin().equals(storedNin))
                return Future.failedFuture(new IllegalArgumentException(
                    "customers[" + i + "]: customerId '" + d.externalId()
                    + "' is already registered with a different NIN"));
            }
            return executor.executeRun(def, "import", due);
          })
          .compose(runId -> {
        audit.log(institutionId, workflowId, def.name(), "import", null,
            new JsonObject().put("runId", runId).put("totalCustomers", due.size()));
        return Future.succeededFuture(new JsonObject()
            .put("runId", runId)
            .put("totalCustomers", due.size()));
      });
    });
  }

  public Future<JsonObject> payloadSchema(Session session, long id) {
    return resolveUser(session).compose(u ->
        repository.findById(id, u.institutionId()).compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("Workflow not found"));
          return Future.succeededFuture(WorkflowBlocks.payloadSchema(opt.get().blocks()));
        }));
  }

  public Future<JsonObject> estimate(Session session, long id) {
    return resolveUser(session).compose(u ->
        repository.findById(id, u.institutionId()).compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("Workflow not found"));
          JsonObject s = opt.get().schedule();
          return repository.tierCounts(u.institutionId()).map(counts -> {
            double monthly =
                counts.getLong("high")   * (30.0 / Math.max(1, s.getInteger("highDays", 30)))
              + counts.getLong("medium") * (30.0 / Math.max(1, s.getInteger("mediumDays", 90)))
              + counts.getLong("low")    * (30.0 / Math.max(1, s.getInteger("lowDays", 365)));
            return new JsonObject()
                .put("tierCounts", counts)
                .put("estimatedScreeningsPerMonth", Math.round(monthly));
          });
        }));
  }

  public Future<JsonArray> listRuns(Session session, long workflowId) {
    return resolveUser(session).compose(u -> repository.listRuns(u.institutionId(), workflowId, 50));
  }

  public Future<JsonArray> listRunItems(Session session, long runId, int limit, int offset) {
    return resolveUser(session).compose(u -> repository.listRunItems(u.institutionId(), runId, limit, offset));
  }

  public Future<Long> enrichmentCount(Session session) {
    return resolveUser(session).compose(u -> customers.countNeedsEnrichment(u.institutionId()));
  }

  public Future<String> rescreenCustomer(Session session, String externalId) {
    return resolveUser(session).compose(u -> executor.rescreenSingle(u.institutionId(), externalId));
  }

  /** Trigger a manual CDD run for every customer in the institution (up to 2000). */
  public Future<io.vertx.core.json.JsonObject> rescreenAll(Session session) {
    return resolveUser(session).compose(u -> {
      long instId = u.institutionId();
      return repository.list(instId).compose(defs -> {
        var active = defs.stream().filter(d -> "active".equals(d.status())).toList();
        if (active.isEmpty())
          return Future.failedFuture(new IllegalStateException("No active workflow found for institution"));
        WorkflowDefinition def = active.get(0);
        return repository.listAllForRescreen(instId, 2000).compose(customers -> {
          if (customers.isEmpty())
            return Future.succeededFuture(new io.vertx.core.json.JsonObject()
                .put("runId", (Object) null).put("totalCustomers", 0).put("message", "No customers to evaluate"));
          // Fire run asynchronously — return runId immediately
          return executor.executeRun(def, "manual_all", customers)
              .map(runId -> new io.vertx.core.json.JsonObject()
                  .put("runId",          runId)
                  .put("totalCustomers", customers.size())
                  .put("message",        "Re-evaluation started for " + customers.size() + " customers"));
        });
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static JsonObject defaultSchedule() {
    return new JsonObject().put("highDays", 30).put("mediumDays", 90).put("lowDays", 365);
  }

  private static String validateBlocks(JsonArray blocks) {
    return WorkflowBlocks.validate(blocks);
  }

  private static String validateRescheduleDays(Integer days) {
    if (days == null) return null;
    if (days < 14 || days > 90) return "rescheduleDays must be between 14 and 90";
    return null;
  }

  /** Keeps caseRiskThreshold within the valid range of 30–95. */
  private static int clampThreshold(int t) {
    return Math.max(30, Math.min(95, t));
  }

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")));
  }

  /**
   * Resolves BVN or NIN from an import customer object.
   * Accepts the explicit field ("bvn"/"nin") or the generic id/id_type pair.
   * id_type is matched case-insensitively so "BVN", "bvn", "Bvn" all work.
   */
  /** Accepts "customerId" (preferred) or legacy "externalId". */
  private static String resolveCustomerId(JsonObject c) {
    String v = c.getString("customerId");
    if (v != null && !v.isBlank()) return v.trim();
    v = c.getString("externalId");
    if (v != null && !v.isBlank()) return v.trim();
    return null;
  }

  /**
   * Resolves the customer's full name from firstName/lastName/middleName
   * (preferred) or falls back to the legacy "name" field.
   */
  private static String resolveName(JsonObject c) {
    String first  = c.getString("firstName",  "").trim();
    String last   = c.getString("lastName",   "").trim();
    String middle = c.getString("middleName", "").trim();
    if (!first.isBlank() || !last.isBlank()) {
      return java.util.stream.Stream.of(first, middle, last)
          .filter(s -> !s.isBlank())
          .collect(java.util.stream.Collectors.joining(" "));
    }
    String name = c.getString("name", "").trim();
    return name.isBlank() ? null : name;
  }

  private static String resolveId(JsonObject c, String field) {
    String direct = c.getString(field);
    if (direct != null && !direct.isBlank()) return direct.trim();
    String idType = c.getString("id_type");
    if (idType != null && idType.trim().equalsIgnoreCase(field)) {
      String id = c.getString("id");
      if (id != null && !id.isBlank()) return id.trim();
    }
    return null;
  }
}
