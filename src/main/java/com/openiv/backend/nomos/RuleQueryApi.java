package com.openiv.backend.nomos;

import io.vertx.core.Future;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Tuple;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Read-only DB API registered in the Rhino sandbox for AI-generated rules.
 *
 * JavaScript usage inside evaluate():
 *   api.getCustomerProfile()          → JSON string
 *   api.getTransactionCount(30)       → number (last N days)
 *   api.getTransactionVolume(30)      → number (NGN, last N days)
 *   api.getFlaggedCount(30)           → number (last N days)
 *   api.getRecentTransactions(10)     → JSON string (array)
 *
 * Security guarantees:
 *  - institutionId baked into constructor — never visible to JS
 *  - All queries parameterized — no injection possible
 *  - SELECT-only; no writes
 *  - Results memoized per evaluation call
 *  - Must run on a worker thread (uses blocking .get() on Futures)
 */
public final class RuleQueryApi {

    private final long   institutionId;
    private final String customerId;
    private final Pool   pool;

    private String cachedProfile;
    private final Map<Integer, Long>   cachedTxnCount    = new HashMap<>();
    private final Map<Integer, Double> cachedTxnVolume   = new HashMap<>();
    private final Map<Integer, Long>   cachedFlaggedCount = new HashMap<>();
    private final Map<Integer, String> cachedRecentTxns  = new HashMap<>();

    public RuleQueryApi(long institutionId, String customerId, Pool pool) {
        this.institutionId = institutionId;
        this.customerId    = customerId;
        this.pool          = pool;
    }

    public String getCustomerProfile() {
        if (cachedProfile != null) return cachedProfile;
        String sql =
            "SELECT name, risk_score, watchlisted, subject_type, dob,"
            + "  bvn IS NOT NULL AS has_bvn,"
            + "  nin IS NOT NULL AS has_nin,"
            + "  COALESCE(DATE_PART('day', NOW() - created_at)::INT, 0) AS account_age_days"
            + " FROM customers"
            + " WHERE institution_id = $1 AND external_id = $2"
            + " LIMIT 1";
        var rs = await(pool.preparedQuery(sql).execute(Tuple.of(institutionId, customerId)));
        var it = rs.iterator();
        JsonObject obj = new JsonObject();
        if (it.hasNext()) {
            var r = it.next();
            obj.put("name",          r.getString("name"))
               .put("riskScore",     r.getInteger("risk_score"))
               .put("watchlisted",   Boolean.TRUE.equals(r.getBoolean("watchlisted")))
               .put("subjectType",   r.getString("subject_type"))
               .put("dob",           r.getLocalDate("dob") != null ? r.getLocalDate("dob").toString() : null)
               .put("hasBvn",        Boolean.TRUE.equals(r.getBoolean("has_bvn")))
               .put("hasNin",        Boolean.TRUE.equals(r.getBoolean("has_nin")))
               .put("accountAgeDays", r.getInteger("account_age_days"));
        }
        cachedProfile = obj.encode();
        return cachedProfile;
    }

    public long getTransactionCount(int days) {
        int safe = clampDays(days);
        return cachedTxnCount.computeIfAbsent(safe, d -> {
            String sql =
                "SELECT COUNT(*) AS cnt FROM transactions"
                + " WHERE institution_id = $1 AND customer_id = $2"
                + "   AND occurred_at >= NOW() - ($3 || ' days')::interval";
            var rs = await(pool.preparedQuery(sql)
                .execute(Tuple.of(institutionId, customerId, String.valueOf(d))));
            var it = rs.iterator();
            return it.hasNext() ? it.next().getLong("cnt") : 0L;
        });
    }

    public double getTransactionVolume(int days) {
        int safe = clampDays(days);
        return cachedTxnVolume.computeIfAbsent(safe, d -> {
            String sql =
                "SELECT COALESCE(SUM(amount), 0) AS vol FROM transactions"
                + " WHERE institution_id = $1 AND customer_id = $2"
                + "   AND occurred_at >= NOW() - ($3 || ' days')::interval";
            var rs = await(pool.preparedQuery(sql)
                .execute(Tuple.of(institutionId, customerId, String.valueOf(d))));
            var it = rs.iterator();
            if (!it.hasNext()) return 0.0;
            BigDecimal bd = it.next().getBigDecimal("vol");
            return bd != null ? bd.doubleValue() : 0.0;
        });
    }

    public long getFlaggedCount(int days) {
        int safe = clampDays(days);
        return cachedFlaggedCount.computeIfAbsent(safe, d -> {
            String sql =
                "SELECT COUNT(*) AS cnt FROM transactions"
                + " WHERE institution_id = $1 AND customer_id = $2"
                + "   AND flagged_status IS NOT NULL"
                + "   AND occurred_at >= NOW() - ($3 || ' days')::interval";
            var rs = await(pool.preparedQuery(sql)
                .execute(Tuple.of(institutionId, customerId, String.valueOf(d))));
            var it = rs.iterator();
            return it.hasNext() ? it.next().getLong("cnt") : 0L;
        });
    }

    public String getRecentTransactions(int limit) {
        int safe = Math.max(1, Math.min(50, limit));
        return cachedRecentTxns.computeIfAbsent(safe, l -> {
            String sql =
                "SELECT id, amount, channel, currency, direction,"
                + "  flagged_status, risk_score, occurred_at"
                + " FROM transactions"
                + " WHERE institution_id = $1 AND customer_id = $2"
                + " ORDER BY occurred_at DESC"
                + " LIMIT $3";
            var rs = await(pool.preparedQuery(sql).execute(Tuple.of(institutionId, customerId, l)));
            JsonArray arr = new JsonArray();
            rs.forEach(r -> arr.add(new JsonObject()
                .put("id",           r.getString("id"))
                .put("amount",       r.getBigDecimal("amount") != null
                                         ? r.getBigDecimal("amount").doubleValue() : 0.0)
                .put("channel",      r.getString("channel"))
                .put("currency",     r.getString("currency"))
                .put("direction",    r.getString("direction"))
                .put("flaggedStatus", r.getString("flagged_status"))
                .put("riskScore",    r.getInteger("risk_score"))
                .put("occurredAt",   r.getOffsetDateTime("occurred_at") != null
                                         ? r.getOffsetDateTime("occurred_at").toString() : null)));
            return arr.encode();
        });
    }

    private static int clampDays(int days) {
        return Math.max(1, Math.min(365, days));
    }

    private <T> T await(Future<T> future) {
        try {
            return future.toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new RuntimeException("api DB error: " + e.getMessage(), e);
        }
    }
}
