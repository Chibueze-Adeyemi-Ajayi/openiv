package com.openiv.backend.nfiu;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.repository.InstitutionRepository;
import io.vertx.core.Future;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.time.LocalDate;

public final class NfiuHandlers {

  private final NfiuService           service;
  private final InstitutionRepository institutions;

  public NfiuHandlers(NfiuService service) {
    this(service, null);
  }

  public NfiuHandlers(NfiuService service, InstitutionRepository institutions) {
    this.service      = service;
    this.institutions = institutions;
  }

  // GET /nfiu/metrics
  public Handler<RoutingContext> getMetrics() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.getMetrics(session)
          .onSuccess(m -> ok(ctx, new JsonObject()
              .put("totalFiled",        m.totalFiled())
              .put("totalDraft",        m.totalDraft())
              .put("totalAcknowledged", m.totalAcknowledged())
              .put("totalRejected",     m.totalRejected())
              .put("dueThisWeek",       m.dueThisWeek())
              .put("filedThisMonth",    m.filedThisMonth())))
          .onFailure(ctx::fail);
    };
  }

  // GET /nfiu/reports
  public Handler<RoutingContext> listReports() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String type   = ctx.queryParam("type").stream().findFirst().orElse(null);
      String status = ctx.queryParam("status").stream().findFirst().orElse(null);
      service.listReports(session, type, status)
          .onSuccess(reports -> {
            var arr = new JsonArray();
            reports.forEach(r -> arr.add(reportJson(r)));
            ok(ctx, new JsonObject().put("reports", arr));
          })
          .onFailure(ctx::fail);
    };
  }

  // POST /nfiu/reports
  public Handler<RoutingContext> createReport() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;

      service.createReport(session,
              body.getString("reportType"),
              body.getString("title"),
              parseDate(body.getString("periodStart")),
              parseDate(body.getString("periodEnd")),
              body.getString("priority"),
              parseLongVal(body, "officerUserId"),
              body.getString("officerName"),
              body.getString("subjectName"),
              body.getString("subjectAccount"),
              body.getString("subjectBvn"),
              body.getString("subjectType"),
              parseDate(body.getString("subjectDob")),
              body.getString("subjectAddress"),
              body.getDouble("amountNgn"),
              body.getInteger("transactionCount", 0),
              body.getString("transactionType"),
              parseDate(body.getString("transactionDate")),
              body.getString("linkedTransactionId"),
              body.getString("transactionLocation"),
              parseDouble(body, "transactionLat"),
              parseDouble(body, "transactionLng"),
              body.getString("transactionSenderAccount"),
              body.getString("transactionSenderBank"),
              body.getString("transactionRecipientName"),
              body.getString("transactionRecipientAccount"),
              body.getString("transactionRecipientBank"),
              body.getString("transactionCurrency"),
              body.getString("transactionNarration"),
              body.getString("narrative"))
          .onSuccess(r -> ok(ctx, reportJson(r)))
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException) badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // GET /nfiu/reports/:id
  public Handler<RoutingContext> getReport() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = parseLong(ctx, "id"); if (id < 0) return;
      service.getReport(session, id)
          .onSuccess(r -> ok(ctx, reportJson(r)))
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException) badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // PATCH /nfiu/reports/:id
  public Handler<RoutingContext> updateReport() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = parseLong(ctx, "id"); if (id < 0) return;
      JsonObject body = body(ctx);
      if (body == null) return;

      service.updateReport(session, id,
              body.getString("title"),
              parseDate(body.getString("periodStart")),
              parseDate(body.getString("periodEnd")),
              body.getString("priority"),
              parseLongVal(body, "officerUserId"),
              body.getString("officerName"),
              body.getString("subjectName"),
              body.getString("subjectAccount"),
              body.getString("subjectBvn"),
              body.getString("subjectType"),
              parseDate(body.getString("subjectDob")),
              body.getString("subjectAddress"),
              body.getDouble("amountNgn"),
              body.getInteger("transactionCount", 0),
              body.getString("transactionType"),
              parseDate(body.getString("transactionDate")),
              body.getString("linkedTransactionId"),
              body.getString("transactionLocation"),
              parseDouble(body, "transactionLat"),
              parseDouble(body, "transactionLng"),
              body.getString("transactionSenderAccount"),
              body.getString("transactionSenderBank"),
              body.getString("transactionRecipientName"),
              body.getString("transactionRecipientAccount"),
              body.getString("transactionRecipientBank"),
              body.getString("transactionCurrency"),
              body.getString("transactionNarration"),
              body.getString("narrative"))
          .onSuccess(r -> ok(ctx, reportJson(r)))
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException || err instanceof IllegalStateException)
              badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // POST /nfiu/reports/:id/file
  public Handler<RoutingContext> fileReport() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = parseLong(ctx, "id"); if (id < 0) return;
      service.fileReport(session, id)
          .onSuccess(r -> ok(ctx, reportJson(r)))
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException || err instanceof IllegalStateException)
              badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // POST /nfiu/reports/:id/approve
  public Handler<RoutingContext> approveReport() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = parseLong(ctx, "id"); if (id < 0) return;
      service.approveReport(session, id)
          .onSuccess(r -> ok(ctx, reportJson(r)))
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException || err instanceof IllegalStateException)
              badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // GET /nfiu/reports/:id/goaml  — returns goAML-compliant XML for portal upload
  public Handler<RoutingContext> downloadGoAml() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = parseLong(ctx, "id"); if (id < 0) return;
      if (institutions == null) { badRequest(ctx, "Institution data unavailable"); return; }
      service.getReport(session, id)
          .compose(report -> institutions.findById(report.institutionId())
              .map(opt -> opt.orElseThrow(() ->
                  new IllegalStateException("Institution not found")))
              .compose(inst -> {
                String xml      = GoAmlXmlBuilder.build(report, inst);
                String filename = report.reference() + "-goaml.xml";
                ctx.response()
                    .setStatusCode(200)
                    .putHeader("content-type",        "application/xml; charset=UTF-8")
                    .putHeader("content-disposition", "attachment; filename=\"" + filename + "\"")
                    .end(xml);
                return Future.succeededFuture();
              }))
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException || err instanceof IllegalStateException)
              badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // DELETE /nfiu/reports/:id
  public Handler<RoutingContext> deleteReport() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = parseLong(ctx, "id"); if (id < 0) return;
      service.deleteReport(session, id)
          .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
          .onFailure(ctx::fail);
    };
  }

  // GET /nfiu/schedules
  public Handler<RoutingContext> listSchedules() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.listSchedules(session)
          .onSuccess(schedules -> {
            var arr = new JsonArray();
            schedules.forEach(s -> arr.add(scheduleJson(s)));
            ok(ctx, new JsonObject().put("schedules", arr));
          })
          .onFailure(ctx::fail);
    };
  }

  // POST /nfiu/schedules
  public Handler<RoutingContext> createSchedule() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = body(ctx);
      if (body == null) return;

      service.createSchedule(session,
              body.getString("reportType"),
              body.getString("name"),
              body.getString("frequency", "monthly"),
              parseDate(body.getString("nextDue")),
              Boolean.TRUE.equals(body.getBoolean("autoFile")))
          .onSuccess(s -> ok(ctx, scheduleJson(s)))
          .onFailure(err -> {
            if (err instanceof IllegalArgumentException) badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // PATCH /nfiu/schedules/:id
  public Handler<RoutingContext> updateSchedule() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = parseLong(ctx, "id"); if (id < 0) return;
      JsonObject body = body(ctx);
      if (body == null) return;

      service.updateSchedule(session, id,
              body.getString("name"),
              body.getString("frequency"),
              parseDate(body.getString("nextDue")),
              body.getBoolean("isActive"),
              body.getBoolean("autoFile"))
          .onSuccess(s -> ok(ctx, scheduleJson(s)))
          .onFailure(err -> {
            if (err instanceof IllegalStateException) badRequest(ctx, err.getMessage());
            else ctx.fail(err);
          });
    };
  }

  // DELETE /nfiu/schedules/:id
  public Handler<RoutingContext> deleteSchedule() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      long id = parseLong(ctx, "id"); if (id < 0) return;
      service.deleteSchedule(session, id)
          .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
          .onFailure(ctx::fail);
    };
  }

  // ── JSON serialisers ──────────────────────────────────────────────────────

  static JsonObject reportJson(NfiuReport r) {
    return new JsonObject()
        .put("id",                        r.id())
        .put("reportType",                r.reportType())
        .put("reference",                 r.reference())
        .put("title",                     r.title())
        .put("periodStart",               r.periodStart().toString())
        .put("periodEnd",                 r.periodEnd().toString())
        .put("status",                    r.status())
        .put("priority",                  r.priority())
        .put("filingDate",                r.filingDate() != null ? r.filingDate().toString() : null)
        .put("officerUserId",             r.officerUserId())
        .put("officerName",               r.officerName())
        .put("subjectName",               r.subjectName())
        .put("subjectAccount",            r.subjectAccount())
        .put("subjectBvn",                r.subjectBvn())
        .put("subjectType",               r.subjectType())
        .put("subjectDob",                r.subjectDob() != null ? r.subjectDob().toString() : null)
        .put("subjectAddress",            r.subjectAddress())
        .put("amountNgn",                 r.amountNgn())
        .put("transactionCount",          r.transactionCount())
        .put("transactionType",           r.transactionType())
        .put("transactionDate",           r.transactionDate() != null ? r.transactionDate().toString() : null)
        .put("linkedTransactionId",       r.linkedTransactionId())
        .put("transactionLocation",       r.transactionLocation())
        .put("transactionLat",            r.transactionLat())
        .put("transactionLng",            r.transactionLng())
        .put("transactionSenderAccount",  r.transactionSenderAccount())
        .put("transactionSenderBank",     r.transactionSenderBank())
        .put("transactionRecipientName",  r.transactionRecipientName())
        .put("transactionRecipientAccount", r.transactionRecipientAccount())
        .put("transactionRecipientBank",  r.transactionRecipientBank())
        .put("transactionCurrency",       r.transactionCurrency())
        .put("transactionNarration",      r.transactionNarration())
        .put("narrative",                 r.narrative())
        .put("filedByName",               r.filedByName())
        .put("acknowledgementRef",        r.acknowledgementRef())
        .put("rejectionReason",           r.rejectionReason())
        .put("createdAt",                 r.createdAt().toString())
        .put("submittedByUserId",         r.submittedByUserId())
        .put("submittedByName",           r.submittedByName())
        .put("submittedAt",               r.submittedAt() != null ? r.submittedAt().toString() : null);
  }

  static JsonObject scheduleJson(NfiuSchedule s) {
    return new JsonObject()
        .put("id",           s.id())
        .put("reportType",   s.reportType())
        .put("name",         s.name())
        .put("frequency",    s.frequency())
        .put("nextDue",      s.nextDue().toString())
        .put("lastFiledAt",  s.lastFiledAt() != null ? s.lastFiledAt().toString() : null)
        .put("isActive",     s.isActive())
        .put("autoFile",     s.autoFile())
        .put("createdAt",    s.createdAt().toString());
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

  private static long parseLong(RoutingContext ctx, String param) {
    try { return Long.parseLong(ctx.pathParam(param)); }
    catch (NumberFormatException e) { badRequest(ctx, "invalid " + param); return -1; }
  }

  private static Long parseLongVal(JsonObject body, String key) {
    Object v = body.getValue(key);
    if (v == null) return null;
    return ((Number) v).longValue();
  }

  private static Double parseDouble(JsonObject body, String key) {
    Object v = body.getValue(key);
    if (v == null) return null;
    return ((Number) v).doubleValue();
  }

  private static LocalDate parseDate(String s) {
    if (s == null || s.isBlank()) return null;
    try { return LocalDate.parse(s); }
    catch (Exception e) { return null; }
  }
}
