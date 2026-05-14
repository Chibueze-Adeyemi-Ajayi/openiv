package com.openiv.backend.webhooks;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.time.Instant;

/**
 * Builds structured, AI-friendly webhook event payloads for each OpenIV event type.
 *
 * <p>Envelope is consistent across all events:
 * <pre>
 * {
 *   "id":          "beam_<ts>_<random>",
 *   "event":       "tx.flagged",
 *   "version":     "1",
 *   "timestamp":   "<ISO-8601>",
 *   "institution": { "id": 42 },
 *   "environment": "production",
 *   "data":        { ... event-specific ... }
 * }
 * </pre>
 */
public final class WebhookPayloadBuilder {

  private WebhookPayloadBuilder() {}

  // ── Envelope ─────────────────────────────────────────────────────────────

  public static JsonObject envelope(String deliveryId, String eventType,
      long institutionId, JsonObject data) {
    return new JsonObject()
        .put("id",          deliveryId)
        .put("event",       eventType)
        .put("version",     "1")
        .put("timestamp",   Instant.now().toString())
        .put("institution", new JsonObject().put("id", institutionId))
        .put("environment", "production")
        .put("data",        data);
  }

  // ── Per-event payload builders ────────────────────────────────────────────

  /** tx.flagged — transaction crossed a risk threshold and was flagged for review. */
  public static JsonObject txFlagged(long institutionId) {
    return new JsonObject()
        .put("transaction", transaction("TXN-0012481", "NIP240424001248",
            5_000_000, "NGN", "transfer", "mobile",
            party("3012345678", "ADAEZE CHUKWU", "063", "Access Bank"),
            party("0512345678", "ACME LOGISTICS LTD", "011", "First Bank"),
            "Payment for services rendered"))
        .put("risk", new JsonObject()
            .put("score", 87)
            .put("level", "high")
            .put("signals", new JsonArray()
                .add(signal("VELOCITY_BREACH", 35, "5 transactions in 2 minutes"))
                .add(signal("AMOUNT_SPIKE",    28, "4× above 30-day average"))
                .add(signal("NEW_BENEFICIARY", 24, "First transfer to this account")))
            .put("triggeredRule", new JsonObject()
                .put("ruleId", "rule_single_txn_limit")
                .put("name",   "Single transaction limit")
                .put("threshold", 5_000_000)))
        .put("aml", aml(
            new JsonArray()
                .add(indicator("STRUCTURING",  0.72, "Possible transaction layering detected"))
                .add(indicator("PEP_EXPOSURE", 0.41, "Beneficiary linked to politically exposed entity")),
            false, false))
        .put("pattern", pattern(5, 12, 34, 1_250_000, false, false, true));
  }

  /** tx.received — transaction data was successfully ingested and registered. */
  public static JsonObject txReceived(JsonObject transactionData) {
    return new JsonObject()
        .put("transaction", transactionData)
        .put("status", "received")
        .put("receivedAt", Instant.now().toString());
  }

  /** tx.blocked — transaction was automatically blocked before settlement. */
  public static JsonObject txBlocked(long institutionId) {
    return new JsonObject()
        .put("transaction", transaction("TXN-0012482", "NIP240424001249",
            12_000_000, "NGN", "transfer", "ussd",
            party("2011234567", "CHUKWUEMEKA OKAFOR", "044", "GT Bank"),
            party("3098765432", "SHELL CORPORATION X", "058", "GTBank"),
            "Business payment"))
        .put("blockReason", new JsonObject()
            .put("code",    "SANCTIONS_MATCH")
            .put("detail",  "Beneficiary account matches OFAC SDN list entry")
            .put("ruleId",  "rule_sanctions_screening")
            .put("ruleName","Sanctions screening — real time"))
        .put("risk", new JsonObject()
            .put("score", 98)
            .put("level", "critical")
            .put("signals", new JsonArray()
                .add(signal("SANCTIONS_HIT",    60, "Direct OFAC SDN match on beneficiary"))
                .add(signal("ROUND_AMOUNT",     20, "Exact round-number transfer"))
                .add(signal("FIRST_TX_CHANNEL", 18, "First USSD transfer for this user"))))
        .put("aml", aml(
            new JsonArray()
                .add(indicator("SANCTIONS",      0.98, "Confirmed sanctions list hit"))
                .add(indicator("STRUCTURING",    0.55, "Previous day split transfers detected")),
            true, true))
        .put("pattern", pattern(1, 3, 9, 800_000, true, true, true));
  }

  /** case.opened — an investigation case was automatically created. */
  public static JsonObject caseOpened(long institutionId, long caseId, String caseRef) {
    return new JsonObject()
        .put("case", new JsonObject()
            .put("id",               caseId)
            .put("reference",        caseRef)
            .put("title",            "Suspicious transfer sequence — velocity breach")
            .put("type",             "fraud")
            .put("status",           "open")
            .put("priority",         "high")
            .put("assignedTo",       (Object) null)
            .put("transactionCount", 3)
            .put("totalAmount",      15_000_000)
            .put("currency",         "NGN"))
        .put("trigger", new JsonObject()
            .put("ruleId",    "rule_velocity_spike")
            .put("ruleName",  "Velocity spike — 3 transactions within 5 minutes")
            .put("timestamp", Instant.now().toString()))
        .put("transactions", new JsonArray()
            .add(txSummary("TXN-0012479", 5_000_000))
            .add(txSummary("TXN-0012480", 4_800_000))
            .add(txSummary("TXN-0012481", 5_200_000)));
  }

  /** case.escalated — case was escalated to a senior compliance officer. */
  public static JsonObject caseEscalated(long institutionId, long caseId, String caseRef) {
    return new JsonObject()
        .put("case", new JsonObject()
            .put("id",        caseId)
            .put("reference", caseRef)
            .put("title",     "Suspicious transfer sequence — velocity breach")
            .put("type",      "fraud")
            .put("status",    "escalated")
            .put("priority",  "critical"))
        .put("escalation", new JsonObject()
            .put("reason",      "Manual review inconclusive; possible STR candidate")
            .put("escalatedBy", "Compliance Officer L1")
            .put("escalatedAt", Instant.now().toString())
            .put("sarCandidate", true));
  }

  /** sar.filed — a Suspicious Activity Report was filed with the NFIU. */
  public static JsonObject sarFiled(long institutionId, String reportRef) {
    return new JsonObject()
        .put("report", new JsonObject()
            .put("reference",        reportRef)
            .put("type",             "STR")
            .put("filedAt",          Instant.now().toString())
            .put("period",           new JsonObject()
                .put("from", "2026-04-01T00:00:00Z")
                .put("to",   Instant.now().toString()))
            .put("transactionCount", 8)
            .put("totalAmount",      45_000_000)
            .put("currency",         "NGN")
            .put("nfiuStatus",       "accepted")
            .put("nfiuAckRef",       "NFIU-" + reportRef))
        .put("subject", new JsonObject()
            .put("accountNumber", "3012345678")
            .put("name",         "ACME LOGISTICS LTD")
            .put("type",         "corporate"))
        .put("patterns", new JsonArray()
            .add("Multiple round-number credits within 48h")
            .add("Immediate outward transfers after inflow")
            .add("Transactions to 6 distinct non-resident accounts"));
  }

  // ── test.event ────────────────────────────────────────────────────────────

  public static JsonObject testEvent(long institutionId, long endpointId) {
    return new JsonObject()
        .put("message",    "Test beam from OpenIV — your endpoint is correctly configured")
        .put("endpointId", endpointId)
        .put("samplePayload", txFlagged(institutionId));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private static JsonObject transaction(String id, String ref, long amount, String currency,
      String type, String channel, JsonObject sender, JsonObject beneficiary, String narration) {
    return new JsonObject()
        .put("id",          id)
        .put("reference",   ref)
        .put("amount",      amount)
        .put("currency",    currency)
        .put("type",        type)
        .put("channel",     channel)
        .put("initiatedAt", Instant.now().toString())
        .put("sender",      sender)
        .put("beneficiary", beneficiary)
        .put("narration",   narration);
  }

  private static JsonObject party(String acct, String name, String bankCode, String bankName) {
    return new JsonObject()
        .put("accountNumber", acct)
        .put("accountName",   name)
        .put("bankCode",      bankCode)
        .put("bankName",      bankName);
  }

  private static JsonObject signal(String code, int weight, String detail) {
    return new JsonObject()
        .put("code",   code)
        .put("weight", weight)
        .put("detail", detail);
  }

  private static JsonObject aml(JsonArray indicators, boolean watchlistHit, boolean sarRequired) {
    return new JsonObject()
        .put("indicators",   indicators)
        .put("watchlistHit", watchlistHit)
        .put("sarRequired",  sarRequired);
  }

  private static JsonObject indicator(String code, double confidence, String detail) {
    return new JsonObject()
        .put("code",       code)
        .put("confidence", confidence)
        .put("detail",     detail);
  }

  private static JsonObject pattern(int v1h, int v24h, int v7d, long avg30d,
      boolean unusualTime, boolean unusualChannel, boolean firstTimeBeneficiary) {
    return new JsonObject()
        .put("velocity", new JsonObject()
            .put("last1h",  v1h)
            .put("last24h", v24h)
            .put("last7d",  v7d))
        .put("avgAmount30d",         avg30d)
        .put("unusualTimeOfDay",     unusualTime)
        .put("unusualChannel",       unusualChannel)
        .put("firstTimeBeneficiary", firstTimeBeneficiary);
  }

  private static JsonObject txSummary(String id, long amount) {
    return new JsonObject().put("id", id).put("amount", amount).put("currency", "NGN");
  }
}
