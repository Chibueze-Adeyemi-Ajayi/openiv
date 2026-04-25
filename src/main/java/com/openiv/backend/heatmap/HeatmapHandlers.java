package com.openiv.backend.heatmap;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.time.LocalDate;
import java.util.List;

public final class HeatmapHandlers {

  private final HeatmapService service;

  public HeatmapHandlers(HeatmapService service) {
    this.service = service;
  }

  // GET /heatmap/transactions?mode=normal|abnormal&from=2024-04-25&to=2025-04-25
  //   or ?mode=normal|abnormal&year=2024  (convenience alias for full calendar year)
  //   defaults to last 365 days if neither from nor year is supplied
  public Handler<RoutingContext> transactions() {
    return ctx -> {
      var session      = SessionAuthHandler.require(ctx);
      boolean abnormal = "abnormal".equals(first(ctx, "mode"));
      var range        = resolveRange(first(ctx, "from"), first(ctx, "to"), first(ctx, "year"));
      service.transactions(session, abnormal, range[0], range[1])
          .onSuccess(cells -> ok(ctx, buildResponse(cells, range[0], range[1])))
          .onFailure(ctx::fail);
    };
  }

  // GET /heatmap/activity?mode=normal|abnormal&from=...&to=...
  public Handler<RoutingContext> activity() {
    return ctx -> {
      var session      = SessionAuthHandler.require(ctx);
      boolean abnormal = "abnormal".equals(first(ctx, "mode"));
      var range        = resolveRange(first(ctx, "from"), first(ctx, "to"), first(ctx, "year"));
      service.activity(session, abnormal, range[0], range[1])
          .onSuccess(cells -> ok(ctx, buildResponse(cells, range[0], range[1])))
          .onFailure(ctx::fail);
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Resolves the query date range.
   * Priority: explicit from/to > year alias > default (last 365 days).
   */
  private static LocalDate[] resolveRange(String fromStr, String toStr, String yearStr) {
    LocalDate today = LocalDate.now();

    if (fromStr != null) {
      LocalDate from = parseDate(fromStr);
      LocalDate to   = toStr != null ? parseDate(toStr) : today;
      if (from != null && to != null) return new LocalDate[]{ from, to };
    }

    if (yearStr != null) {
      try {
        int year = Integer.parseInt(yearStr);
        return new LocalDate[]{ LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31) };
      } catch (NumberFormatException ignored) {}
    }

    // Default: rolling last 365 days
    return new LocalDate[]{ today.minusDays(364), today };
  }

  private static JsonObject buildResponse(List<HeatmapCell> cells, LocalDate from, LocalDate to) {
    var arr   = new JsonArray();
    int total = 0;
    for (var c : cells) {
      arr.add(new JsonObject()
          .put("date",    c.date().toString())
          .put("count",   c.count())
          .put("avgRisk", c.avgRisk()));
      total += c.count();
    }
    return new JsonObject()
        .put("cells",      arr)
        .put("totalCount", total)
        .put("from",       from.toString())
        .put("to",         to.toString());
  }

  private static LocalDate parseDate(String s) {
    try { return LocalDate.parse(s); } catch (Exception e) { return null; }
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
