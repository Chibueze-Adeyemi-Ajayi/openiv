package com.openiv.backend.cases;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.billing.BillingService;
import com.openiv.backend.transactions.Transaction;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.util.Set;

public final class CaseHandlers {

  private final CaseService    service;
  private final BillingService billing;

  public CaseHandlers(CaseService service, BillingService billing) {
    this.service = service;
    this.billing = billing;
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

      service.list(session, status, priority, q, page, pageSize)
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

  // GET /cases/pending-approval
  public Handler<RoutingContext> listPendingApproval() {
    return ctx -> {
      var session  = SessionAuthHandler.require(ctx);
      String status   = first(ctx, "status");
      String priority = first(ctx, "priority");
      String q        = first(ctx, "q");
      int page        = intParam(ctx, "page", 1);
      int pageSize    = Math.min(intParam(ctx, "pageSize", 20), 100);

      service.listUnavailable(session, status, priority, q, page, pageSize)
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
      if (reason == null || reason.isBlank()) { badRequest(ctx, "reason is required");     return; }
      if (documentId == null)                 { badRequest(ctx, "documentId is required"); return; }

      service.create(session, title, typology, priority, riskScore, assignedTo, notes,
          transactionId, reason, documentId)
          .onSuccess(cas -> {
            ok(ctx, new JsonObject().put("case", caseJson(cas)));
            billing.chargeCaseOpenAsync(session);
          })
          .onFailure(ctx::fail);
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

      if (newStatus == null || !Set.of("open","investigating","escalated","closed").contains(newStatus)) {
        badRequest(ctx, "invalid status value"); return;
      }
      if ("closed".equals(newStatus) && (resolution == null || resolution.isBlank())) {
        badRequest(ctx, "resolution required when closing a case"); return;
      }
      if (reason == null || reason.isBlank()) { badRequest(ctx, "reason is required");     return; }
      if (documentId == null)                 { badRequest(ctx, "documentId is required"); return; }

      service.updateStatus(session, id, newStatus, resolution, reason, documentId)
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
        .put("updatedAt",     c.updatedAt().toString());
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

  private static String nvl(String v, String fallback) {
    return v != null ? v : fallback;
  }
}
