package com.openiv.backend.transactions;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.billing.BillingService;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

public final class TransactionHandlers {

  private final TransactionService service;
  private final BillingService     billing;

  public TransactionHandlers(TransactionService service, BillingService billing) {
    this.service = service;
    this.billing = billing;
  }

  public Handler<RoutingContext> list() {
    return ctx -> {
      var session       = SessionAuthHandler.require(ctx);
      String  status        = first(ctx, "status");
      String  flaggedStatus = first(ctx, "flaggedStatus");
      String  q             = first(ctx, "q");
      int     page          = intParam(ctx, "page", 1);
      int     pageSize      = Math.min(intParam(ctx, "pageSize", 20), 100);
      String  range         = firstOrDefault(ctx, "range", "30d");
      String  channel       = first(ctx, "channel");
      Integer minRisk       = intParamOrNull(ctx, "minRisk");
      Integer maxRisk       = intParamOrNull(ctx, "maxRisk");
      String  sort          = first(ctx, "sort");

      service.list(session, status, flaggedStatus, q, page, pageSize, range, channel, minRisk, maxRisk, sort)
          .onSuccess(result -> {
            JsonArray arr = new JsonArray();
            result.transactions().forEach(t -> arr.add(toJson(t)));
            ok(ctx, new JsonObject()
                .put("transactions", arr)
                .put("total",    result.total())
                .put("page",     result.page())
                .put("pageSize", result.pageSize()));
          })
          .onFailure(ctx::fail);
    };
  }

  public Handler<RoutingContext> getById() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String id = ctx.pathParam("id");
      service.getById(session, id)
          .onSuccess(opt -> {
            if (opt.isEmpty()) { ctx.fail(404); return; }
            ok(ctx, toJson(opt.get()));
          })
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

  public Handler<RoutingContext> markSeen() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String id = ctx.pathParam("id");
      service.markSeen(session, id)
          .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
          .onFailure(ctx::fail);
    };
  }

  public Handler<RoutingContext> bulkStatus() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body;
      try { body = ctx.body().asJsonObject(); }
      catch (Exception e) { ctx.fail(400); return; }
      if (body == null) { ctx.fail(400); return; }

      JsonArray idsArr       = body.getJsonArray("ids");
      String    flaggedStatus = body.getString("flaggedStatus");
      String    reason        = body.getString("reason");
      Long      documentId    = body.getLong("documentId");
      if (idsArr == null || flaggedStatus == null)        { ctx.fail(400); return; }
      if (reason == null || reason.isBlank())             { badRequest(ctx, "reason is required"); return; }
      if (documentId == null)                             { badRequest(ctx, "documentId is required"); return; }

      List<String> ids = idsArr.stream().map(Object::toString).toList();
      service.bulkUpdateFlaggedStatus(session, ids, flaggedStatus, reason, documentId)
          .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
          .onFailure(ctx::fail);
    };
  }

  public Handler<RoutingContext> importTransactions() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body;
      try { body = ctx.body().asJsonObject(); }
      catch (Exception e) { ctx.fail(400); return; }
      if (body == null) { ctx.fail(400); return; }

      JsonArray txns = body.getJsonArray("transactions");
      if (txns == null || txns.isEmpty()) {
        badRequest(ctx, "transactions array is required");
        return;
      }
      if (txns.size() > 500) {
        badRequest(ctx, "maximum 500 transactions per import");
        return;
      }

      var rows = new ArrayList<TransactionImport>();
      for (int i = 0; i < txns.size(); i++) {
        JsonObject obj = txns.getJsonObject(i);
        if (obj == null) continue;
        String id = obj.getString("id");
        if (id == null || id.isBlank()) continue;

        String customerId    = nvl(obj.getString("customerId"), "");
        String customerName  = nvl(obj.getString("customerName"), "");
        Number amtNum        = obj.getNumber("amount");
        BigDecimal amount    = amtNum != null ? new BigDecimal(amtNum.toString()) : BigDecimal.ZERO;
        String channel       = nvl(obj.getString("channel"), "");
        String counterparty  = nvl(obj.getString("counterparty"), "");
        int    riskScore     = obj.getInteger("riskScore", 0);
        String status        = nvl(obj.getString("status"), "pending");
        String flaggedStatus = obj.getString("flaggedStatus");
        String location      = obj.getString("location");
        Double lat           = obj.getDouble("lat");
        Double lng           = obj.getDouble("lng");

        String rawTs = obj.getString("occurredAt");
        OffsetDateTime occurredAt;
        try { occurredAt = OffsetDateTime.parse(rawTs); }
        catch (Exception e) { occurredAt = OffsetDateTime.now(); }

        String senderAccount    = obj.getString("senderAccount");
        String senderBank       = obj.getString("senderBank");
        String recipientName    = obj.getString("recipientName");
        String recipientAccount = obj.getString("recipientAccount");
        String recipientBank    = obj.getString("recipientBank");
        String currency         = nvl(obj.getString("currency"), "NGN");
        String narration        = obj.getString("narration");
        String deviceId         = obj.getString("deviceId");
        String ipAddress        = obj.getString("ipAddress");

        rows.add(new TransactionImport(id, customerId, customerName, amount,
            channel, counterparty, riskScore, status, flaggedStatus, location, lat, lng, occurredAt,
            senderAccount, senderBank, recipientName, recipientAccount, recipientBank,
            currency, narration, deviceId, ipAddress, null, "outward"));
      }

      if (rows.isEmpty()) {
        badRequest(ctx, "no valid rows found — every row must have a non-empty id");
        return;
      }

      service.importTransactions(session, rows)
          .onSuccess(count -> {
            ok(ctx, new JsonObject().put("imported", count));
            billing.chargeTransactionImportAsync(session, count);
          })
          .onFailure(ctx::fail);
    };
  }

  public Handler<RoutingContext> export() {
    return ctx -> {
      var session       = SessionAuthHandler.require(ctx);
      String  status        = first(ctx, "status");
      String  flaggedStatus = first(ctx, "flaggedStatus");
      String  q             = first(ctx, "q");
      String  range         = firstOrDefault(ctx, "range", "30d");
      String  channel       = first(ctx, "channel");
      Integer minRisk       = intParamOrNull(ctx, "minRisk");
      Integer maxRisk       = intParamOrNull(ctx, "maxRisk");

      service.export(session, status, flaggedStatus, q, range, channel, minRisk, maxRisk)
          .onSuccess(rows -> {
            String csv = buildCsv(rows);
            ctx.response()
                .setStatusCode(200)
                .putHeader("content-type", "text/csv; charset=utf-8")
                .putHeader("content-disposition", "attachment; filename=\"transactions.csv\"")
                .end(csv);
            billing.chargeReportExportAsync(session);
          })
          .onFailure(ctx::fail);
    };
  }

  // --- JSON shape -------------------------------------------------------------

  private static JsonObject toJson(Transaction t) {
    JsonObject o = new JsonObject()
        .put("id",           t.id())
        .put("customerId",   t.customerId())
        .put("customer",     t.customerName())
        .put("amount",       t.amount().longValue())
        .put("channel",      t.channel())
        .put("counterparty", t.counterparty())
        .put("time",         String.format("%02d:%02d",
                                 t.occurredAt().getHour(), t.occurredAt().getMinute()))
        .put("occurredAt",   t.occurredAt().toString())
        .put("risk",         t.riskScore())
        .put("status",       t.status())
        .put("location",     t.location() != null ? t.location() : "")
        .put("currency",     t.currency() != null ? t.currency() : "NGN")
        .put("seen",         t.seen());
    if (t.flaggedStatus()    != null) o.put("flaggedStatus",    t.flaggedStatus());
    if (t.lat()              != null) o.put("lat",              t.lat());
    if (t.lng()              != null) o.put("lng",              t.lng());
    if (t.senderAccount()    != null) o.put("senderAccount",    t.senderAccount());
    if (t.senderBank()       != null) o.put("senderBank",       t.senderBank());
    if (t.recipientName()    != null) o.put("recipientName",    t.recipientName());
    if (t.recipientAccount() != null) o.put("recipientAccount", t.recipientAccount());
    if (t.recipientBank()    != null) o.put("recipientBank",    t.recipientBank());
    if (t.narration()        != null) o.put("narration",        t.narration());
    if (t.deviceId()         != null) o.put("deviceId",         t.deviceId());
    if (t.ipAddress()        != null) o.put("ipAddress",        t.ipAddress());
    if (t.createdAt()        != null) o.put("createdAt",        t.createdAt().toString());
    if (t.updatedAt()        != null) o.put("updatedAt",        t.updatedAt().toString());
    if (t.flagReason()       != null) o.put("flagReason",       t.flagReason());
    if (t.category()         != null) o.put("category",         t.category());
    o.put("direction", t.direction() != null ? t.direction() : "outward");
    if (t.flagReasons() != null && !t.flagReasons().isEmpty()) {
      io.vertx.core.json.JsonArray rArr = new io.vertx.core.json.JsonArray();
      t.flagReasons().forEach(rArr::add);
      o.put("flagReasons", rArr);
    }
    return o;
  }

  // --- CSV builder ------------------------------------------------------------

  private static String buildCsv(List<Transaction> rows) {
    var sb = new StringBuilder();
    sb.append("id,customer_id,customer_name,amount,channel,counterparty,risk_score,")
      .append("status,flagged_status,location,lat,lng,occurred_at,")
      .append("sender_account,sender_bank,recipient_name,recipient_account,recipient_bank,")
      .append("currency,narration,device_id,ip_address\n");
    for (Transaction t : rows) {
      sb.append(csv(t.id())).append(',')
        .append(csv(t.customerId())).append(',')
        .append(csv(t.customerName())).append(',')
        .append(t.amount().toPlainString()).append(',')
        .append(csv(t.channel())).append(',')
        .append(csv(t.counterparty())).append(',')
        .append(t.riskScore()).append(',')
        .append(csv(t.status())).append(',')
        .append(csv(t.flaggedStatus())).append(',')
        .append(csv(t.location())).append(',')
        .append(t.lat() != null ? t.lat() : "").append(',')
        .append(t.lng() != null ? t.lng() : "").append(',')
        .append(t.occurredAt() != null ? t.occurredAt().toString() : "").append(',')
        .append(csv(t.senderAccount())).append(',')
        .append(csv(t.senderBank())).append(',')
        .append(csv(t.recipientName())).append(',')
        .append(csv(t.recipientAccount())).append(',')
        .append(csv(t.recipientBank())).append(',')
        .append(csv(t.currency())).append(',')
        .append(csv(t.narration())).append(',')
        .append(csv(t.deviceId())).append(',')
        .append(csv(t.ipAddress())).append('\n');
    }
    return sb.toString();
  }

  private static String csv(String val) {
    if (val == null) return "";
    if (val.contains(",") || val.contains("\"") || val.contains("\n")) {
      return '"' + val.replace("\"", "\"\"") + '"';
    }
    return val;
  }

  // --- helpers ----------------------------------------------------------------

  private static void ok(RoutingContext ctx, JsonObject body) {
    ctx.response()
        .setStatusCode(200)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }

  private static String first(RoutingContext ctx, String key) {
    return ctx.queryParam(key).stream().findFirst().orElse(null);
  }

  private static String firstOrDefault(RoutingContext ctx, String key, String def) {
    String v = first(ctx, key);
    return (v != null && !v.isBlank()) ? v : def;
  }

  private static int intParam(RoutingContext ctx, String key, int def) {
    try { return Integer.parseInt(first(ctx, key)); }
    catch (Exception e) { return def; }
  }

  private static Integer intParamOrNull(RoutingContext ctx, String key) {
    try {
      String v = first(ctx, key);
      return v != null ? Integer.parseInt(v) : null;
    } catch (Exception e) { return null; }
  }

  private static void badRequest(RoutingContext ctx, String message) {
    ctx.response()
        .setStatusCode(400)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(new JsonObject().put("error", message).encode());
  }

  private static String nvl(String value, String fallback) {
    return value != null ? value : fallback;
  }
}
