package com.openiv.backend.workflows;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.beam.BeamApiKeyHandler;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class WorkflowHandlers {

  private final WorkflowService service;

  public WorkflowHandlers(WorkflowService service) {
    this.service = service;
  }

  // ── Workflow definitions ──────────────────────────────────────────────────

  // GET /workflows
  public Handler<RoutingContext> list() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.list(session)
          .onSuccess(defs -> {
            var arr = new JsonArray();
            defs.forEach(d -> arr.add(d.toJson()));
            ok(ctx, new JsonObject().put("workflows", arr));
          })
          .onFailure(ctx::fail);
    };
  }

  // GET /workflows/:id
  public Handler<RoutingContext> get() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      Long id = pathId(ctx); if (id == null) return;
      service.get(session, id)
          .onSuccess(opt -> {
            if (opt.isEmpty()) { ctx.fail(404); return; }
            ok(ctx, new JsonObject().put("workflow", opt.get().toJson()));
          })
          .onFailure(ctx::fail);
    };
  }

  // POST /workflows  {name, blocks, schedule?}
  public Handler<RoutingContext> create() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      JsonObject b = body(ctx); if (b == null) return;
      String name = b.getString("name", "").trim();
      if (name.isEmpty()) { badRequest(ctx, "name is required"); return; }
      service.create(session, name, b.getJsonArray("blocks", new JsonArray()), b.getJsonObject("schedule"),
              b.getInteger("rescheduleDays"),
              b.getInteger("caseRiskThreshold", 75))
          .onSuccess(def -> ok(ctx, new JsonObject().put("workflow", def.toJson())))
          .onFailure(err -> failOrBadRequest(ctx, err));
    };
  }

  // PUT /workflows/:id  {blocks, schedule, scheduleEnabled}
  public Handler<RoutingContext> update() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      Long id = pathId(ctx); if (id == null) return;
      JsonObject b = body(ctx); if (b == null) return;
      String name = b.getString("name", "").trim();
      service.updateDraft(session, id, name,
              b.getJsonArray("blocks", new JsonArray()),
              b.getJsonObject("schedule", new JsonObject()),
              Boolean.TRUE.equals(b.getBoolean("scheduleEnabled")),
              b.getInteger("rescheduleDays"),
              b.getInteger("caseRiskThreshold", 75))
          .onSuccess(opt -> {
            if (opt.isEmpty()) { badRequest(ctx, "Only drafts can be edited"); return; }
            ok(ctx, new JsonObject().put("workflow", opt.get().toJson()));
          })
          .onFailure(err -> failOrBadRequest(ctx, err));
    };
  }

  // DELETE /workflows/:id  — draft / pending_approval only
  public Handler<RoutingContext> delete() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      Long id = pathId(ctx); if (id == null) return;
      service.delete(session, id)
          .onSuccess(ok -> {
            if (!ok) { badRequest(ctx, "Only draft or pending-approval workflows can be deleted"); return; }
            ok(ctx, new JsonObject().put("ok", true));
          })
          .onFailure(err -> failOrBadRequest(ctx, err));
    };
  }

  // POST /workflows/:id/import  — API-key authenticated, SSE streaming response
  // Accepts multipart/form-data (when workflow includes liveness_match):
  //   customers  — JSON string: single-element array of the customer object
  //   selfie     — image file (JPEG/PNG) for the liveness check
  // Or application/json (all other workflows):
  //   { "customers": [...] }
  public Handler<RoutingContext> importBatch() {
    return ctx -> {
      Long id = pathId(ctx); if (id == null) return;
      long institutionId = ctx.get(BeamApiKeyHandler.INSTITUTION_ID_KEY);

      JsonArray customers;

      // 1. Try multipart form field "customers" (batch mode — JSON array string)
      String customersAttr = ctx.request().getFormAttribute("customers");
      if (customersAttr != null && !customersAttr.isBlank()) {
        try {
          customers = new JsonArray(customersAttr);
        } catch (Exception e) {
          ctx.response().setStatusCode(400).putHeader("Content-Type", "application/json")
              .end(new JsonObject()
                  .put("error", "The 'customers' form field must be a valid JSON array string")
                  .put("hint", "Example value for the 'customers' field: [{\"customerId\":\"ACC001\",\"firstName\":\"Ada\",\"lastName\":\"Obi\"}]")
                  .encode());
          return;
        }
      } else if (ctx.request().getFormAttribute("customerId") != null) {
        // 2. Flat form fields — single-customer selfie upload mode
        //    Fields: customerId, firstName, lastName, middleName, dob, phone,
        //            bvn, nin, OR id + id_type (NIN/BVN/PASSPORT/DL)
        JsonObject c = new JsonObject();
        for (String f : new String[]{"customerId","firstName","lastName","middleName",
                                     "dob","phone","bvn","nin","accountNumber"}) {
          String v = ctx.request().getFormAttribute(f);
          if (v != null && !v.isBlank()) c.put(f, v.trim());
        }
        // id + id_type convenience mapping
        String idVal  = ctx.request().getFormAttribute("id");
        String idType = ctx.request().getFormAttribute("id_type");
        if (idVal != null && !idVal.isBlank() && idType != null) {
          switch (idType.trim().toUpperCase()) {
            case "NIN"      -> c.put("nin", idVal.trim());
            case "BVN"      -> c.put("bvn", idVal.trim());
            case "PASSPORT" -> c.put("passportNumber", idVal.trim());
            case "DL"       -> c.put("driversLicense", idVal.trim());
            default         -> c.put("idNumber", idVal.trim());
          }
        }
        customers = new JsonArray().add(c);
      } else {
        // 3. JSON body (application/json)
        JsonObject b = ctx.body() != null && ctx.body().asString() != null && !ctx.body().asString().isBlank()
            ? new JsonObject(ctx.body().asString())
            : null;
        if (b == null || !b.containsKey("customers")) {
          ctx.response().setStatusCode(400).putHeader("Content-Type", "application/json")
              .end(new JsonObject()
                  .put("error", "Request must include customer data")
                  .put("hint", "Option A — JSON body: {\"customers\":[{\"customerId\":\"ACC001\",\"firstName\":\"Ada\",\"lastName\":\"Obi\"}]}  |  Option B — form-data flat fields: customerId, firstName, lastName, dob, nin/bvn, phone, selfie (file)  |  Option C — form-data batch: 'customers' text field as JSON array")
                  .encode());
          return;
        }
        customers = b.getJsonArray("customers", new JsonArray());
      }

      // Inject selfie as base64 into the first customer when a file upload is present
      var selfieUploads = ctx.fileUploads().stream()
          .filter(u -> "selfie".equals(u.name())).toList();
      if (!selfieUploads.isEmpty() && !customers.isEmpty()) {
        try {
          byte[] bytes = java.nio.file.Files.readAllBytes(
              java.nio.file.Path.of(selfieUploads.get(0).uploadedFileName()));
          customers.getJsonObject(0).put("selfie", java.util.Base64.getEncoder().encodeToString(bytes));
        } catch (Exception ignored) {}
      }

      var resp = ctx.response();
      resp.setChunked(true)
          .putHeader("Content-Type",      "text/event-stream; charset=utf-8")
          .putHeader("Cache-Control",     "no-cache")
          .putHeader("Connection",        "keep-alive")
          .putHeader("X-Accel-Buffering", "no");

      writeSse(resp, "started", new JsonObject()
          .put("workflowId",     id)
          .put("totalCustomers", customers.size()));

      final JsonArray finalCustomers = customers;
      service.importBatchStream(institutionId, id, finalCustomers,
              customer -> writeSse(resp, "customer", customer))
          .onSuccess(result -> {
            writeSse(resp, "done", result);
            resp.end();
          })
          .onFailure(err -> {
            writeSse(resp, "error", new JsonObject().put("message", err.getMessage()));
            resp.end();
          });
    };
  }

  private static void writeSse(io.vertx.core.http.HttpServerResponse r, String event, JsonObject data) {
    r.write("event: " + event + "\ndata: " + data.encode() + "\n\n");
  }

  // POST /workflows/:id/submit
  public Handler<RoutingContext> submit() {
    return statusTransition((session, id) -> service.submit(session, id));
  }

  // POST /workflows/:id/approve  — maker-checker enforced in service
  public Handler<RoutingContext> approve() {
    return statusTransition((session, id) -> service.approve(session, id));
  }

  // POST /workflows/:id/retire
  public Handler<RoutingContext> retire() {
    return statusTransition((session, id) -> service.retire(session, id));
  }

  // POST /workflows/:id/new-version
  public Handler<RoutingContext> newVersion() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      Long id = pathId(ctx); if (id == null) return;
      service.newVersion(session, id)
          .onSuccess(def -> ok(ctx, new JsonObject().put("workflow", def.toJson())))
          .onFailure(err -> failOrBadRequest(ctx, err));
    };
  }

  // POST /workflows/:id/run
  public Handler<RoutingContext> runNow() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      Long id = pathId(ctx); if (id == null) return;
      service.runNow(session, id)
          .onSuccess(runId -> ok(ctx, new JsonObject().put("runId", runId)))
          .onFailure(err -> failOrBadRequest(ctx, err));
    };
  }

  // GET /workflows/:id/payload-schema
  public Handler<RoutingContext> payloadSchema() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      Long id = pathId(ctx); if (id == null) return;
      service.payloadSchema(session, id)
          .onSuccess(schema -> ok(ctx, new JsonObject().put("schema", schema)))
          .onFailure(err -> failOrBadRequest(ctx, err));
    };
  }

  // GET /workflows/:id/estimate
  public Handler<RoutingContext> estimate() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      Long id = pathId(ctx); if (id == null) return;
      service.estimate(session, id)
          .onSuccess(est -> ok(ctx, est))
          .onFailure(err -> failOrBadRequest(ctx, err));
    };
  }

  // GET /workflows/enrichment-count
  public Handler<RoutingContext> enrichmentCount() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.enrichmentCount(session)
          .onSuccess(count -> ok(ctx, new JsonObject().put("count", count)))
          .onFailure(ctx::fail);
    };
  }

  // GET /workflows/:id/runs
  public Handler<RoutingContext> listRuns() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      Long id = pathId(ctx); if (id == null) return;
      service.listRuns(session, id)
          .onSuccess(runs -> ok(ctx, new JsonObject().put("runs", runs)))
          .onFailure(ctx::fail);
    };
  }

  // GET /workflow-runs/:runId/items
  public Handler<RoutingContext> listRunItems() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      Long runId = pathId(ctx, "runId"); if (runId == null) return;
      int limit  = intParam(ctx, "limit", 50);
      int offset = intParam(ctx, "offset", 0);
      service.listRunItems(session, runId, limit, offset)
          .onSuccess(items -> ok(ctx, new JsonObject().put("items", items)))
          .onFailure(ctx::fail);
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private interface Transition {
    io.vertx.core.Future<Boolean> apply(com.openiv.backend.auth.model.Session session, long id);
  }

  private Handler<RoutingContext> statusTransition(Transition t) {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      Long id = pathId(ctx); if (id == null) return;
      t.apply(session, id)
          .onSuccess(okFlag -> {
            if (!okFlag) { badRequest(ctx, "Invalid state transition"); return; }
            ok(ctx, new JsonObject().put("ok", true));
          })
          .onFailure(err -> failOrBadRequest(ctx, err));
    };
  }

  private static Long pathId(RoutingContext ctx) { return pathId(ctx, "id"); }

  private static Long pathId(RoutingContext ctx, String name) {
    try { return Long.parseLong(ctx.pathParam(name)); }
    catch (Exception e) { ctx.fail(400); return null; }
  }

  private static int intParam(RoutingContext ctx, String name, int dflt) {
    try {
      String v = ctx.request().getParam(name);
      return v != null ? Integer.parseInt(v) : dflt;
    } catch (NumberFormatException e) { return dflt; }
  }

  // POST /customers/rescreen-all
  public Handler<RoutingContext> rescreenAll() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      service.rescreenAll(session)
          .onSuccess(result -> ok(ctx, result))
          .onFailure(err -> failOrBadRequest(ctx, err));
    };
  }

  // POST /customers/:id/rescreen
  public Handler<RoutingContext> rescreenCustomer() {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      String externalId = ctx.pathParam("id");
      service.rescreenCustomer(session, externalId)
          .onSuccess(outcome -> ok(ctx, new JsonObject().put("outcome", outcome)))
          .onFailure(e -> {
            if (e.getMessage() != null && e.getMessage().contains("not found")) {
              ctx.response().setStatusCode(404)
                  .putHeader("content-type", "application/json; charset=utf-8")
                  .end(new JsonObject().put("error", e.getMessage()).encode());
            } else {
              ctx.fail(e);
            }
          });
    };
  }

  private static void failOrBadRequest(RoutingContext ctx, Throwable err) {
    if (err instanceof IllegalArgumentException || err instanceof IllegalStateException) {
      badRequest(ctx, err.getMessage());
    } else {
      ctx.fail(err);
    }
  }

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
}
