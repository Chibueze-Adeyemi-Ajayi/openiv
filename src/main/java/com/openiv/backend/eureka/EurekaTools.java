package com.openiv.backend.eureka;

import com.openiv.backend.cases.CaseRecord;
import com.openiv.backend.cases.CaseRepository;
import com.openiv.backend.customers.Customer;
import com.openiv.backend.customers.CustomerRepository;
import com.openiv.backend.dashboard.DashboardRepository;
import com.openiv.backend.dashboard.DashboardStats;
import com.openiv.backend.nomos.NomosTools;
import com.openiv.backend.transactions.Transaction;
import com.openiv.backend.transactions.TransactionRepository;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Synchronous tool implementations for the Eureka AI tool-call loop.
 * All methods are called from a worker thread (executeBlocking) — blocking DB calls are safe.
 */
final class EurekaTools {

    private final long                  institutionId;
    private final CustomerRepository    customers;
    private final TransactionRepository transactions;
    private final CaseRepository        cases;
    private final DashboardRepository   dashboard;
    private final NomosTools            nomosTools;

    EurekaTools(long institutionId,
                CustomerRepository customers,
                TransactionRepository transactions,
                CaseRepository cases,
                DashboardRepository dashboard,
                String serpApiKey) {
        this.institutionId = institutionId;
        this.customers     = customers;
        this.transactions  = transactions;
        this.cases         = cases;
        this.dashboard     = dashboard;
        this.nomosTools    = new NomosTools(serpApiKey);
    }

    String searchCustomers(String query, int limit) {
        try {
            List<Customer> list = customers.aiSearch(institutionId, query, Math.min(limit, 20))
                .toCompletionStage().toCompletableFuture().get();
            JsonArray arr = new JsonArray();
            for (Customer c : list) {
                arr.add(new JsonObject()
                    .put("externalId",   c.externalId())
                    .put("name",         c.name())
                    .put("bvn",          maskId(c.bvn()))
                    .put("nin",          maskId(c.nin()))
                    .put("phone",        maskPhone(c.phone()))
                    .put("email",        maskEmail(c.email()))
                    .put("accountNumber",maskAccount(c.accountNumber()))
                    .put("riskScore",    c.riskScore())
                    .put("cddRiskScore", c.cddRiskScore())
                    .put("watchlisted",  c.watchlisted())
                    .put("address",      c.address()));
            }
            return new JsonObject().put("count", list.size()).put("customers", arr).encode();
        } catch (Exception e) {
            return err("customer search failed", e);
        }
    }

    String getCustomer(String externalId) {
        try {
            Optional<Customer> opt = customers.findByExternalId(institutionId, externalId)
                .toCompletionStage().toCompletableFuture().get();
            if (opt.isEmpty()) return "{\"error\":\"Customer not found: " + externalId + "\"}";
            Customer c = opt.get();
            return new JsonObject()
                .put("externalId",        c.externalId())
                .put("name",              c.name())
                .put("bvn",               maskId(c.bvn()))
                .put("nin",               maskId(c.nin()))
                .put("phone",             maskPhone(c.phone()))
                .put("email",             maskEmail(c.email()))
                .put("accountNumber",     maskAccount(c.accountNumber()))
                .put("address",           c.address())
                .put("dob",               c.dob() != null ? c.dob().toString() : null)
                .put("subjectType",       c.subjectType())
                .put("riskScore",         c.riskScore())
                .put("cddRiskScore",      c.cddRiskScore())
                .put("watchlisted",       c.watchlisted())
                .put("watchlistedReason", c.watchlistedReason())
                .put("createdAt",         c.createdAt().toString())
                .put("lastEvaluatedAt",   c.lastEvaluatedAt() != null ? c.lastEvaluatedAt().toString() : null)
                .encode();
        } catch (Exception e) {
            return err("customer fetch failed", e);
        }
    }

    String listTransactions(String status, String flaggedStatus, int limit) {
        try {
            int sz   = Math.min(limit, 20);
            var page = transactions.list(institutionId, status, flaggedStatus, null, 1, sz, null, null, null, null, null, 0)
                .toCompletionStage().toCompletableFuture().get();
            JsonArray arr = new JsonArray();
            for (Transaction t : page.transactions()) {
                arr.add(new JsonObject()
                    .put("id",            t.id())
                    .put("amount",        t.amount())
                    .put("currency",      t.currency())
                    .put("riskScore",     t.riskScore())
                    .put("status",        t.status())
                    .put("flaggedStatus", t.flaggedStatus())
                    .put("customerId",    t.customerId())
                    .put("customerName",  t.customerName())
                    .put("channel",       t.channel())
                    .put("direction",     t.direction())
                    .put("occurredAt",    t.occurredAt() != null ? t.occurredAt().toString() : null));
            }
            return new JsonObject().put("total", page.total()).put("transactions", arr).encode();
        } catch (Exception e) {
            return err("transaction list failed", e);
        }
    }

    String getTransaction(String id) {
        try {
            Optional<Transaction> opt = transactions.findById(id, institutionId)
                .toCompletionStage().toCompletableFuture().get();
            if (opt.isEmpty()) return "{\"error\":\"Transaction not found: " + id + "\"}";
            Transaction t = opt.get();
            return new JsonObject()
                .put("id",               t.id())
                .put("amount",           t.amount())
                .put("currency",         t.currency())
                .put("riskScore",        t.riskScore())
                .put("status",           t.status())
                .put("flaggedStatus",    t.flaggedStatus())
                .put("customerId",       t.customerId())
                .put("customerName",     t.customerName())
                .put("channel",          t.channel())
                .put("location",         t.location())
                .put("flagReason",       t.flagReason())
                .put("narration",        t.narration())
                .put("direction",        t.direction())
                .put("senderAccount",    t.senderAccount())
                .put("recipientName",    t.recipientName())
                .put("recipientAccount", t.recipientAccount())
                .put("occurredAt",       t.occurredAt() != null ? t.occurredAt().toString() : null)
                .encode();
        } catch (Exception e) {
            return err("transaction fetch failed", e);
        }
    }

    String listCases(String status, String priority, int limit) {
        try {
            int sz   = Math.min(limit, 20);
            var page = cases.list(institutionId, status, priority, null, 1, sz, null, null, null, null, 0L, "admin", null, null, null)
                .toCompletionStage().toCompletableFuture().get();
            JsonArray arr = new JsonArray();
            for (CaseRecord c : page.cases()) {
                arr.add(new JsonObject()
                    .put("id",           c.id())
                    .put("title",        c.title())
                    .put("status",       c.status())
                    .put("priority",     c.priority())
                    .put("typology",     c.typology())
                    .put("riskScore",    c.riskScore())
                    .put("assigneeName", c.assigneeName())
                    .put("createdAt",    c.createdAt() != null ? c.createdAt().toString() : null));
            }
            return new JsonObject().put("total", page.total()).put("cases", arr).encode();
        } catch (Exception e) {
            return err("cases list failed", e);
        }
    }

    String getCase(String id) {
        try {
            Optional<CaseRecord> opt = cases.findById(id, institutionId, 0)
                .toCompletionStage().toCompletableFuture().get();
            if (opt.isEmpty()) return "{\"error\":\"Case not found: " + id + "\"}";
            CaseRecord c = opt.get();
            return new JsonObject()
                .put("id",           c.id())
                .put("title",        c.title())
                .put("status",       c.status())
                .put("priority",     c.priority())
                .put("typology",     c.typology())
                .put("brief",        c.brief())
                .put("riskScore",    c.riskScore())
                .put("assigneeName", c.assigneeName())
                .put("customerId",   c.customerId())
                .put("customerName", c.customerName())
                .put("createdAt",    c.createdAt() != null ? c.createdAt().toString() : null)
                .encode();
        } catch (Exception e) {
            return err("case fetch failed", e);
        }
    }

    String platformStats() {
        try {
            DashboardStats stats = dashboard.stats(institutionId)
                .toCompletionStage().toCompletableFuture().get();
            return new JsonObject()
                .put("totalToday",       stats.totalToday())
                .put("flaggedToday",     stats.flaggedToday())
                .put("totalYesterday",   stats.totalYesterday())
                .put("flaggedYesterday", stats.flaggedYesterday())
                .put("openCases",        stats.openCases())
                .put("openCasesToday",   stats.openCasesToday())
                .encode();
        } catch (Exception e) {
            return err("platform stats failed", e);
        }
    }

    /** All transactions for a specific customer (by customerId / externalId). */
    String getCustomerTransactions(String customerId, int limit) {
        try {
            int sz   = Math.min(limit, 20);
            var page = transactions.list(institutionId, null, null, customerId, 1, sz, null, null, null, null, null, 0)
                .toCompletionStage().toCompletableFuture().get();
            JsonArray arr = new JsonArray();
            for (Transaction t : page.transactions()) {
                arr.add(new JsonObject()
                    .put("id",            t.id())
                    .put("amount",        t.amount())
                    .put("currency",      t.currency())
                    .put("riskScore",     t.riskScore())
                    .put("status",        t.status())
                    .put("flaggedStatus", t.flaggedStatus())
                    .put("channel",       t.channel())
                    .put("direction",     t.direction())
                    .put("flagReason",    t.flagReason())
                    .put("narration",     t.narration())
                    .put("occurredAt",    t.occurredAt() != null ? t.occurredAt().toString() : null));
            }
            return new JsonObject().put("total", page.total()).put("transactions", arr).encode();
        } catch (Exception e) {
            return err("customer transactions failed", e);
        }
    }

    /** All investigation cases linked to a specific customer (by customerId / externalId). */
    String getCustomerCases(String customerId, int limit) {
        try {
            int sz   = Math.min(limit, 20);
            List<CaseRecord> list = cases.listByCustomer(institutionId, customerId, sz)
                .toCompletionStage().toCompletableFuture().get();
            JsonArray arr = new JsonArray();
            for (CaseRecord c : list) {
                arr.add(new JsonObject()
                    .put("id",           c.id())
                    .put("title",        c.title())
                    .put("status",       c.status())
                    .put("priority",     c.priority())
                    .put("typology",     c.typology())
                    .put("riskScore",    c.riskScore())
                    .put("assigneeName", c.assigneeName())
                    .put("createdAt",    c.createdAt() != null ? c.createdAt().toString() : null));
            }
            return new JsonObject().put("count", list.size()).put("cases", arr).encode();
        } catch (Exception e) {
            return err("customer cases failed", e);
        }
    }

    /**
     * Cross-entity full-schema search — queries ALL columns of customers, transactions and cases
     * simultaneously. Sensitive fields (BVN, NIN, full account numbers, email, phone) are masked
     * before returning to the AI.
     */
    String searchAll(String query, int limit) {
        try {
            int sz = Math.min(limit, 10);

            var custFuture = customers.aiSearch(institutionId, query, sz)
                .toCompletionStage().toCompletableFuture();
            var txnFuture  = transactions.aiSearch(institutionId, query, sz)
                .toCompletionStage().toCompletableFuture();
            var caseFuture = cases.aiSearch(institutionId, query, sz)
                .toCompletionStage().toCompletableFuture();

            List<Customer>     foundCustomers = custFuture.get();
            List<Transaction>  foundTxns      = txnFuture.get();
            List<CaseRecord>   foundCases     = caseFuture.get();

            JsonArray custArr = new JsonArray();
            for (Customer c : foundCustomers) {
                custArr.add(new JsonObject()
                    .put("externalId",       c.externalId())
                    .put("name",             c.name())
                    .put("email",            maskEmail(c.email()))
                    .put("phone",            maskPhone(c.phone()))
                    .put("bvn",              maskId(c.bvn()))
                    .put("nin",              maskId(c.nin()))
                    .put("accountNumber",    maskAccount(c.accountNumber()))
                    .put("address",          c.address())
                    .put("riskScore",        c.riskScore())
                    .put("watchlisted",      c.watchlisted())
                    .put("watchlistedReason",c.watchlistedReason())
                    .put("subjectType",      c.subjectType()));
            }

            JsonArray txnArr = new JsonArray();
            for (Transaction t : foundTxns) {
                txnArr.add(new JsonObject()
                    .put("id",               t.id())
                    .put("amount",           t.amount())
                    .put("currency",         t.currency())
                    .put("riskScore",        t.riskScore())
                    .put("status",           t.status())
                    .put("flaggedStatus",    t.flaggedStatus())
                    .put("flagReason",       t.flagReason())
                    .put("customerId",       t.customerId())
                    .put("customerName",     t.customerName())
                    .put("channel",          t.channel())
                    .put("direction",        t.direction())
                    .put("narration",        t.narration())
                    .put("category",         t.category())
                    .put("location",         t.location())
                    .put("recipientName",    t.recipientName())
                    .put("recipientAccount", maskAccount(t.recipientAccount()))
                    .put("senderAccount",    maskAccount(t.senderAccount()))
                    .put("occurredAt",       t.occurredAt() != null ? t.occurredAt().toString() : null));
            }

            JsonArray caseArr = new JsonArray();
            for (CaseRecord c : foundCases) {
                caseArr.add(new JsonObject()
                    .put("id",           c.id())
                    .put("title",        c.title())
                    .put("status",       c.status())
                    .put("priority",     c.priority())
                    .put("typology",     c.typology())
                    .put("brief",        c.brief())
                    .put("customerName", c.customerName())
                    .put("customerId",   c.customerId())
                    .put("riskScore",    c.riskScore())
                    .put("assigneeName", c.assigneeName())
                    .put("createdAt",    c.createdAt() != null ? c.createdAt().toString() : null));
            }

            return new JsonObject()
                .put("customers",        custArr)
                .put("transactions",     txnArr)
                .put("cases",            caseArr)
                .put("customerCount",    foundCustomers.size())
                .put("transactionCount", foundTxns.size())
                .put("caseCount",        foundCases.size())
                .encode();
        } catch (Exception e) {
            return err("search_all failed", e);
        }
    }

    // ── Masking helpers ──────────────────────────────────────────────────────

    private static String maskId(String v) {
        if (v == null || v.length() < 4) return v;
        return v.substring(0, 3) + "*".repeat(v.length() - 3);
    }

    private static String maskAccount(String v) {
        if (v == null || v.length() < 4) return v;
        return "*".repeat(v.length() - 4) + v.substring(v.length() - 4);
    }

    private static String maskPhone(String v) {
        if (v == null || v.length() < 4) return v;
        return v.substring(0, 3) + "****" + v.substring(v.length() - 2);
    }

    private static String maskEmail(String v) {
        if (v == null || !v.contains("@")) return v;
        int at = v.indexOf('@');
        String local = v.substring(0, at);
        String domain = v.substring(at);
        if (local.length() <= 2) return "**" + domain;
        return local.charAt(0) + "*".repeat(local.length() - 1) + domain;
    }

    /**
     * Aggregated risk profile for a customer: flagged transaction counts, 24h velocity,
     * total/recent flagged summary. Gives the AI a fast "how dangerous is this customer" signal.
     */
    String getCustomerRiskSummary(String customerId) {
        try {
            var flaggedFuture = transactions.flaggedSummaryForCustomer(institutionId, customerId)
                .toCompletionStage().toCompletableFuture();
            var velocityFuture = transactions.countByCustomerLast24h(institutionId, customerId)
                .toCompletionStage().toCompletableFuture();

            JsonObject flaggedSummary = flaggedFuture.get();
            long velocity24h          = velocityFuture.get();

            return new JsonObject()
                .put("customerId",       customerId)
                .put("totalFlagged",     flaggedSummary.getLong("totalFlagged", 0L))
                .put("recentFlagged180d",flaggedSummary.getLong("recentFlagged", 0L))
                .put("txnVelocity24h",   velocity24h)
                .encode();
        } catch (Exception e) {
            return err("customer risk summary failed", e);
        }
    }

    /** Top high-risk customers for the institution (risk score > 75). */
    String getHighRiskCustomers(int limit) {
        try {
            int sz = Math.min(limit, 20);
            List<com.openiv.backend.customers.Customer> list =
                customers.listHighRisk(institutionId, sz, 0)
                    .toCompletionStage().toCompletableFuture().get();
            JsonArray arr = new JsonArray();
            for (com.openiv.backend.customers.Customer c : list) {
                arr.add(new JsonObject()
                    .put("externalId",   c.externalId())
                    .put("name",         c.name())
                    .put("riskScore",    c.riskScore())
                    .put("cddRiskScore", c.cddRiskScore())
                    .put("watchlisted",  c.watchlisted())
                    .put("subjectType",  c.subjectType())
                    .put("createdAt",    c.createdAt().toString()));
            }
            return new JsonObject().put("count", list.size()).put("customers", arr).encode();
        } catch (Exception e) {
            return err("high risk customers failed", e);
        }
    }

    /**
     * Find customers sharing a specific attribute value — BVN, NIN, phone, or address.
     * Critical for mule network detection and identity clustering across accounts.
     */
    String findRelatedCustomers(String field, String value) {
        try {
            List<com.openiv.backend.customers.Customer> list =
                customers.findByAttribute(institutionId, field, value, 15)
                    .toCompletionStage().toCompletableFuture().get();
            JsonArray arr = new JsonArray();
            for (com.openiv.backend.customers.Customer c : list) {
                arr.add(new JsonObject()
                    .put("externalId",   c.externalId())
                    .put("name",         c.name())
                    .put("riskScore",    c.riskScore())
                    .put("watchlisted",  c.watchlisted())
                    .put("phone",        maskPhone(c.phone()))
                    .put("email",        maskEmail(c.email()))
                    .put("accountNumber",maskAccount(c.accountNumber()))
                    .put("bvn",          maskId(c.bvn()))
                    .put("nin",          maskId(c.nin()))
                    .put("address",      c.address()));
            }
            return new JsonObject()
                .put("field", field)
                .put("value", maskId(value))
                .put("count", list.size())
                .put("customers", arr)
                .encode();
        } catch (Exception e) {
            return err("find related customers failed", e);
        }
    }

    /**
     * Find all transactions involving a specific counterparty account number (sender or recipient).
     * Covers ALL customers — the primary tool for detecting structuring networks and layering.
     */
    String findCounterpartyTransactions(String account) {
        try {
            List<com.openiv.backend.transactions.Transaction> list =
                transactions.findByCounterpartyAccount(institutionId, account, 20)
                    .toCompletionStage().toCompletableFuture().get();
            JsonArray arr = new JsonArray();
            for (com.openiv.backend.transactions.Transaction t : list) {
                arr.add(new JsonObject()
                    .put("id",            t.id())
                    .put("customerId",    t.customerId())
                    .put("customerName",  t.customerName())
                    .put("amount",        t.amount())
                    .put("currency",      t.currency())
                    .put("direction",     t.direction())
                    .put("channel",       t.channel())
                    .put("riskScore",     t.riskScore())
                    .put("flaggedStatus", t.flaggedStatus())
                    .put("flagReason",    t.flagReason())
                    .put("narration",     t.narration())
                    .put("senderAccount",    maskAccount(t.senderAccount()))
                    .put("recipientAccount", maskAccount(t.recipientAccount()))
                    .put("occurredAt",    t.occurredAt() != null ? t.occurredAt().toString() : null));
            }
            return new JsonObject()
                .put("account", maskAccount(account))
                .put("count",   list.size())
                .put("transactions", arr)
                .encode();
        } catch (Exception e) {
            return err("counterparty transactions failed", e);
        }
    }

    String webSearch(String query) {
        return nomosTools.webSearch(query);
    }

    private static String err(String label, Exception e) {
        String msg = e.getMessage() != null ? e.getMessage() : "unknown error";
        msg = msg.replaceAll("[\"\\\\]", "").substring(0, Math.min(msg.length(), 150));
        return "{\"error\":\"" + label + ": " + msg + "\"}";
    }
}
