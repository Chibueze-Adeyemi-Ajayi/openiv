package com.openiv.backend.dashboard;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.beam.OtpAlert;
import io.vertx.core.Handler;
import io.vertx.core.Vertx;
import io.vertx.core.http.HttpServerResponse;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

public final class DashboardHandlers {

  private final DashboardService service;
  private final Vertx             vertx;

  public DashboardHandlers(DashboardService service, Vertx vertx) {
    this.service = service;
    this.vertx   = vertx;
  }

  // ── SSE: unified events stream ────────────────────────────────────────────
  // GET /dashboard/events — single multiplexed connection carrying all three streams.
  //
  // Named event types:
  //   stats          — DashboardStats snapshot (every 5 s)
  //   activityInit   — full last-30 activity batch on connect
  //   activityUpdate — incremental activity events (every 5 s if new)
  //   otpInit        — full last-30 OTP alert batch on connect
  //   otpUpdate      — incremental OTP alerts (every 5 s if new)
  //   :\n\n          — heartbeat comment (every 20 s, keeps proxies alive)
  //
  // Init phase runs 3 DB queries in parallel; periodic timers start only after all
  // three complete (counter pattern). Vert.x is single-threaded per event-loop so
  // int[] is safe here.

  public Handler<RoutingContext> unifiedStream() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      HttpServerResponse resp = ctx.response();
      resp.setChunked(true)
          .putHeader("content-type",    "text/event-stream; charset=utf-8")
          .putHeader("cache-control",   "no-cache")
          .putHeader("x-accel-buffering", "no");

      final long[] lastActivityId = { 0L };
      final long[] lastOtpId      = { 0L };
      final int[]  pendingInit    = { 3 };

      Runnable startTimers = () -> {
        if (sseEnded(resp)) return;

        long pollId = vertx.setPeriodic(5_000, id -> {
          if (sseEnded(resp)) { vertx.cancelTimer(id); return; }

          service.stats(session).onSuccess(s -> {
            if (!sseEnded(resp)) safeWrite(resp, sseEvent("stats", statsJson(s)));
          });

          service.activitySince(session, lastActivityId[0]).onSuccess(events -> {
            if (sseEnded(resp) || events.isEmpty()) return;
            lastActivityId[0] = events.get(0).id();
            safeWrite(resp, sseEvent("activityUpdate", eventsJson(events)));
          });

          service.otpAlertsSince(session, lastOtpId[0]).onSuccess(alerts -> {
            if (sseEnded(resp) || alerts.isEmpty()) return;
            lastOtpId[0] = alerts.get(0).id();
            safeWrite(resp, sseEvent("otpUpdate", otpAlertsJson(alerts)));
          });
        });

        long hbId = vertx.setPeriodic(20_000, id -> {
          if (sseEnded(resp)) { vertx.cancelTimer(id); return; }
          safeWrite(resp, ":\n\n");
        });

          // ── Real-time security event relay (login-attempt alerts) ────────────
        String secAddr = "user." + session.userId() + ".security";
        var consumer = vertx.eventBus().<JsonObject>consumer(secAddr, msg -> {
          if (!sseEnded(resp)) safeWrite(resp, sseEvent("securityEvent", msg.body()));
        });

        ctx.request().connection().closeHandler(v -> {
          vertx.cancelTimer(pollId);
          vertx.cancelTimer(hbId);
          consumer.unregister();
        });
      };

      // ── Initial push: 3 parallel DB queries ──────────────────────────────

      service.stats(session)
          .onSuccess(s -> {
            if (!sseEnded(resp)) safeWrite(resp, sseEvent("stats", statsJson(s)));
          })
          .onComplete(ar -> { if (--pendingInit[0] == 0) startTimers.run(); });

      service.recentActivity(session)
          .onSuccess(events -> {
            if (sseEnded(resp)) return;
            if (!events.isEmpty()) lastActivityId[0] = events.get(0).id();
            safeWrite(resp, sseEvent("activityInit", eventsJson(events)));
          })
          .onComplete(ar -> { if (--pendingInit[0] == 0) startTimers.run(); });

      service.recentOtpAlerts(session)
          .onSuccess(alerts -> {
            if (sseEnded(resp)) return;
            if (!alerts.isEmpty()) lastOtpId[0] = alerts.get(0).id();
            safeWrite(resp, sseEvent("otpInit", otpAlertsJson(alerts)));
          })
          .onComplete(ar -> { if (--pendingInit[0] == 0) startTimers.run(); });
    };
  }

  // ── SSE: stats stream ─────────────────────────────────────────────────────
  // GET /dashboard/stream — pushes "stats" event every 5 s

  public Handler<RoutingContext> stream() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      HttpServerResponse resp = ctx.response();
      resp.setChunked(true)
          .putHeader("content-type", "text/event-stream; charset=utf-8")
          .putHeader("cache-control", "no-cache")
          .putHeader("x-accel-buffering", "no");

      pushStats(resp, session);

      long statsId = vertx.setPeriodic(5_000, id -> {
        if (resp.ended() || resp.closed()) { vertx.cancelTimer(id); return; }
        pushStats(resp, session);
      });
      long hbId = vertx.setPeriodic(20_000, id -> {
        if (resp.ended() || resp.closed()) { vertx.cancelTimer(id); return; }
        safeWrite(resp, ":\n\n");
      });
      ctx.request().connection().closeHandler(v -> {
        vertx.cancelTimer(statsId);
        vertx.cancelTimer(hbId);
      });
    };
  }

  // ── SSE: activity stream ──────────────────────────────────────────────────
  // GET /dashboard/activity-stream
  // Sends "init" on connect with last 30 events, then "update" every 5 s with new events only.

  public Handler<RoutingContext> activityStream() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      HttpServerResponse resp = ctx.response();
      resp.setChunked(true)
          .putHeader("content-type", "text/event-stream; charset=utf-8")
          .putHeader("cache-control", "no-cache")
          .putHeader("x-accel-buffering", "no");

      final long[] lastId = { 0L };

      service.recentActivity(session).onSuccess(events -> {
        if (resp.ended() || resp.closed()) return;
        if (!events.isEmpty()) lastId[0] = events.get(0).id();
        safeWrite(resp, "event: init\ndata: " + eventsJson(events).encode() + "\n\n");
      });

      long pollId = vertx.setPeriodic(5_000, id -> {
        if (resp.ended() || resp.closed()) { vertx.cancelTimer(id); return; }
        service.activitySince(session, lastId[0]).onSuccess(events -> {
          if (resp.ended() || resp.closed()) return;
          if (events.isEmpty()) return;
          lastId[0] = events.get(0).id();
          safeWrite(resp, "event: update\ndata: " + eventsJson(events).encode() + "\n\n");
        });
      });
      long hbId = vertx.setPeriodic(20_000, id -> {
        if (resp.ended() || resp.closed()) { vertx.cancelTimer(id); return; }
        safeWrite(resp, ":\n\n");
      });
      ctx.request().connection().closeHandler(v -> {
        vertx.cancelTimer(pollId);
        vertx.cancelTimer(hbId);
      });
    };
  }

  // ── SSE: OTP alerts stream ────────────────────────────────────────────────
  // GET /dashboard/otp-alerts-stream
  // Sends "init" on connect with last 30 alerts, then "update" every 5 s with new ones only.

  public Handler<RoutingContext> otpAlertsStream() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      HttpServerResponse resp = ctx.response();
      resp.setChunked(true)
          .putHeader("content-type", "text/event-stream; charset=utf-8")
          .putHeader("cache-control", "no-cache")
          .putHeader("x-accel-buffering", "no");

      final long[] lastId = { 0L };

      service.recentOtpAlerts(session).onSuccess(alerts -> {
        if (resp.ended() || resp.closed()) return;
        if (!alerts.isEmpty()) lastId[0] = alerts.get(0).id();
        safeWrite(resp, "event: init\ndata: " + otpAlertsJson(alerts).encode() + "\n\n");
      });

      long pollId = vertx.setPeriodic(5_000, id -> {
        if (resp.ended() || resp.closed()) { vertx.cancelTimer(id); return; }
        service.otpAlertsSince(session, lastId[0]).onSuccess(alerts -> {
          if (resp.ended() || resp.closed()) return;
          if (alerts.isEmpty()) return;
          lastId[0] = alerts.get(0).id();
          safeWrite(resp, "event: update\ndata: " + otpAlertsJson(alerts).encode() + "\n\n");
        });
      });
      long hbId = vertx.setPeriodic(20_000, id -> {
        if (resp.ended() || resp.closed()) { vertx.cancelTimer(id); return; }
        safeWrite(resp, ":\n\n");
      });
      ctx.request().connection().closeHandler(v -> {
        vertx.cancelTimer(pollId);
        vertx.cancelTimer(hbId);
      });
    };
  }

  // ── REST: one-shot stats ──────────────────────────────────────────────────

  public Handler<RoutingContext> stats() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.stats(session)
          .onSuccess(s -> ok(ctx, statsJson(s)))
          .onFailure(ctx::fail);
    };
  }

  // ── REST: 24-hour transaction flow ────────────────────────────────────────

  public Handler<RoutingContext> flow() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.hourlyFlow(session)
          .onSuccess(buckets -> {
            var arr = new JsonArray();
            buckets.forEach(b -> arr.add(new JsonObject()
                .put("hour",    b.hour())
                .put("total",   b.total())
                .put("flagged", b.flagged())
                .put("blocked", b.blocked())));
            ok(ctx, new JsonObject().put("buckets", arr));
          })
          .onFailure(ctx::fail);
    };
  }

  // ── REST: risk-map points ────────────────────────────────────────────────

  public Handler<RoutingContext> riskMap() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      var from    = parseDateTime(first(ctx, "from"), OffsetDateTime.now(ZoneOffset.UTC).minusHours(24));
      var to      = parseDateTime(first(ctx, "to"),   OffsetDateTime.now(ZoneOffset.UTC));
      service.riskMapPoints(session, from, to)
          .onSuccess(points -> {
            var arr = new JsonArray();
            points.forEach(p -> arr.add(new JsonObject()
                .put("lat",     p.lat())
                .put("lng",     p.lng())
                .put("count",   p.count())
                .put("avgRisk", p.avgRisk())
                .put("hasFlag", p.hasFlag())));
            ok(ctx, new JsonObject()
                .put("points", arr)
                .put("from",   from.toString())
                .put("to",     to.toString()));
          })
          .onFailure(ctx::fail);
    };
  }

  // ── REST: CSV export ──────────────────────────────────────────────────────
  // GET /dashboard/export?from=ISO&to=ISO

  public Handler<RoutingContext> export() {
    return ctx -> {
      var session  = SessionAuthHandler.require(ctx);
      var from     = parseDateTime(first(ctx, "from"), OffsetDateTime.now(ZoneOffset.UTC).minusHours(24));
      var to       = parseDateTime(first(ctx, "to"),   OffsetDateTime.now(ZoneOffset.UTC));
      String fname = "openiv-report-" + to.toLocalDate() + ".csv";
      service.exportCsv(session, from, to)
          .onSuccess(csv -> ctx.response()
              .setStatusCode(200)
              .putHeader("content-type", "text/csv; charset=utf-8")
              .putHeader("content-disposition", "attachment; filename=\"" + fname + "\"")
              .end(csv))
          .onFailure(ctx::fail);
    };
  }

  // ── REST: file NFIU return ────────────────────────────────────────────────
  // POST /dashboard/nfiu-return  body: { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }

  public Handler<RoutingContext> nfiuReturn() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject body = ctx.body().asJsonObject();
      LocalDate today = LocalDate.now(ZoneOffset.UTC);
      LocalDate from  = parseDate(body != null ? body.getString("from") : null, today);
      LocalDate to    = parseDate(body != null ? body.getString("to")   : null, today);
      service.fileNfiuReturn(session, from, to)
          .onSuccess(nr -> ok(ctx, new JsonObject()
              .put("id",                 nr.id())
              .put("reference",          nr.reference())
              .put("periodFrom",         nr.periodFrom().toString())
              .put("periodTo",           nr.periodTo().toString())
              .put("totalTransactions",  nr.totalTransactions())
              .put("flaggedCount",       nr.flaggedCount())
              .put("totalFlaggedAmount", nr.totalFlaggedAmount())
              .put("status",             nr.status())
              .put("submittedAt",        nr.submittedAt().toString())))
          .onFailure(ctx::fail);
    };
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private void pushStats(HttpServerResponse resp, Session session) {
    if (resp.ended() || resp.closed()) return;
    service.stats(session).onSuccess(s -> {
      if (resp.ended() || resp.closed()) return;
      safeWrite(resp, "event: stats\ndata: " + statsJson(s).encode() + "\n\n");
    });
  }

  private static JsonObject statsJson(DashboardStats s) {
    return new JsonObject()
        .put("totalToday",       s.totalToday())
        .put("flaggedToday",     s.flaggedToday())
        .put("totalYesterday",   s.totalYesterday())
        .put("flaggedYesterday", s.flaggedYesterday())
        .put("openCases",        s.openCases());
  }

  private static JsonArray otpAlertsJson(List<OtpAlert> alerts) {
    var arr = new JsonArray();
    alerts.forEach(a -> arr.add(new JsonObject()
        .put("id",         a.id())
        .put("rule",       a.rule())
        .put("severity",   a.severity())
        .put("customerId", a.customerId())
        .put("deviceId",   a.deviceId())
        .put("channel",    a.channel())
        .put("otpType",    a.otpType())
        .put("eventCount", a.eventCount())
        .put("detail",     a.detail())
        .put("firedAt",    a.firedAt().toString())));
    return arr;
  }

  private static JsonArray eventsJson(List<ActivityEvent> events) {
    var arr = new JsonArray();
    events.forEach(e -> arr.add(new JsonObject()
        .put("id",         e.id())
        .put("source",     e.source())
        .put("severity",   e.severity())
        .put("title",      e.title())
        .put("detail",     e.detail())
        .put("entityId",   e.entityId())
        .put("entityType", e.entityType())
        .put("actor",      e.actor())
        .put("occurredAt", e.occurredAt().toString())));
    return arr;
  }


  private static boolean sseEnded(HttpServerResponse resp) {
    return resp.ended() || resp.closed();
  }

  private static String sseEvent(String name, JsonObject data) {
    return "event: " + name + "\ndata: " + data.encode() + "\n\n";
  }

  private static String sseEvent(String name, JsonArray data) {
    return "event: " + name + "\ndata: " + data.encode() + "\n\n";
  }

  private static void safeWrite(HttpServerResponse resp, String data) {
    try { resp.write(data); } catch (Exception ignored) {}
  }

  private static OffsetDateTime parseDateTime(String s, OffsetDateTime fallback) {
    if (s == null) return fallback;
    try { return OffsetDateTime.parse(s); } catch (Exception e) {
      try { return Instant.parse(s).atOffset(ZoneOffset.UTC); } catch (Exception e2) {
        return fallback;
      }
    }
  }

  private static LocalDate parseDate(String s, LocalDate fallback) {
    if (s == null) return fallback;
    try { return LocalDate.parse(s); } catch (Exception e) { return fallback; }
  }

  private static String first(RoutingContext ctx, String key) {
    return ctx.queryParam(key).stream().findFirst().orElse(null);
  }

  private static void ok(RoutingContext ctx, JsonObject body) {
    ctx.response().setStatusCode(200)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }
}
