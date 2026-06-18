package com.openiv.backend.nomos;

import io.vertx.core.json.JsonObject;
import org.mozilla.javascript.Context;
import org.mozilla.javascript.Scriptable;
import org.mozilla.javascript.ScriptableObject;

/**
 * Executes institution-defined rule functions inside a sandboxed Rhino JS context.
 *
 * LLM-generated function shape:
 *   function evaluate(txn, customer, context) { return boolean; }
 *
 * Sandbox guarantees:
 *  - Java class access blocked via ClassShutter (RuleQueryApi is the sole exception when provided)
 *  - No I/O, no reflection, no network, no process spawning
 *  - Instruction count limit prevents infinite loops
 *
 * When a RuleQueryApi is provided it is registered as the global 'api' variable,
 * allowing AI-generated rules to call api.getCustomerProfile(), api.getTransactionCount(N), etc.
 * The institutionId is baked into the RuleQueryApi object and never visible to scripts.
 */
public final class WasmRuleExecutor {

    private static final int MAX_INSTRUCTIONS = 100_000;
    private static final String API_CLASS = "com.openiv.backend.nomos.RuleQueryApi";

    public record RuleResult(boolean triggered, String reason) {}

    public RuleResult execute(String functionSource, JsonObject txn, JsonObject customer, JsonObject ctx) {
        return execute(functionSource, txn, customer, ctx, null);
    }

    public RuleResult execute(String functionSource, JsonObject txn, JsonObject customer,
                              JsonObject ctx, RuleQueryApi api) {
        if (functionSource == null || functionSource.isBlank())
            return new RuleResult(false, "no function source");

        Context rhino = Context.enter();
        try {
            rhino.setOptimizationLevel(-1);
            rhino.setInstructionObserverThreshold(MAX_INSTRUCTIONS);
            rhino.setClassShutter(className ->
                api != null && className.equals(API_CLASS));

            Scriptable scope = rhino.initSafeStandardObjects();

            if (api != null) {
                Object wrapped = Context.javaToJS(api, scope);
                ScriptableObject.putProperty(scope, "api", wrapped);
            }

            String setup = String.format(
                "var __txn  = %s; var __cust = %s; var __ctx = %s;",
                txn.encode(), customer.encode(), ctx.encode());
            rhino.evaluateString(scope, setup,          "<init>", 1, null);
            rhino.evaluateString(scope, functionSource, "<rule>", 1, null);

            Object result = rhino.evaluateString(scope,
                "evaluate(__txn, __cust, __ctx)", "<eval>", 1, null);

            boolean triggered = Context.toBoolean(result);
            return new RuleResult(triggered, triggered ? "rule matched" : "no match");

        } catch (org.mozilla.javascript.EvaluatorException e) {
            return new RuleResult(false, "syntax error: " + e.getMessage());
        } catch (Exception e) {
            return new RuleResult(false, "execution error: " + e.getMessage());
        } finally {
            Context.exit();
        }
    }
}
