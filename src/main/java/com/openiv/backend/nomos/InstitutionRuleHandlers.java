package com.openiv.backend.nomos;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class InstitutionRuleHandlers {

    private final InstitutionRuleService service;

    public InstitutionRuleHandlers(InstitutionRuleService service) {
        this.service = service;
    }

    // GET /nomos/rules
    public Handler<RoutingContext> list() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            service.list(session)
                .onSuccess(rules -> {
                    var arr = new JsonArray();
                    rules.forEach(r -> arr.add(r.toJson()));
                    ok(ctx, new JsonObject().put("rules", arr));
                })
                .onFailure(ctx::fail);
        };
    }

    // POST /nomos/rules
    public Handler<RoutingContext> create() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            JsonObject b = body(ctx); if (b == null) return;
            String name           = b.getString("name",            "").trim();
            String policy         = b.getString("policyStatement", "").trim();
            JsonObject comp       = b.getJsonObject("comprehension");
            String functionSource = b.getString("functionSource",  "");
            if (name.isEmpty())   { badRequest(ctx, "name is required");            return; }
            if (policy.isEmpty()) { badRequest(ctx, "policyStatement is required"); return; }
            service.create(session, name, policy, comp,
                           functionSource.isBlank() ? null : functionSource.trim())
                .onSuccess(rule -> ok(ctx, new JsonObject().put("rule", rule.toJson())))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // POST /nomos/comprehend  — stateless SSE (no rule created)
    public Handler<RoutingContext> comprehendStateless() {
        return ctx -> {
            JsonObject b = body(ctx); if (b == null) return;
            String policy = b.getString("policy", "").trim();
            if (policy.isEmpty()) { badRequest(ctx, "policy is required"); return; }

            var resp = ctx.response();
            resp.setChunked(true)
                .putHeader("Content-Type",      "text/event-stream; charset=utf-8")
                .putHeader("Cache-Control",     "no-cache")
                .putHeader("Connection",        "keep-alive")
                .putHeader("X-Accel-Buffering", "no");
            writeSse(resp, "started", new JsonObject());

            service.comprehendStateless(policy,
                token         -> writeSse(resp, "token",         new JsonObject().put("text", token)),
                comprehension -> {
                    writeSse(resp, "comprehension", comprehension);
                    writeSse(resp, "done",          new JsonObject());
                    resp.end();
                })
                .onFailure(err -> {
                    writeSse(resp, "error", new JsonObject().put("message", err.getMessage()));
                    resp.end();
                });
        };
    }

    // POST /nomos/generate  — stateless SSE (no rule created)
    public Handler<RoutingContext> generateStateless() {
        return ctx -> {
            JsonObject b = body(ctx); if (b == null) return;
            JsonObject comprehension = b.getJsonObject("comprehension");
            if (comprehension == null) { badRequest(ctx, "comprehension is required"); return; }

            var resp = ctx.response();
            resp.setChunked(true)
                .putHeader("Content-Type",      "text/event-stream; charset=utf-8")
                .putHeader("Cache-Control",     "no-cache")
                .putHeader("Connection",        "keep-alive")
                .putHeader("X-Accel-Buffering", "no");
            writeSse(resp, "started", new JsonObject());

            service.generateStateless(comprehension,
                token  -> writeSse(resp, "token",    new JsonObject().put("text", token)),
                source -> {
                    writeSse(resp, "function", new JsonObject().put("source", source));
                    writeSse(resp, "done",     new JsonObject());
                    resp.end();
                })
                .onFailure(err -> {
                    writeSse(resp, "error", new JsonObject().put("message", err.getMessage()));
                    resp.end();
                });
        };
    }

    // DELETE /nomos/rules/:id
    public Handler<RoutingContext> delete() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            service.delete(session, id)
                .onSuccess(v   -> ok(ctx, new JsonObject().put("ok", true)))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // POST /nomos/rules/:id/reprocess  — edit draft in-place
    public Handler<RoutingContext> reprocessDraft() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            JsonObject b = body(ctx); if (b == null) return;
            String name           = b.getString("name",            "").trim();
            String policy         = b.getString("policyStatement", "").trim();
            JsonObject comp       = b.getJsonObject("comprehension");
            String functionSource = b.getString("functionSource",  "");
            if (name.isEmpty())   { badRequest(ctx, "name is required");            return; }
            if (policy.isEmpty()) { badRequest(ctx, "policyStatement is required"); return; }
            service.reprocessDraft(session, id, name, policy, comp,
                                   functionSource.isBlank() ? null : functionSource.trim())
                .onSuccess(rule -> ok(ctx, new JsonObject().put("rule", rule.toJson())))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // GET /nomos/rules/:id
    public Handler<RoutingContext> get() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            service.get(session, id)
                .onSuccess(opt -> {
                    if (opt.isEmpty()) { ctx.fail(404); return; }
                    ok(ctx, new JsonObject().put("rule", opt.get().toJson()));
                })
                .onFailure(ctx::fail);
        };
    }

    // POST /nomos/rules/:id/comprehend  — SSE
    public Handler<RoutingContext> comprehend() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;

            var resp = ctx.response();
            resp.setChunked(true)
                .putHeader("Content-Type",      "text/event-stream; charset=utf-8")
                .putHeader("Cache-Control",     "no-cache")
                .putHeader("Connection",        "keep-alive")
                .putHeader("X-Accel-Buffering", "no");

            writeSse(resp, "started", new JsonObject());

            service.streamComprehension(session, id,
                token -> writeSse(resp, "token", new JsonObject().put("text", token)),
                comprehension -> {
                    writeSse(resp, "comprehension", comprehension);
                    writeSse(resp, "done", new JsonObject());
                    resp.end();
                })
                .onFailure(err -> {
                    writeSse(resp, "error", new JsonObject().put("message", err.getMessage()));
                    resp.end();
                });
        };
    }

    // POST /nomos/rules/:id/generate  — SSE
    public Handler<RoutingContext> generate() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;

            var resp = ctx.response();
            resp.setChunked(true)
                .putHeader("Content-Type",      "text/event-stream; charset=utf-8")
                .putHeader("Cache-Control",     "no-cache")
                .putHeader("Connection",        "keep-alive")
                .putHeader("X-Accel-Buffering", "no");

            writeSse(resp, "started", new JsonObject());

            service.streamGeneration(session, id,
                token  -> writeSse(resp, "token",    new JsonObject().put("text", token)),
                source -> {
                    writeSse(resp, "function", new JsonObject().put("source", source));
                    writeSse(resp, "done",     new JsonObject());
                    resp.end();
                })
                .onFailure(err -> {
                    writeSse(resp, "error", new JsonObject().put("message", err.getMessage()));
                    resp.end();
                });
        };
    }

    // PATCH /nomos/rules/:id/actions
    public Handler<RoutingContext> updateActions() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            JsonObject b = body(ctx); if (b == null) return;
            service.updateActions(session, id, b)
                .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // POST /nomos/rules/:id/submit-for-review  — CCO submits to developer
    public Handler<RoutingContext> submitForDevReview() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            service.submitForDevReview(session, id)
                .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // POST /nomos/rules/:id/dev-accept  — developer accepts with no edits
    public Handler<RoutingContext> devAccept() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            service.devAccept(session, id)
                .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // POST /nomos/rules/:id/dev-submit  — developer submits edits
    public Handler<RoutingContext> devSubmitEdits() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            JsonObject b = body(ctx); if (b == null) return;
            String editedSource = b.getString("editedSource", "").trim();
            String note         = b.getString("note",         "").trim();
            if (editedSource.isEmpty()) { badRequest(ctx, "editedSource is required"); return; }
            service.devSubmitEdits(session, id, editedSource, note.isEmpty() ? null : note)
                .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // POST /nomos/rules/:id/cco-approve-edits  — CCO approves developer's edits
    public Handler<RoutingContext> ccoApproveEdits() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            service.ccoApproveEdits(session, id)
                .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // POST /nomos/rules/:id/cco-reject-edits  — CCO rejects developer's edits
    public Handler<RoutingContext> ccoRejectEdits() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            JsonObject b = body(ctx); if (b == null) return;
            String note = b.getString("note", "").trim();
            service.ccoRejectEdits(session, id, note.isEmpty() ? null : note)
                .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // POST /nomos/rules/:id/test  — IT runs test scenarios
    public Handler<RoutingContext> runTests() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            JsonObject b = body(ctx); if (b == null) return;
            JsonArray scenarios = b.getJsonArray("scenarios");
            if (scenarios == null || scenarios.isEmpty()) {
                badRequest(ctx, "scenarios array is required"); return;
            }
            service.runTests(session, id, scenarios)
                .onSuccess(results -> ok(ctx, new JsonObject().put("results", results)))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // POST /nomos/rules/:id/deploy  — IT deploys rule to active
    public Handler<RoutingContext> deploy() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            service.deploy(session, id)
                .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // POST /nomos/rules/:id/approve  — legacy (pre-workflow rules)
    public Handler<RoutingContext> approve() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            service.approve(session, id)
                .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // POST /nomos/rules/:id/retire
    public Handler<RoutingContext> retire() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            service.retire(session, id)
                .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // GET /nomos/templates  — AI-generated rule suggestions (SSE so keepalive beats idle timeout)
    public Handler<RoutingContext> suggestTemplates() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            var resp = ctx.response();
            resp.setChunked(true)
                .putHeader("Content-Type",      "text/event-stream; charset=utf-8")
                .putHeader("Cache-Control",     "no-cache")
                .putHeader("Connection",        "keep-alive")
                .putHeader("X-Accel-Buffering", "no");
            // Keepalive: server idle timeout is 30 s; AI generation can take 20–45 s.
            // Send a ping every 10 s so the connection is never considered idle.
            writeSse(resp, "keepalive", new JsonObject());
            long timerId = ctx.vertx().setPeriodic(10_000L, id -> {
                if (!resp.ended()) writeSse(resp, "keepalive", new JsonObject());
            });
            service.suggestTemplates(session)
                .onSuccess(templates -> {
                    ctx.vertx().cancelTimer(timerId);
                    if (!resp.ended()) {
                        writeSse(resp, "templates", new JsonObject().put("templates", templates));
                        resp.end();
                    }
                })
                .onFailure(err -> {
                    ctx.vertx().cancelTimer(timerId);
                    if (!resp.ended()) {
                        writeSse(resp, "error", new JsonObject().put("message",
                            err.getMessage() != null ? err.getMessage() : "AI generation failed"));
                        resp.end();
                    }
                });
        };
    }

    // POST /nomos/rules/batch  — create multiple rules as drafts in one call
    public Handler<RoutingContext> createBatch() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            JsonObject b = body(ctx); if (b == null) return;
            io.vertx.core.json.JsonArray rules = b.getJsonArray("rules");
            if (rules == null || rules.isEmpty()) { badRequest(ctx, "rules array is required"); return; }
            service.createBatch(session, rules)
                .onSuccess(created -> ok(ctx, new JsonObject()
                    .put("created", created.size())
                    .put("rules", created)))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    /**
     * POST /nomos/suggest  — multipart PDF upload → SSE step progress + AI template recommendations.
     *
     * Streams three named steps over text/event-stream:
     *   extract → summarise → generate
     *
     * Each step emits:  event: step  data: {"step":"<id>","status":"in_progress"|"done"}
     * Final result:     event: result data: {"templates":[...]}
     * On error:         event: error  data: {"error":"..."}
     */
    public Handler<RoutingContext> suggestFromDocument() {
        return ctx -> {
            var uploads = ctx.fileUploads();
            if (uploads == null || uploads.isEmpty()) {
                badRequest(ctx, "No file uploaded"); return;
            }
            var upload  = uploads.iterator().next();
            boolean isPdf = upload.fileName() != null
                && upload.fileName().toLowerCase().endsWith(".pdf");

            var resp = ctx.response();
            resp.setChunked(true)
                .putHeader("Content-Type",      "text/event-stream; charset=utf-8")
                .putHeader("Cache-Control",     "no-cache")
                .putHeader("Connection",        "keep-alive")
                .putHeader("X-Accel-Buffering", "no");

            // Send a keepalive ping every 8 s while the AI is working so that the
            // reverse-proxy / Vite dev-proxy never considers the connection idle and
            // buffers or closes it before the result arrives.
            long keepaliveTimer = ctx.vertx().setPeriodic(8_000L, id -> {
                if (!resp.ended()) writeSse(resp, "keepalive", new JsonObject());
            });

            // Step 1: extract text
            writeStep(resp, "extract", "in_progress");

            ctx.vertx().<String>executeBlocking(() -> extractText(upload.uploadedFileName(), isPdf))
            .compose(text -> {
                if (text == null || text.isBlank()) {
                    return io.vertx.core.Future.failedFuture("No readable text found in this document.");
                }
                writeStep(resp, "extract", "done",
                    new JsonObject().put("chars", text.length()));
                writeStep(resp, "summarise", "in_progress");
                return service.summariseDocument(text);
            })
            .compose(summary -> {
                // rough word count: split on whitespace
                int words = summary.isBlank() ? 0 : summary.trim().split("\\s+").length;
                writeStep(resp, "summarise", "done",
                    new JsonObject().put("words", words));
                writeStep(resp, "generate", "in_progress");
                io.vertx.core.Promise<JsonArray> p = io.vertx.core.Promise.promise();
                service.suggestFromSummary(summary, templates -> p.tryComplete(templates))
                    .onFailure(p::tryFail);
                return p.future();
            })
            .onSuccess(templates -> {
                ctx.vertx().cancelTimer(keepaliveTimer);
                writeStep(resp, "generate", "done",
                    new JsonObject().put("count", templates.size()));
                // Chain write → end so the result frame is guaranteed to send
                // before the HTTP chunked terminator closes the stream.
                resp.write("event: result\ndata: " + new JsonObject().put("templates", templates).encode() + "\n\n")
                    .onComplete(v -> resp.end());
            })
            .onFailure(e -> {
                ctx.vertx().cancelTimer(keepaliveTimer);
                String msg = e.getMessage() != null ? e.getMessage() : "Failed to analyse document";
                resp.write("event: error\ndata: " + new JsonObject().put("error", msg).encode() + "\n\n")
                    .onComplete(v -> resp.end());
            });
        };
    }

    private static String extractText(String uploadedPath, boolean isPdf) throws Exception {
        java.io.File f = new java.io.File(uploadedPath);
        if (isPdf) {
            try (org.apache.pdfbox.pdmodel.PDDocument doc = org.apache.pdfbox.Loader.loadPDF(f)) {
                if (doc.getNumberOfPages() == 0)
                    throw new java.io.IOException("The PDF has no pages.");

                // Attempt 1: standard extraction
                String text = new org.apache.pdfbox.text.PDFTextStripper().getText(doc);
                if (text != null && !text.isBlank()) return text;

                // Attempt 2: position-sorted (helps multi-column and rotated layouts)
                org.apache.pdfbox.text.PDFTextStripper sorted = new org.apache.pdfbox.text.PDFTextStripper();
                sorted.setSortByPosition(true);
                text = sorted.getText(doc);
                if (text != null && !text.isBlank()) return text;

                // Attempt 3: page-by-page with sort (catches partially-encoded pages)
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= doc.getNumberOfPages(); i++) {
                    org.apache.pdfbox.text.PDFTextStripper ps = new org.apache.pdfbox.text.PDFTextStripper();
                    ps.setSortByPosition(true);
                    ps.setStartPage(i);
                    ps.setEndPage(i);
                    String page = ps.getText(doc);
                    if (page != null && !page.isBlank()) sb.append(page).append('\n');
                }
                if (!sb.isEmpty()) return sb.toString();

                // Nothing worked — likely a scanned image PDF
                throw new java.io.IOException(
                    "This PDF contains scanned images and has no selectable text. "
                    + "Please upload a text-based PDF, or paste the content as a .txt file.");
            }
        }
        return java.nio.file.Files.readString(f.toPath());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static void writeSse(io.vertx.core.http.HttpServerResponse r, String event, JsonObject data) {
        r.write("event: " + event + "\ndata: " + data.encode() + "\n\n");
    }

    private static void writeStep(io.vertx.core.http.HttpServerResponse r, String step, String status) {
        writeSse(r, "step", new JsonObject().put("step", step).put("status", status));
    }

    private static void writeStep(io.vertx.core.http.HttpServerResponse r, String step, String status, JsonObject meta) {
        JsonObject data = new JsonObject().put("step", step).put("status", status);
        if (meta != null) meta.forEach(e -> data.put(e.getKey(), e.getValue()));
        writeSse(r, "step", data);
    }

    private static Long pathId(RoutingContext ctx) {
        try { return Long.parseLong(ctx.pathParam("id")); }
        catch (NumberFormatException e) { ctx.fail(400); return null; }
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
