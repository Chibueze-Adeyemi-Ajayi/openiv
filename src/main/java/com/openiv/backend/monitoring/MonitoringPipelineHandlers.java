package com.openiv.backend.monitoring;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.beam.BeamApiKeyHandler;
import com.openiv.backend.nomos.NomosAiClient;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class MonitoringPipelineHandlers {

    private static final String COMPREHEND_SYSTEM =
        "You are a senior software engineer and AML/CFT compliance specialist at a Nigerian commercial bank.\n" +
        "You write production-grade JavaScript rule functions and understand CBN/NFIU regulations deeply.\n\n" +

        "TOOLS — call these BEFORE writing code when needed:\n" +
        "  • geocode_location(location)         — city/region → {lat, lng, countryCode}. Use for geo-fencing rules.\n" +
        "  • convert_to_ngn(amount, currency)   — USD/EUR/GBP → NGN. Use for foreign-currency thresholds.\n" +
        "  • web_search(query)                  — CBN circulars, NFIU thresholds, FATF risk lists.\n\n" +

        "NIGERIAN COMPLIANCE CONTEXT:\n" +
        "  • CBN cash STR threshold: ₦5,000,000; non-cash: ₦10,000,000\n" +
        "  • Tier 1: ₦50,000/day; Tier 2: ₦200,000/day; Tier 3: ₦5,000,000/day\n" +
        "  • NFIU: watch structuring (multiple sub-threshold txns to avoid reporting)\n" +
        "  • PEPs require enhanced due diligence regardless of amount\n" +
        "  • FATF high-risk: Iran, North Korea, Myanmar, Russia, Syria (use web_search to verify current list)\n\n" +

        "DATA FIELDS AVAILABLE AT EVALUATION TIME:\n" +
        "  txn      — { amount, type, channel, currency, lat, lng, recipientId, narration, timestamp }\n" +
        "  customer — { riskProfileScore(0-100), accountAgeDays, tier(tier1|tier2|tier3), kycLevel(basic|enhanced|full),\n" +
        "               dailyTxnCount, dailyTxnVolume(NGN), pep(boolean) }\n" +
        "             riskProfileScore is the platform's COMPOSITE score — already incorporates identity\n" +
        "             verification (Dojah), PEP screening, case history, and watchlist status. Use it\n" +
        "             instead of re-implementing any of those checks. pep(boolean) is also pre-computed.\n" +
        "  context  — { ipCountryCode(ISO-2), recipientFirstTime(boolean), deviceId,\n" +
        "               deviceFirstSeen(boolean), hour(0-23), dayOfWeek(0=Sun..6=Sat) }\n" +
        "  api      — DB read-only access (institutionId scoped, results cached per call):\n" +
        "               api.getCustomerProfile()        → JSON string: { name, riskScore, watchlisted,\n" +
        "                                                  subjectType, dob, hasBvn, hasNin, accountAgeDays }\n" +
        "               api.getTransactionCount(days)   → number of transactions in last N days (1-365)\n" +
        "               api.getTransactionVolume(days)  → total NGN amount transacted in last N days\n" +
        "               api.getFlaggedCount(days)       → number of flagged transactions in last N days\n" +
        "               api.getRecentTransactions(n)    → JSON string: array of { id, amount, channel,\n" +
        "                                                  currency, direction, flaggedStatus, riskScore, occurredAt }\n" +
        "             USAGE: var p = JSON.parse(api.getCustomerProfile());\n" +
        "                    var txns = JSON.parse(api.getRecentTransactions(5));\n" +
        "                    if (p.watchlisted && api.getTransactionVolume(7) > 5000000) return true;\n\n" +

        "JAVASCRIPT ENVIRONMENT (Rhino ES5+):\n" +
        "  • Available: Date, Math, JSON, RegExp, Array, Object, String, Number, Boolean, api\n" +
        "  • NOT available: fetch, require, import, setTimeout, console, Java.*\n" +
        "  • Date.now() → current Unix ms. new Date() works. Use for date-range and time-window rules.\n" +
        "  • All fields may be undefined — always guard: if (txn.lat == null) return false;\n" +
        "  • Use api.* only when the rule needs historical data beyond the current transaction.\n" +
        "  • Function signature: function evaluate(txn, customer, context) { ... return true/false; }\n\n" +

        "EXAMPLE — 'Flag all transfers within Lagos from today till next Friday':\n" +
        "Step 1: call geocode_location('Lagos') → {lat:6.4541, lng:3.3947, countryCode:'NG'}\n" +
        "Step 2: derive bounding box from known Lagos geography\n" +
        "Step 3: produce:\n" +
        "{\"name\":\"Lagos Transfers This Week\",\"field\":\"txn.lat\",\"op\":\"GTE\",\"value\":\"6.355\",\n" +
        " \"code\":\"function evaluate(txn, customer, context) {\\n" +
        "  if (txn.type !== 'transfer') return false;\\n" +
        "  if (txn.lat == null || txn.lng == null) return false;\\n" +
        "  var latOk = txn.lat >= 6.355 && txn.lat <= 6.705;\\n" +
        "  var lngOk = txn.lng >= 3.098 && txn.lng <= 3.728;\\n" +
        "  var now = Date.now();\\n" +
        "  var d = new Date(); var fri = (5 - d.getDay() + 7) % 7 || 7;\\n" +
        "  var endFri = new Date(d.getFullYear(),d.getMonth(),d.getDate()+fri,23,59,59).getTime();\\n" +
        "  var inRange = txn.timestamp != null && txn.timestamp >= now && txn.timestamp <= endFri;\\n" +
        "  return latOk && lngOk && inRange;\\n" +
        "}\"}\n\n" +

        "OUTPUT RULES:\n" +
        "  1. Use tools FIRST, then write the function with real values embedded.\n" +
        "  2. The 'code' function must handle ALL conditions from the description (AND/OR/NOT/loops/ranges).\n" +
        "  3. 'field', 'op', 'value' = the single most important condition (for UI display only).\n" +
        "  4. Return ONLY valid JSON, no markdown, no explanation:\n" +
        "     {\"name\":\"...\",\"field\":\"...\",\"op\":\"...\",\"value\":\"...\",\"code\":\"function evaluate(txn,customer,context){...}\"}\n" +
        "  5. Escape newlines as \\n inside the JSON string value for 'code'.\n" +
        "  6. Naira amounts: whole numbers. Booleans: \"true\"/\"false\". Coordinates: decimal degrees.\n" +
        "  7. NEVER call external APIs or implement identity/PEP/KYC checks from scratch. The platform\n" +
        "     already runs Dojah verification and PEP screening — results are baked into customer.riskProfileScore\n" +
        "     (0-100) and customer.pep (boolean). Use those fields directly.";

    private final MonitoringPipelineService service;
    private final NomosAiClient             ai;

    public MonitoringPipelineHandlers(MonitoringPipelineService service, NomosAiClient ai) {
        this.service = service;
        this.ai      = ai;
    }

    // GET /monitoring/pipelines
    public Handler<RoutingContext> list() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            service.list(session)
                .onSuccess(list -> {
                    var arr = new JsonArray();
                    list.forEach(p -> arr.add(p.toJson()));
                    ok(ctx, new JsonObject().put("pipelines", arr));
                })
                .onFailure(ctx::fail);
        };
    }

    // GET /monitoring/pipelines/:id
    public Handler<RoutingContext> get() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            service.get(session, id)
                .onSuccess(opt -> {
                    if (opt.isEmpty()) { ctx.fail(404); return; }
                    ok(ctx, new JsonObject().put("pipeline", opt.get().toJson()));
                })
                .onFailure(ctx::fail);
        };
    }

    // POST /monitoring/pipelines
    public Handler<RoutingContext> create() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            JsonObject b = body(ctx); if (b == null) return;
            String name        = b.getString("name",        "").trim();
            String description = b.getString("description", "").trim();
            String logic       = b.getString("logic",       "AND").trim();
            boolean withDefaults = b.getBoolean("withDefaults", true);
            if (name.isEmpty()) { badRequest(ctx, "name is required"); return; }
            service.create(session, name, description.isEmpty() ? null : description,
                           logic, withDefaults)
                .onSuccess(p -> ok(ctx, new JsonObject().put("pipeline", p.toJson())))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // PATCH /monitoring/pipelines/:id
    public Handler<RoutingContext> update() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            JsonObject b = body(ctx); if (b == null) return;
            String name        = b.getString("name",        "").trim();
            String description = b.getString("description", "").trim();
            String logic       = b.getString("logic",       "AND");
            String status      = b.getString("status",      "active");
            if (name.isEmpty()) { badRequest(ctx, "name is required"); return; }
            service.update(session, id, name, description.isEmpty() ? null : description,
                           logic, status)
                .onSuccess(opt -> {
                    if (opt.isEmpty()) { ctx.fail(404); return; }
                    ok(ctx, new JsonObject().put("pipeline", opt.get().toJson()));
                })
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // DELETE /monitoring/pipelines/:id
    public Handler<RoutingContext> delete() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long id = pathId(ctx); if (id == null) return;
            service.delete(session, id)
                .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // POST /monitoring/pipelines/:id/rules
    public Handler<RoutingContext> addRule() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long pipelineId = pathId(ctx); if (pipelineId == null) return;
            JsonObject b = body(ctx); if (b == null) return;
            String name     = b.getString("name",     "").trim();
            String field    = b.getString("field",    "").trim();
            String op       = b.getString("op",       "").trim();
            String value    = b.getString("value",    "").trim();
            String policy   = b.getString("policy",   null);
            String code     = b.getString("code",     null);
            int    position = b.getInteger("position", 999);
            if (name.isEmpty())  { badRequest(ctx, "name is required");  return; }
            if (field.isEmpty()) { badRequest(ctx, "field is required"); return; }
            if (op.isEmpty())    { badRequest(ctx, "op is required");    return; }
            if (value.isEmpty()) { badRequest(ctx, "value is required"); return; }
            service.addRule(session, pipelineId, name, field, op, value, policy, code, position)
                .onSuccess(rule -> ok(ctx, new JsonObject().put("rule", rule.toJson())))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // PATCH /monitoring/pipelines/:pipelineId/rules/:ruleId
    public Handler<RoutingContext> updateRule() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long pipelineId = pathId(ctx);        if (pipelineId == null) return;
            Long ruleId     = pathRuleId(ctx);    if (ruleId == null)     return;
            JsonObject b = body(ctx); if (b == null) return;
            String  name     = b.getString("name",     "").trim();
            String  field    = b.getString("field",    "").trim();
            String  op       = b.getString("op",       "").trim();
            String  value    = b.getString("value",    "").trim();
            boolean enabled  = b.getBoolean("enabled", true);
            int     position = b.getInteger("position", 0);
            if (name.isEmpty() || field.isEmpty() || op.isEmpty() || value.isEmpty()) {
                badRequest(ctx, "name, field, op and value are required"); return;
            }
            service.updateRule(session, pipelineId, ruleId, name, field, op, value, enabled, position)
                .onSuccess(opt -> {
                    if (opt.isEmpty()) { ctx.fail(404); return; }
                    ok(ctx, new JsonObject().put("rule", opt.get().toJson()));
                })
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // DELETE /monitoring/pipelines/:pipelineId/rules/:ruleId
    public Handler<RoutingContext> deleteRule() {
        return ctx -> {
            var session = SessionAuthHandler.require(ctx);
            Long pipelineId = pathId(ctx);     if (pipelineId == null) return;
            Long ruleId     = pathRuleId(ctx); if (ruleId == null)     return;
            service.deleteRule(session, pipelineId, ruleId)
                .onSuccess(v -> ok(ctx, new JsonObject().put("ok", true)))
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // POST /monitoring/pipelines/:id/evaluate  (Bearer API-key auth via BeamApiKeyHandler)
    public Handler<RoutingContext> evaluate() {
        return ctx -> {
            Long institutionId = ctx.get(BeamApiKeyHandler.INSTITUTION_ID_KEY);
            if (institutionId == null) { ctx.fail(401); return; }
            Long id = pathId(ctx); if (id == null) return;
            JsonObject b = body(ctx); if (b == null) return;
            service.evaluate(institutionId, id, b)
                .onSuccess(result -> ok(ctx, result))
                .onFailure(err -> {
                    if (err.getMessage() != null && err.getMessage().contains("not found"))
                        ctx.fail(404);
                    else
                        badRequest(ctx, err.getMessage());
                });
        };
    }

    // POST /monitoring/rules/comprehend
    public Handler<RoutingContext> comprehendRule() {
        return ctx -> {
            SessionAuthHandler.require(ctx);
            JsonObject b = body(ctx); if (b == null) return;
            String description = b.getString("description", "").trim();
            if (description.isEmpty()) { badRequest(ctx, "description is required"); return; }
            String guardError = validateComplianceInput(description);
            if (guardError != null) { badRequest(ctx, guardError); return; }
            ai.completeWithTools(COMPREHEND_SYSTEM, description)
                .onSuccess(raw -> {
                    try {
                        // Strip markdown code fences if the model wraps the JSON
                        String json = raw.strip();
                        if (json.startsWith("```")) {
                            json = json.replaceAll("^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
                        }
                        JsonObject result = new JsonObject(json);
                        ok(ctx, result);
                    } catch (Exception e) {
                        badRequest(ctx, "AI returned unexpected format: " + e.getMessage());
                    }
                })
                .onFailure(err -> badRequest(ctx, err.getMessage()));
        };
    }

    // ── Guardrail ─────────────────────────────────────────────────────────────

    private static final java.util.Set<String> FINANCE_KEYWORDS = java.util.Set.of(
        "transaction", "transfer", "payment", "amount", "account", "customer",
        "risk", "flag", "block", "hold", "suspicious", "fraud", "aml", "kyc",
        "deposit", "withdrawal", "credit", "debit", "limit", "threshold",
        "recipient", "sender", "balance", "channel", "daily", "monthly",
        "currency", "naira", "ngn", "usd", "eur", "gbp", "location", "country",
        "ip", "device", "tier", "pep", "cbn", "nfiu", "bank", "wire", "swift",
        "beneficiary", "cash", "atm", "pos", "mobile", "inflow", "outflow",
        "structuring", "velocity", "frequency", "latitude", "longitude", "city"
    );

    private static final java.util.List<String> INJECTION_PATTERNS = java.util.List.of(
        "ignore previous", "ignore all", "disregard", "forget everything",
        "you are now", "you are a", "pretend", "roleplay", "act as",
        "jailbreak", "bypass", "override", "system prompt", "new task",
        "instead of", "do not follow", "\\n\\n", "</s>", "<|im_end|>",
        "###instruction", "[system]", "[user]", "print(", "exec(", "eval("
    );

    /** Returns an error message if the input is not a valid compliance rule description, null if OK. */
    private static String validateComplianceInput(String description) {
        if (description.length() < 8)
            return "Description is too short to define a monitoring rule.";
        if (description.length() > 1500)
            return "Description must be 1500 characters or fewer.";

        String lower = description.toLowerCase();

        for (String pattern : INJECTION_PATTERNS) {
            if (lower.contains(pattern))
                return "Invalid input: contains a disallowed pattern.";
        }

        boolean hasFinanceKeyword = FINANCE_KEYWORDS.stream().anyMatch(lower::contains);
        if (!hasFinanceKeyword)
            return "Input must describe a financial transaction monitoring rule " +
                   "(e.g. amounts, account conditions, risk indicators, locations).";

        return null;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static Long pathId(RoutingContext ctx) {
        try { return Long.parseLong(ctx.pathParam("id")); }
        catch (Exception e) { ctx.fail(400); return null; }
    }

    private static Long pathRuleId(RoutingContext ctx) {
        try { return Long.parseLong(ctx.pathParam("ruleId")); }
        catch (Exception e) { ctx.fail(400); return null; }
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
