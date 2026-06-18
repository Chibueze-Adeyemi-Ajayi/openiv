package com.openiv.backend.monitoring;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.customers.CustomerRepository;
import com.openiv.backend.nomos.RuleQueryApi;
import com.openiv.backend.transactions.TransactionImport;
import com.openiv.backend.transactions.TransactionRepository;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

public final class MonitoringPipelineService {

    private record DefaultRule(String name, String field, String op, String value, String policy) {}

    private static final List<DefaultRule> DEFAULT_RULES = List.of(
        new DefaultRule("High-value transfer",   "txn.amount",                 "GT",  "100000000", "Flag any transaction above ₦100,000,000 regardless of the sending account or recipient."),
        new DefaultRule("High-risk customer",    "customer.riskProfileScore",  "GT",  "70",         "Flag transactions from customers whose platform risk profile score exceeds 70 — this score is computed from case history, identity checks, and PEP status."),
        new DefaultRule("New account",           "customer.accountAgeDays",    "LT",  "30",         "Flag any transaction from an account that was opened less than 30 days ago."),
        new DefaultRule("First-time recipient",  "context.recipientFirstTime", "EQ",  "true",       "Flag transfers to a recipient who has never received funds from this account before."),
        new DefaultRule("International origin",  "context.ipCountryCode",      "NEQ", "NG",         "Flag transactions where the originating IP address is from outside Nigeria.")
    );

    private final com.openiv.backend.nomos.WasmRuleExecutor executor = new com.openiv.backend.nomos.WasmRuleExecutor();

    private final MonitoringPipelineRepository repo;
    private final UserRepository               users;
    private final CustomerRepository           customers;
    private final TransactionRepository        transactions;
    private final Vertx                        vertx;
    private final Pool                         pool;

    public MonitoringPipelineService(MonitoringPipelineRepository repo, UserRepository users,
                                     CustomerRepository customers, TransactionRepository transactions,
                                     Vertx vertx, Pool pool) {
        this.repo         = repo;
        this.users        = users;
        this.customers    = customers;
        this.transactions = transactions;
        this.vertx        = vertx;
        this.pool         = pool;
    }

    public Future<List<MonitoringPipeline>> list(Session session) {
        return resolve(session).compose(u -> repo.listPipelines(u.institutionId()));
    }

    public Future<Optional<MonitoringPipeline>> get(Session session, long id) {
        return resolve(session).compose(u -> repo.findById(id, u.institutionId()));
    }

    public Future<MonitoringPipeline> create(Session session, String name, String description,
                                              String logic, boolean withDefaults) {
        if (name == null || name.isBlank())
            return Future.failedFuture(new IllegalArgumentException("name is required"));
        String safeLogic = "OR".equalsIgnoreCase(logic) ? "OR" : "AND";
        return resolve(session).compose(u ->
            repo.createPipeline(u.institutionId(), name.trim(),
                                description == null ? null : description.trim(),
                                safeLogic, u.email())
                .compose(pipeline -> {
                    if (!withDefaults) return Future.succeededFuture(pipeline);
                    var futures = new java.util.ArrayList<Future<MonitoringRule>>();
                    for (int i = 0; i < DEFAULT_RULES.size(); i++) {
                        DefaultRule dr = DEFAULT_RULES.get(i);
                        futures.add(repo.addRule(pipeline.id(), u.institutionId(),
                                                 dr.name(), dr.field(), dr.op(), dr.value(), dr.policy(), null, i));
                    }
                    return Future.all(futures).compose(v -> repo.findById(pipeline.id(), u.institutionId()))
                                 .map(opt -> opt.orElse(pipeline));
                }));
    }

    public Future<Optional<MonitoringPipeline>> update(Session session, long id,
                                                        String name, String description,
                                                        String logic, String status) {
        if (name == null || name.isBlank())
            return Future.failedFuture(new IllegalArgumentException("name is required"));
        String safeLogic  = "OR".equalsIgnoreCase(logic) ? "OR" : "AND";
        String safeStatus = "inactive".equalsIgnoreCase(status) ? "inactive" : "active";
        return resolve(session).compose(u ->
            repo.updatePipeline(id, u.institutionId(), name.trim(),
                                description == null ? null : description.trim(),
                                safeLogic, safeStatus));
    }

    public Future<Void> delete(Session session, long id) {
        return resolve(session).compose(u -> repo.deletePipeline(id, u.institutionId()));
    }

    public Future<MonitoringRule> addRule(Session session, long pipelineId,
                                          String name, String field, String op,
                                          String value, String policy, String code, int position) {
        if (name == null || name.isBlank())
            return Future.failedFuture(new IllegalArgumentException("name is required"));
        if (field == null || field.isBlank())
            return Future.failedFuture(new IllegalArgumentException("field is required"));
        if (op == null || op.isBlank())
            return Future.failedFuture(new IllegalArgumentException("op is required"));
        if (value == null || value.isBlank())
            return Future.failedFuture(new IllegalArgumentException("value is required"));
        return resolve(session).compose(u ->
            repo.findById(pipelineId, u.institutionId())
                .compose(opt -> {
                    if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("pipeline not found"));
                    return repo.addRule(pipelineId, u.institutionId(),
                                        name.trim(), field.trim(), op.trim().toUpperCase(),
                                        value.trim(), policy != null ? policy.trim() : null,
                                        code != null && !code.isBlank() ? code.trim() : null, position);
                }));
    }

    public Future<Optional<MonitoringRule>> updateRule(Session session, long pipelineId,
                                                        long ruleId, String name,
                                                        String field, String op,
                                                        String value, boolean enabled,
                                                        int position) {
        return resolve(session).compose(u ->
            repo.updateRule(ruleId, pipelineId, u.institutionId(),
                            name.trim(), field.trim(), op.trim().toUpperCase(),
                            value.trim(), enabled, position));
    }

    public Future<Void> deleteRule(Session session, long pipelineId, long ruleId) {
        return resolve(session).compose(u ->
            repo.deleteRule(ruleId, pipelineId, u.institutionId()));
    }

    public Future<JsonObject> evaluate(long institutionId, long pipelineId, JsonObject body) {
        String customerId = body.getString("customerId", "").trim();
        if (customerId.isEmpty())
            return Future.failedFuture(new IllegalArgumentException("customerId is required"));

        return repo.findById(pipelineId, institutionId).compose(pipelineOpt -> {
            if (pipelineOpt.isEmpty())
                return Future.failedFuture(new IllegalArgumentException("pipeline not found"));
            MonitoringPipeline pipeline = pipelineOpt.get();

            return customers.findByExternalId(institutionId, customerId).compose(custOpt -> {

                // ── Customer not found: hold immediately, record the attempt ──────────
                if (custOpt.isEmpty()) {
                    String txnId  = extractTxnId(body);
                    String errMsg = "No customer record matched external ID '" + customerId
                                  + "' in this institution's database. Transaction placed on hold"
                                  + " — initiate onboarding or contact support.";
                    TransactionImport attempt = buildTxnRecord(
                            body, customerId, null, 0, "held", "flagged", txnId);
                    long enabledRules = pipeline.rules().stream().filter(MonitoringRule::enabled).count();
                    return transactions.insertPipelineTransaction(
                                    institutionId, attempt, "TXM_CUSTOMER_NOT_FOUND: " + errMsg)
                            .map(v -> new JsonObject()
                                    .put("pipelineId",    pipeline.id())
                                    .put("pipelineName",  pipeline.name())
                                    .put("customerId",    customerId)
                                    .put("transactionId", txnId)
                                    .put("verdict",       "HOLD")
                                    .put("action",        "HOLD")
                                    .put("errorCode",     "TXM_CUSTOMER_NOT_FOUND")
                                    .put("reason",        errMsg)
                                    .put("logic",         pipeline.logic())
                                    .put("triggered",     0)
                                    .put("total",         (int) enabledRules)
                                    .put("rules",         new JsonArray()));
                }

                // ── Customer found: run rule evaluation ──────────────────────────────
                var cust   = custOpt.get();
                String txnId = extractTxnId(body);

                JsonObject txn     = body.getJsonObject("transaction", new JsonObject());
                JsonObject context = body.getJsonObject("context",     new JsonObject());

                long ageDays = cust.createdAt() != null
                        ? ChronoUnit.DAYS.between(cust.createdAt().toLocalDate(),
                                                  OffsetDateTime.now().toLocalDate())
                        : 0L;
                JsonObject customer = new JsonObject()
                        .put("riskScore",        cust.riskScore())
                        .put("riskProfileScore", cust.riskScore())
                        .put("accountAgeDays",   ageDays)
                        .put("pep",              cust.watchlisted());

                RuleQueryApi api = new RuleQueryApi(institutionId, customerId, pool);

                return vertx.<JsonObject>executeBlocking(() -> {
                    JsonArray ruleResults  = new JsonArray();
                    var matchedReasons = new java.util.ArrayList<String>();
                    long triggered    = 0;
                    long enabledCount = 0;

                    for (MonitoringRule rule : pipeline.rules()) {
                        if (!rule.enabled()) continue;
                        enabledCount++;
                        boolean matched = rule.hasCode()
                            ? executor.execute(rule.code(), txn, customer, context, api).triggered()
                            : evalRule(rule, txn, customer, context);
                        Object actual = resolveField(rule.field(), txn, customer, context);

                        String ruleReason = null;
                        if (matched) {
                            triggered++;
                            ruleReason = buildRuleReason(rule, actual);
                            matchedReasons.add("• " + rule.name() + ": " + ruleReason);
                        }
                        ruleResults.add(new JsonObject()
                            .put("id",      rule.id())
                            .put("name",    rule.name())
                            .put("field",   rule.field())
                            .put("op",      rule.op())
                            .put("value",   rule.value())
                            .put("matched", matched)
                            .put("actual",  actual != null ? actual.toString() : null)
                            .put("reason",  ruleReason));
                    }

                    boolean isOr    = "OR".equals(pipeline.logic());
                    boolean flagged = isOr
                        ? triggered > 0
                        : enabledCount > 0 && triggered == enabledCount;

                    String reason = null;
                    if (flagged) {
                        String ruleList = String.join("\n", matchedReasons);
                        reason = isOr
                            ? triggered + " of " + enabledCount + " rule"
                              + (enabledCount > 1 ? "s" : "") + " triggered — hold recommended.\n" + ruleList
                            : "All " + triggered + " condition"
                              + (triggered > 1 ? "s" : "") + " satisfied — hold required.\n" + ruleList;
                    }

                    return new JsonObject()
                        .put("pipelineId",    pipeline.id())
                        .put("pipelineName",  pipeline.name())
                        .put("customerId",    customerId)
                        .put("transactionId", txnId)
                        .put("verdict",       flagged ? "FLAGGED" : "CLEAR")
                        .put("action",        flagged ? "HOLD"    : "RELEASE")
                        .put("reason",        reason)
                        .put("logic",         pipeline.logic())
                        .put("triggered",     triggered)
                        .put("total",         enabledCount)
                        .put("rules",         ruleResults);

                // ── Persist the transaction so it appears on heatmap + risk map ─────
                }).compose(result -> {
                    boolean flagged = "FLAGGED".equals(result.getString("verdict"));
                    TransactionImport rec = buildTxnRecord(
                            body, customerId, cust.name(), cust.riskScore(),
                            flagged ? "held" : "completed",
                            flagged ? "flagged" : "clear",
                            txnId);
                    return transactions.insertPipelineTransaction(
                                    institutionId, rec, result.getString("reason"))
                            .map(v -> result);
                });
            });
        });
    }

    private static String extractTxnId(JsonObject body) {
        JsonObject txn = body.getJsonObject("transaction", new JsonObject());
        String id = txn.getString("id");
        if (id != null && !id.isBlank()) return id;
        return "txm_" + System.currentTimeMillis() + "_"
                + java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    private static TransactionImport buildTxnRecord(JsonObject body, String customerId,
            String customerName, int riskScore, String status, String flaggedStatus, String txnId) {
        JsonObject txn     = body.getJsonObject("transaction", new JsonObject());
        JsonObject context = body.getJsonObject("context",     new JsonObject());

        Double amtD = txn.getDouble("amount");
        BigDecimal amount = amtD != null ? BigDecimal.valueOf(amtD) : BigDecimal.ZERO;

        OffsetDateTime occurredAt;
        try {
            String ts = txn.getString("timestamp");
            occurredAt = ts != null ? OffsetDateTime.parse(ts) : OffsetDateTime.now();
        } catch (Exception ignored) {
            occurredAt = OffsetDateTime.now();
        }

        return new TransactionImport(
                txnId, customerId, customerName,
                amount,
                txn.getString("channel"),
                txn.getString("counterparty"),
                riskScore, status, flaggedStatus,
                txn.getString("location"),
                txn.getDouble("lat"),
                txn.getDouble("lng"),
                occurredAt,
                null, null,
                null, null, null,
                txn.getString("currency") != null ? txn.getString("currency") : "NGN",
                txn.getString("narration"),
                context.getString("deviceId"),
                context.getString("ipCountryCode"),
                txn.getString("category"),
                txn.getString("direction") != null ? txn.getString("direction") : "outward");
    }

    private static Object resolveField(String field, JsonObject txn, JsonObject customer, JsonObject context) {
        int dot = field.indexOf('.');
        if (dot < 0) return null;
        String ns  = field.substring(0, dot);
        String key = field.substring(dot + 1);
        JsonObject src = switch (ns) {
            case "txn"      -> txn;
            case "customer" -> customer;
            case "context"  -> context;
            default         -> null;
        };
        return src == null ? null : src.getValue(key);
    }

    private static boolean evalRule(MonitoringRule rule, JsonObject txn, JsonObject customer, JsonObject context) {
        Object actual = resolveField(rule.field(), txn, customer, context);
        if (actual == null) return false;
        String ruleVal = rule.value();
        String op      = rule.op();

        // Numeric comparison
        try {
            double a = Double.parseDouble(actual.toString());
            double b = Double.parseDouble(ruleVal);
            return switch (op) {
                case "GT"  -> a >  b;
                case "GTE" -> a >= b;
                case "LT"  -> a <  b;
                case "LTE" -> a <= b;
                case "EQ"  -> a == b;
                case "NEQ" -> a != b;
                default    -> false;
            };
        } catch (NumberFormatException ignored) {}

        // Boolean
        if (actual instanceof Boolean bool) {
            boolean bVal = Boolean.parseBoolean(ruleVal);
            return switch (op) {
                case "EQ"  -> bool == bVal;
                case "NEQ" -> bool != bVal;
                default    -> false;
            };
        }

        // String
        String aStr = actual.toString();
        return switch (op) {
            case "EQ"           -> aStr.equalsIgnoreCase(ruleVal);
            case "NEQ"          -> !aStr.equalsIgnoreCase(ruleVal);
            case "CONTAINS"     -> aStr.contains(ruleVal);
            case "NOT_CONTAINS" -> !aStr.contains(ruleVal);
            case "IN"           -> Arrays.stream(ruleVal.split(","))
                                         .map(String::trim).anyMatch(aStr::equalsIgnoreCase);
            case "NOT_IN"       -> Arrays.stream(ruleVal.split(","))
                                         .map(String::trim).noneMatch(aStr::equalsIgnoreCase);
            default             -> false;
        };
    }

    private static String buildRuleReason(MonitoringRule rule, Object actual) {
        if (rule.policy() != null && !rule.policy().isBlank()) return rule.policy();
        if (actual == null) return rule.name();
        String actualStr = actual.toString();
        String threshold = rule.value();
        String op = rule.op();
        // Human-readable operator
        String opWord = switch (op) {
            case "GT"  -> "exceeded";
            case "GTE" -> "met or exceeded";
            case "LT"  -> "was below";
            case "LTE" -> "was at or below";
            case "EQ"  -> "matched";
            case "NEQ" -> "did not match";
            case "CONTAINS"     -> "contained";
            case "NOT_CONTAINS" -> "did not contain";
            case "IN"           -> "was one of";
            case "NOT_IN"       -> "was not one of";
            default             -> op;
        };
        // Numeric: show both values
        try {
            double a = Double.parseDouble(actualStr);
            double b = Double.parseDouble(threshold);
            // Format as integer if whole number
            String fmtA = a == Math.floor(a) ? String.valueOf((long) a) : actualStr;
            String fmtB = b == Math.floor(b) ? String.valueOf((long) b) : threshold;
            return rule.name() + " — actual: " + fmtA + " " + opWord + " threshold " + fmtB;
        } catch (NumberFormatException ignored) {}
        return rule.name() + " — " + actualStr + " " + opWord + " " + threshold;
    }

    private Future<com.openiv.backend.auth.model.User> resolve(Session session) {
        return users.findById(session.userId())
            .map(opt -> opt.orElseThrow(() ->
                new IllegalArgumentException("user not found")));
    }
}
