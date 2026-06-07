package com.openiv.backend.cases;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.billing.PlanGuard;
import com.openiv.backend.billing.PlanLimitException;
import com.openiv.backend.transactions.Transaction;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.util.Set;

public final class CaseHandlers {

  private final CaseService service;

  public CaseHandlers(CaseService service) {
    this.service = service;
  }

  // GET /cases/metrics
  public Handler<RoutingContext> metrics() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.metrics(session)
          .onSuccess(m -> ok(ctx, new JsonObject()
              .put("openCount",      m.openCount())
              .put("escalatedCount", m.escalatedCount())
              .put("closedToday",    m.closedToday())
              .put("avgCloseHours",  m.avgCloseHours())))
          .onFailure(ctx::fail);
    };
  }

  // GET /cases
  public Handler<RoutingContext> list() {
    return ctx -> {
      var session  = SessionAuthHandler.require(ctx);
      String status   = first(ctx, "status");
      String priority = first(ctx, "priority");
      String q        = first(ctx, "q");
      int page        = intParam(ctx, "page", 1);
      int pageSize    = Math.min(intParam(ctx, "pageSize", 20), 100);
      String sort     = first(ctx, "sort");
      String range    = first(ctx, "range");
      Integer minRisk = intParamOrNull(ctx, "minRisk");
      Integer maxRisk = intParamOrNull(ctx, "maxRisk");
      Boolean assignedToMe   = "true".equals(first(ctx, "assignedToMe")) ? Boolean.TRUE : null;
      Long    assignedToUser = longParamOrNull(ctx, "assignedToUser");
      Boolean hasInterest    = "true".equals(first(ctx, "hasInterest")) ? Boolean.TRUE : null;

      service.list(session, status, priority, q, page, pageSize, sort, range, minRisk, maxRisk,
              assignedToMe, assignedToUser, hasInterest)
          .onSuccess(result -> {
            var arr = new JsonArray();
            result.cases().forEach(c -> arr.add(caseJson(c)));
            ok(ctx, new JsonObject()
                .put("cases",    arr)
                .put("total",    result.total())
                .put("page",     result.page())
                .put("pageSize", result.pageSize()));
          })
          .onFailure(ctx::fail);
    };
  }

  // POST /cases/:id/assign
  public Handler<RoutingContext> assignCase() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String caseId = ctx.pathParam("id");
      JsonObject body = body(ctx);
      if (body == null) return;

      Long toUserId = body.getLong("toUserId"); // null = assign to self
      service.assignCase(session, caseId, toUserId)
          .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
          .onFailure(ctx::fail);
    };
  }

  // GET /cases/pending-approval
  public Handler<RoutingContext> listPendingApproval() {
    return ctx -> {
      var session  = SessionAuthHandler.require(ctx);
      String status   = first(ctx, "status");
      String priority = first(ctx, "priority");
      String q        = first(ctx, "q");
      int page        = intParam(ctx, "page", 1);
      int pageSize    = Math.min(intParam(ctx, "pageSize", 20), 100);
      String sort     = first(ctx, "sort");
      String range    = first(ctx, "range");
      Integer minRisk = intParamOrNull(ctx, "minRisk");
      Integer maxRisk = intParamOrNull(ctx, "maxRisk");

      service.listUnavailable(session, status, priority, q, page, pageSize, sort, range, minRisk, maxRisk)
          .onSuccess(result -> {
            var arr = new JsonArray();
            result.cases().forEach(c -> arr.add(caseJson(c)));
            ok(ctx, new JsonObject()
                .put("cases",    arr)
                .put("total",    result.total())
                .put("page",     result.page())
                .put("pageSize", result.pageSize()));
          })
          .onFailure(ctx::fail);
    };
  }

  // POST /cases
  public Handler<RoutingContext> create() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;

      String title    = body.getString("title");
      String typology = body.getString("typology");
      if (title == null || title.isBlank())       { badRequest(ctx, "title is required");    return; }
      if (typology == null || typology.isBlank()) { badRequest(ctx, "typology is required"); return; }

      String priority     = nvl(body.getString("priority"), "medium");
      int    riskScore    = body.getInteger("riskScore", 0);
      Long   assignedTo   = body.getLong("assignedTo");
      String notes        = body.getString("notes");
      String transactionId = body.getString("transactionId");
      String reason        = body.getString("reason");
      Long   documentId    = body.getLong("documentId");
      String customerId    = body.getString("customerId");
      String customerName  = body.getString("customerName");
      if (reason == null || reason.isBlank()) { badRequest(ctx, "reason is required");     return; }
      if (documentId == null)                 { badRequest(ctx, "documentId is required"); return; }

      service.create(session, title, typology, priority, riskScore, assignedTo, notes,
          transactionId, reason, documentId, customerId, customerName)
          .onSuccess(cas -> ok(ctx, new JsonObject().put("case", caseJson(cas))))
          .onFailure(err -> {
            if (err instanceof PlanLimitException pex) {
              String planLabel = pex.currentPlan().isEmpty() ? pex.currentPlan()
                  : Character.toUpperCase(pex.currentPlan().charAt(0)) + pex.currentPlan().substring(1);
              PlanGuard.planLimitResponse(ctx, pex.feature(), pex.currentPlan(), pex.requiredPlan(),
                  "You have reached your active case limit for the "
                  + planLabel + " plan. Upgrade to open more cases.");
            } else {
              ctx.fail(err);
            }
          });
    };
  }

  // GET /cases/:id
  public Handler<RoutingContext> detail() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String id = ctx.pathParam("id");
      service.detail(session, id)
          .onSuccess(opt -> {
            if (opt.isEmpty()) { ctx.fail(404); return; }
            CaseDetail d = opt.get();
            var txns = new JsonArray();
            d.transactions().forEach(t -> txns.add(txnJson(t)));
            var acts = new JsonArray();
            d.activity().forEach(a -> acts.add(actJson(a)));
            var evs = new JsonArray();
            d.evidence().forEach(e -> evs.add(evidenceJson(e)));
            ok(ctx, new JsonObject()
                .put("case",         caseJson(d.cas()))
                .put("transactions", txns)
                .put("activity",     acts)
                .put("evidence",     evs));
          })
          .onFailure(ctx::fail);
    };
  }

  // GET /transactions/:id/case
  public Handler<RoutingContext> forTransaction() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String txnId = ctx.pathParam("id");
      service.findByTransactionId(session, txnId)
          .onSuccess(opt -> ok(ctx, new JsonObject()
              .put("case", opt.isPresent() ? caseJson(opt.get()) : null)))
          .onFailure(ctx::fail);
    };
  }

  // POST /cases/:id/evidence
  public Handler<RoutingContext> addEvidence() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String caseId = ctx.pathParam("id");
      JsonObject body = body(ctx);
      if (body == null) return;

      String category = body.getString("category");
      String title    = body.getString("title");
      String detail   = body.getString("detail");
      String refId    = body.getString("refId");

      if (category == null || !Set.of("transaction","kyc","behavior","device","otp","document","other").contains(category)) {
        badRequest(ctx, "invalid category"); return;
      }
      if (title == null || title.isBlank()) { badRequest(ctx, "title is required"); return; }

      service.addEvidence(session, caseId, category, title, detail, refId)
          .onSuccess(ev -> ok(ctx, new JsonObject().put("ok", true).put("id", ev.id())))
          .onFailure(ctx::fail);
    };
  }

  // PATCH /cases/:id/status
  public Handler<RoutingContext> updateStatus() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String id = ctx.pathParam("id");
      JsonObject body = body(ctx);
      if (body == null) return;

      String newStatus  = body.getString("status");
      String resolution = body.getString("resolution");
      String reason     = body.getString("reason");
      Long   documentId = body.getLong("documentId");

      if (newStatus == null || !Set.of("open","investigating","escalated","pending_review","closed").contains(newStatus)) {
        badRequest(ctx, "invalid status value"); return;
      }
      if ("closed".equals(newStatus) && (resolution == null || resolution.isBlank())) {
        badRequest(ctx, "resolution required when closing a case"); return;
      }
      // reason is optional for the investigating transition (acknowledgment flow)
      String effectiveReason = (reason != null && !reason.isBlank())
          ? reason : "Investigation initiated";
      if (!("investigating".equals(newStatus)) && (reason == null || reason.isBlank())) {
        badRequest(ctx, "reason is required"); return;
      }

      service.updateStatus(session, id, newStatus, resolution, effectiveReason, documentId)
          .onSuccess(updated -> {
            if (!updated) { ctx.fail(404); return; }
            ok(ctx, new JsonObject().put("ok", true));
          })
          .onFailure(ctx::fail);
    };
  }

  // POST /cases/:id/transactions
  public Handler<RoutingContext> linkTransaction() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String caseId = ctx.pathParam("id");
      JsonObject body = body(ctx);
      if (body == null) return;

      String txnId = body.getString("transactionId");
      if (txnId == null || txnId.isBlank()) { badRequest(ctx, "transactionId required"); return; }

      service.linkTransaction(session, caseId, txnId)
          .onSuccess(ok -> ok(ctx, new JsonObject().put("ok", ok)))
          .onFailure(ctx::fail);
    };
  }

  // POST /cases/:id/notes
  public Handler<RoutingContext> addNote() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String caseId = ctx.pathParam("id");
      JsonObject body = body(ctx);
      if (body == null) return;

      String note = body.getString("note");
      if (note == null || note.isBlank()) { badRequest(ctx, "note is required"); return; }

      service.addNote(session, caseId, note)
          .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
          .onFailure(ctx::fail);
    };
  }

  // PATCH /cases/:id/link-nfiu-report
  public Handler<RoutingContext> linkNfiuReport() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String caseId = ctx.pathParam("id");
      JsonObject body = body(ctx);
      if (body == null) return;

      Long nfiuReportId = body.getLong("nfiuReportId");
      if (nfiuReportId == null) { badRequest(ctx, "nfiuReportId is required"); return; }

      service.linkNfiuReport(session, caseId, nfiuReportId)
          .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
          .onFailure(ctx::fail);
    };
  }

  // PATCH /cases/:id/seen
  public Handler<RoutingContext> markSeen() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String caseId = ctx.pathParam("id");
      service.markSeen(session, caseId)
          .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
          .onFailure(ctx::fail);
    };
  }

  public Handler<RoutingContext> unassignedCount() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.unassignedCount(session)
          .onSuccess(count -> ok(ctx, new JsonObject().put("count", count)))
          .onFailure(ctx::fail);
    };
  }

  public Handler<RoutingContext> unseenCount() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.unseenCount(session)
          .onSuccess(count -> ok(ctx, new JsonObject().put("count", count)))
          .onFailure(ctx::fail);
    };
  }

  // POST /cases/:id/interest
  public Handler<RoutingContext> expressInterest() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String caseId = ctx.pathParam("id");
      service.expressInterest(session, caseId)
          .onSuccess(expressed -> ok(ctx, new JsonObject().put("ok", expressed)))
          .onFailure(ctx::fail);
    };
  }

  // GET /cases/:id/interests
  public Handler<RoutingContext> listInterests() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String caseId = ctx.pathParam("id");
      service.listInterests(session, caseId)
          .onSuccess(interests -> {
            var arr = new JsonArray();
            interests.forEach(i -> arr.add(interestJson(i)));
            ok(ctx, new JsonObject().put("interests", arr));
          })
          .onFailure(ctx::fail);
    };
  }

  // POST /cases/:id/interests/:userId/accept
  public Handler<RoutingContext> acceptInterest() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String caseId = ctx.pathParam("id");
      long userId;
      try { userId = Long.parseLong(ctx.pathParam("userId")); }
      catch (NumberFormatException e) { badRequest(ctx, "invalid userId"); return; }
      service.acceptInterest(session, caseId, userId)
          .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
          .onFailure(ctx::fail);
    };
  }

  // GET /cases/:id/my-interest
  public Handler<RoutingContext> myInterest() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String caseId = ctx.pathParam("id");
      service.myInterest(session, caseId)
          .onSuccess(opt -> ok(ctx, new JsonObject()
              .put("interest", opt.map(CaseHandlers::interestJson).orElse(null))))
          .onFailure(ctx::fail);
    };
  }

  // GET /cases/analytics
  public Handler<RoutingContext> analytics() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String range = first(ctx, "range");
      service.analytics(session, range)
          .onSuccess(data -> ok(ctx, data))
          .onFailure(ctx::fail);
    };
  }

  // ── JSON serialisers ─────────────────────────────────────────────────────

  private static JsonObject caseJson(CaseRecord c) {
    JsonObject o = new JsonObject()
        .put("id",            c.id())
        .put("title",         c.title())
        .put("typology",      c.typology())
        .put("status",        c.status())
        .put("priority",      c.priority())
        .put("riskScore",     c.riskScore())
        .put("notes",         c.notes())
        .put("resolution",    c.resolution())
        .put("createdBy",     c.createdBy())
        .put("createdByName", c.createdByName())
        .put("slaDeadline",   c.slaDeadline().toString())
        .put("closedAt",      c.closedAt()  != null ? c.closedAt().toString()  : null)
        .put("createdAt",     c.createdAt().toString())
        .put("updatedAt",     c.updatedAt().toString())
        .put("seen",          c.seen())
        .put("brief",         c.brief())
        .put("isAvailableForInvestigation", c.isAvailableForInvestigation())
        .put("linkedNfiuReportId", c.linkedNfiuReportId())
        .put("customerId",   c.customerId())
        .put("customerName", c.customerName())
        .put("hasPendingInterest", c.hasPendingInterest());
    if (c.assignedTo() != null) {
      o.put("assignedTo",   c.assignedTo());
      o.put("assigneeName", c.assigneeName());
    }
    return o;
  }

  private static JsonObject actJson(CaseActivity a) {
    return new JsonObject()
        .put("id",        a.id())
        .put("actorId",   a.actorId())
        .put("actorName", a.actorName())
        .put("actorRole", a.actorRole())
        .put("action",    a.action())
        .put("detail",    a.detail())
        .put("createdAt", a.createdAt().toString());
  }

  private static JsonObject evidenceJson(CaseEvidence e) {
    return new JsonObject()
        .put("id",          e.id())
        .put("caseId",      e.caseId())
        .put("addedBy",     e.addedBy())
        .put("addedByName", e.addedByName())
        .put("category",    e.category())
        .put("title",       e.title())
        .put("detail",      e.detail())
        .put("refId",       e.refId())
        .put("createdAt",   e.createdAt().toString());
  }

  private static JsonObject interestJson(CaseInterest i) {
    return new JsonObject()
        .put("id",        i.id())
        .put("caseId",    i.caseId())
        .put("userId",    i.userId())
        .put("userName",  i.userName())
        .put("status",    i.status())
        .put("createdAt", i.createdAt().toString());
  }

  private static JsonObject txnJson(Transaction t) {
    JsonObject o = new JsonObject()
        .put("id",          t.id())
        .put("customerId",  t.customerId())
        .put("customer",    t.customerName())
        .put("amount",      t.amount().longValue())
        .put("channel",     t.channel())
        .put("counterparty",t.counterparty())
        .put("occurredAt",  t.occurredAt() != null ? t.occurredAt().toString() : null)
        .put("risk",        t.riskScore())
        .put("status",      t.status())
        .put("currency",    t.currency() != null ? t.currency() : "NGN");
    if (t.flaggedStatus()    != null) o.put("flaggedStatus",    t.flaggedStatus());
    if (t.senderAccount()    != null) o.put("senderAccount",    t.senderAccount());
    if (t.senderBank()       != null) o.put("senderBank",       t.senderBank());
    if (t.recipientName()    != null) o.put("recipientName",    t.recipientName());
    if (t.recipientAccount() != null) o.put("recipientAccount", t.recipientAccount());
    if (t.recipientBank()    != null) o.put("recipientBank",    t.recipientBank());
    if (t.narration()        != null) o.put("narration",        t.narration());
    return o;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static void ok(RoutingContext ctx, JsonObject body) {
    ctx.response().setStatusCode(200)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }

  private static void badRequest(RoutingContext ctx, String msg) {
    ctx.response().setStatusCode(400)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(new JsonObject().put("error", msg).encode());
  }

  private static JsonObject body(RoutingContext ctx) {
    try {
      JsonObject b = ctx.body().asJsonObject();
      if (b == null) { ctx.fail(400); return null; }
      return b;
    } catch (Exception e) { ctx.fail(400); return null; }
  }

  private static String first(RoutingContext ctx, String key) {
    return ctx.queryParam(key).stream().findFirst().orElse(null);
  }

  private static int intParam(RoutingContext ctx, String key, int def) {
    try { return Integer.parseInt(first(ctx, key)); } catch (Exception e) { return def; }
  }

  private static Integer intParamOrNull(RoutingContext ctx, String key) {
    try {
      String v = first(ctx, key);
      return v != null ? Integer.parseInt(v) : null;
    } catch (Exception e) { return null; }
  }

  private static Long longParamOrNull(RoutingContext ctx, String key) {
    try {
      String v = first(ctx, key);
      return v != null ? Long.parseLong(v) : null;
    } catch (Exception e) { return null; }
  }

  private static String nvl(String v, String fallback) {
    return v != null ? v : fallback;
  }
}
