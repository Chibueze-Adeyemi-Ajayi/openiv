package com.openiv.backend.nomos;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import io.vertx.core.Future;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.stream.Collectors;

public final class InstitutionRuleService {

    private static final String COMPREHEND_SYSTEM = """
        You are a fraud-rule interpreter for a Nigerian financial institution regulated by the CBN.
        Given a plain-English AML/CFT policy statement, extract the exact conditions and rule category.

        Respond ONLY with a JSON object of this exact shape:
        {
          "summary": "<one-sentence restatement of what the rule flags and why>",
          "ruleType": "<person|location|timing|series|composite>",
          "needsHistory": <true if the rule requires historical transaction counts or volumes, otherwise false>,
          "conditions": [
            {
              "field": "<txn|customer|api>.<fieldName>",
              "op": "<GT|LT|EQ|NEQ|GTE|LTE|CONTAINS|NOT_CONTAINS|IN|NOT_IN>",
              "value": <number|string|boolean|array>,
              "note": "<optional: explain this condition in plain English>"
            }
          ],
          "logic": "AND|OR"
        }

        Field namespaces — use EXACTLY these names:

        txn (current transaction):
          id, customerId, customerName, amount (NGN, number), currency,
          channel ("USSD"|"mobile"|"web"|"POS"|"ATM"|"transfer"),
          direction ("inward"|"outward"), category, narration,
          counterparty, senderAccount, senderBank,
          recipientName, recipientAccount, recipientBank,
          location (string city/state), lat (number|null), lng (number|null),
          ipAddress, deviceId,
          occurredAt (ISO-8601 string — parse for hour/day analysis),
          riskScore (0-100), flaggedStatus, flagReasons (array of strings)

        customer (profile of the initiating customer):
          name, riskScore (0-100), watchlisted (bool),
          subjectType ("individual"|"corporate"),
          hasBvn (bool), hasNin (bool), accountAgeDays (number), dob (string|null)

        api (historical queries — only when needsHistory is true):
          getTransactionCount(days)  — number of txns in last N days
          getTransactionVolume(days) — total NGN volume in last N days
          getFlaggedCount(days)      — number of flagged txns in last N days
          getRecentTransactions(limit) — JSON string of recent txn array

        Rule type guide:
          person    → conditions on customer.watchlisted, customer.riskScore, customer.subjectType, customer.hasBvn/hasNin, customer.accountAgeDays
          location  → conditions on txn.location, txn.lat/lng, txn.ipAddress
          timing    → conditions on hour-of-day or day-of-week derived from txn.occurredAt
          series    → conditions using api.getTransactionCount() / api.getTransactionVolume() / api.getFlaggedCount()
          composite → combinations of the above

        Do not include any text outside the JSON object.
        """;

    private static final String GENERATE_SYSTEM = """
        You are a JavaScript AML rule-function generator for a Nigerian CBN-regulated institution.
        Given a comprehension JSON, generate a single function that evaluates whether a transaction
        should be flagged. Write complete, readable, well-commented JS.

        FUNCTION SIGNATURE (do not change):
          function evaluate(txn, customer, context) { return boolean; }

        ═══════════════════════════════════════════════════════
        EXACT FIELD REFERENCE — use these names only
        ═══════════════════════════════════════════════════════

        TXN object:
          txn.id              — string
          txn.customerId      — string
          txn.customerName    — string
          txn.amount          — number (NGN, already in naira — NOT kobo)
          txn.currency        — string e.g. "NGN"
          txn.channel         — "USSD" | "mobile" | "web" | "POS" | "ATM" | "transfer"
          txn.direction       — "inward" | "outward"
          txn.category        — string e.g. "transfer", "withdrawal", "deposit"
          txn.narration       — string (free-text payment description)
          txn.counterparty    — string (counterparty display name)
          txn.senderAccount   — string
          txn.senderBank      — string
          txn.recipientName   — string
          txn.recipientAccount— string
          txn.recipientBank   — string
          txn.location        — string (city/state, may be null)
          txn.lat             — number or null
          txn.lng             — number or null
          txn.ipAddress       — string or null
          txn.deviceId        — string or null
          txn.occurredAt      — ISO-8601 string e.g. "2025-11-15T03:22:00+01:00"
          txn.riskScore       — number 0–100
          txn.flaggedStatus   — string or null
          txn.flagReasons     — array of strings (may be empty)

        CUSTOMER object (current customer profile):
          customer.name          — string
          customer.riskScore     — number 0–100
          customer.watchlisted   — boolean
          customer.subjectType   — "individual" | "corporate"
          customer.hasBvn        — boolean
          customer.hasNin        — boolean
          customer.accountAgeDays— number (days since account opened)
          customer.dob           — ISO date string or null

        API object (historical queries — synchronous in sandbox, safe to call):
          api.getTransactionCount(days)    → number   (txns by this customer in last N days)
          api.getTransactionVolume(days)   → number   (total NGN sent/received in last N days)
          api.getFlaggedCount(days)        → number   (flagged txns in last N days)
          api.getRecentTransactions(limit) → string   (JSON array — parse with JSON.parse())
            each item has: { id, amount, channel, currency, direction, flaggedStatus, riskScore, occurredAt }

        ═══════════════════════════════════════════════════════
        PATTERNS BY RULE TYPE
        ═══════════════════════════════════════════════════════

        TIMING rules — parse occurredAt for hour/day:
          var d    = new Date(txn.occurredAt);
          var hour = d.getHours();           // 0–23 local (WAT = UTC+1)
          var dow  = d.getDay();             // 0=Sun … 6=Sat
          // e.g. night-time: hour < 5 || hour >= 22

        LOCATION rules — use location string or coordinates:
          // State/city match:  (txn.location || '').toLowerCase().indexOf('lagos') !== -1
          // Distance from hub: use lat/lng haversine if coordinates available

        PERSON rules — customer profile:
          customer.watchlisted === true
          customer.accountAgeDays < 30
          !customer.hasBvn || !customer.hasNin
          customer.riskScore >= 70

        SERIES rules — require api calls:
          var count24h = api.getTransactionCount(1);
          var vol30d   = api.getTransactionVolume(30);
          var recentRaw = api.getRecentTransactions(10);
          var recent    = JSON.parse(recentRaw);
          // structuring detection: multiple txns each below threshold summing above limit
          var flaggedLast7 = api.getFlaggedCount(7);

        ═══════════════════════════════════════════════════════
        OUTPUT RULES
        ═══════════════════════════════════════════════════════
        - Only call api.* when comprehension needsHistory is true
        - Return true to flag the transaction, false otherwise
        - No external calls, no imports, no side effects, no console.log
        - Respond with ONLY the function body — no markdown fences, no explanation
        - Add a short comment above each major condition block
        - Use const/var (no let — Rhino ES5 sandbox)
        - Null-safe: guard txn.lat !== null before using coordinates
        """;

    private static final String BLUE  = "\033[34m";
    private static final String RESET = "\033[0m";

    private static final long TEMPLATE_CACHE_TTL_MS = 24L * 60 * 60 * 1000; // 24 h

    private record CachedTemplates(JsonArray templates, long expiresAt) {
        boolean valid() { return System.currentTimeMillis() < expiresAt; }
    }

    // ── Cache (L1 in-memory, L2 Redis) ───────────────────────────────────────
    private final ConcurrentHashMap<Long, CachedTemplates> templateCache = new ConcurrentHashMap<>();
    private static final long   REDIS_TTL_SECS = TEMPLATE_CACHE_TTL_MS / 1000;

    private final InstitutionRuleRepository      repo;
    private final UserRepository                 users;
    private final NomosAiClient                  ai;
    private final WasmRuleExecutor               executor;
    private final io.vertx.redis.client.RedisAPI redis;

    public InstitutionRuleService(InstitutionRuleRepository repo, UserRepository users,
                                   NomosAiClient ai, WasmRuleExecutor executor,
                                   io.vertx.core.Vertx vertx, String redisUrl) {
        this.repo     = repo;
        this.users    = users;
        this.ai       = ai;
        this.executor = executor;
        this.redis    = initRedis(vertx, redisUrl);
    }

    private static io.vertx.redis.client.RedisAPI initRedis(io.vertx.core.Vertx vertx, String url) {
        if (url == null || url.isBlank()) {
            System.out.println("\033[34m[Nomos] Redis not configured — template cache is in-memory only\033[0m");
            return null;
        }
        try {
            boolean tls = url.startsWith("rediss://");
            io.vertx.core.net.NetClientOptions netOpts = new io.vertx.core.net.NetClientOptions()
                .setSsl(tls)
                .setTrustAll(tls)
                .setHostnameVerificationAlgorithm(tls ? "HTTPS" : "");
            io.vertx.redis.client.Redis client = io.vertx.redis.client.Redis.createClient(
                vertx,
                new io.vertx.redis.client.RedisOptions()
                    .setConnectionString(url)
                    .setNetClientOptions(netOpts));
            System.out.println("\033[34m[Nomos] Redis cache  tls=" + tls + "  url=" + url + "\033[0m");
            return io.vertx.redis.client.RedisAPI.api(client);
        } catch (Exception e) {
            System.err.println("[Nomos] Redis init failed: " + e.getMessage() + " — cache is in-memory only");
            return null;
        }
    }

    private static String redisKey(long instId) { return "nomos:templates:" + instId; }

    private Future<JsonArray> redisGet(long instId) {
        if (redis == null) return Future.succeededFuture(null);
        return redis.get(redisKey(instId))
            .compose(resp -> {
                if (resp == null) return Future.succeededFuture(null);
                try {
                    JsonArray arr = new JsonArray(resp.toString());
                    System.out.println(BLUE + "[Nomos] suggestTemplates  redis hit  institution=" + instId
                        + "  count=" + arr.size() + RESET);
                    return Future.succeededFuture(arr);
                } catch (Exception e) {
                    return Future.succeededFuture(null);
                }
            })
            .recover(e -> {
                System.err.println("[Nomos] Redis GET failed: " + e.getMessage());
                return Future.succeededFuture(null);
            });
    }

    private void redisPut(long instId, JsonArray templates) {
        if (redis == null) return;
        redis.set(java.util.List.of(redisKey(instId), templates.encode(),
                  "EX", String.valueOf(REDIS_TTL_SECS)))
            .onFailure(e -> System.err.println("[Nomos] Redis SET failed: " + e.getMessage()));
    }

    private void redisDel(long instId) {
        if (redis == null) return;
        redis.del(java.util.List.of(redisKey(instId)))
            .onFailure(e -> System.err.println("[Nomos] Redis DEL failed: " + e.getMessage()));
    }

    public Future<List<InstitutionRule>> list(Session session) {
        return resolveUser(session).compose(u -> repo.list(u.institutionId()));
    }

    public Future<InstitutionRule> create(Session session, String name, String policyStatement,
                                          JsonObject comprehension, String functionSource) {
        if (name == null || name.isBlank())
            return Future.failedFuture(new IllegalArgumentException("name is required"));
        if (policyStatement == null || policyStatement.isBlank())
            return Future.failedFuture(new IllegalArgumentException("policyStatement is required"));
        System.out.println(BLUE + "[Nomos] create  name=" + name.trim() + RESET);
        return resolveUser(session).compose(u ->
            repo.create(u.institutionId(), name.trim(), policyStatement.trim(), u.email(),
                        comprehension, functionSource));
    }

    /** Stateless comprehend — no DB touch, for the create flow. */
    public Future<Void> comprehendStateless(String policy,
                                             Consumer<String> onToken,
                                             Consumer<JsonObject> onComplete) {
        if (policy == null || policy.isBlank())
            return Future.failedFuture(new IllegalArgumentException("policy is required"));
        System.out.println(BLUE + "[Nomos] comprehend  policy=" +
            policy.substring(0, Math.min(80, policy.length())) + "…" + RESET);
        return ai.stream(COMPREHEND_SYSTEM, policy, onToken, () -> {})
            .compose(fullText -> {
                System.out.println(BLUE + "[Nomos] comprehend  raw=" + fullText.substring(0, Math.min(120, fullText.length())) + RESET);
                try {
                    JsonObject comp = new JsonObject(fullText.trim());
                    System.out.println(BLUE + "[Nomos] comprehend  → conditions=" +
                        comp.getJsonArray("conditions", new io.vertx.core.json.JsonArray()).size() + RESET);
                    onComplete.accept(comp);
                    return Future.succeededFuture();
                } catch (Exception e) {
                    return Future.failedFuture(fullText.startsWith("<")
                        ? "AI service returned an unexpected response — please retry."
                        : "AI returned malformed output — please retry.");
                }
            });
    }

    /** Stateless generate — no DB touch, for the create flow. */
    public Future<Void> generateStateless(JsonObject comprehension,
                                           Consumer<String> onToken,
                                           Consumer<String> onComplete) {
        if (comprehension == null)
            return Future.failedFuture(new IllegalArgumentException("comprehension is required"));
        String ruleType    = comprehension.getString("ruleType", "composite");
        boolean needsHist  = Boolean.TRUE.equals(comprehension.getBoolean("needsHistory", false));
        System.out.println(BLUE + "[Nomos] generate  ruleType=" + ruleType
            + " needsHistory=" + needsHist
            + " summary=" + comprehension.getString("summary", "—") + RESET);
        String userMsg = "Comprehension JSON:\n" + comprehension.encodePrettily()
            + "\n\nRule type: " + ruleType
            + (needsHist ? "\nThis rule REQUIRES api.* calls for historical data."
                         : "\nThis rule does NOT need api.* calls — use only txn/customer fields.");
        return ai.stream(GENERATE_SYSTEM, userMsg, onToken, () -> {})
            .compose(source -> {
                String clean = source.trim()
                    .replaceAll("^```[a-z]*\\n?", "")
                    .replaceAll("```$", "")
                    .trim();
                System.out.println(BLUE + "[Nomos] generate  → chars=" + clean.length() + RESET);
                onComplete.accept(clean);
                return Future.succeededFuture();
            });
    }

    /** Schema context injected into both SUGGEST_SYSTEM and SUGGEST_TEMPLATES_SYSTEM. */
    private static final String SCHEMA_CONTEXT = """
        ═══════════════════════════════════════════════
        DATA SCHEMA — what the system CURRENTLY captures
        ═══════════════════════════════════════════════
        Transaction fields (txn.*):
          id, customerId, customerName
          amount          — number, Nigerian Naira (NGN)
          currency        — e.g. "NGN"
          channel         — "USSD" | "mobile" | "web" | "POS" | "ATM" | "transfer"
          direction       — "inward" | "outward"
          category        — e.g. "transfer" | "withdrawal" | "deposit"
          narration       — free-text payment description
          counterparty    — counterparty display name
          senderAccount, senderBank
          recipientName, recipientAccount, recipientBank
          location        — city/state string (may be null)
          lat, lng        — GPS coordinates (may be null)
          ipAddress       — originating IP (may be null)
          deviceId        — device fingerprint (may be null)
          occurredAt      — ISO-8601 timestamp (parse for hour/day-of-week analysis)
          riskScore       — 0–100 integer
          flaggedStatus   — string or null
          flagReasons     — array of strings

        Customer profile (customer.*):
          name, riskScore (0–100), watchlisted (boolean)
          subjectType     — "individual" | "corporate"
          hasBvn, hasNin  — booleans (identity document linkage)
          accountAgeDays  — number of days since account opening
          dob             — ISO date string or null

        Historical query API (available for series/velocity rules):
          api.getTransactionCount(days)    — count of txns in last N days
          api.getTransactionVolume(days)   — total NGN volume in last N days
          api.getFlaggedCount(days)        — flagged txns in last N days
          api.getRecentTransactions(limit) — JSON string of recent txn array

        DATA NOT CURRENTLY CAPTURED (flag as dataGap if a rule requires it):
          - destinationCountry / beneficiary country for cross-border flows
          - SWIFT / BIC / IBAN codes
          - formal PEP screening database (only watchlisted boolean is available)
          - source of funds declaration
          - transaction purpose codes (only free-text narration available)
          - ultimate beneficial owner (UBO) details
          - correspondent bank identifiers
          - sanctioned entity screening result
        ═══════════════════════════════════════════════
        """;

    private static final String SUGGEST_SYSTEM = """
        You are a transaction monitoring rule engineer for Nigerian financial institutions regulated by the CBN.
        Given a summary of a CBN policy document, NFIU guidance, or FATF paper, extract ONLY rules that
        can be implemented as real-time transaction screening conditions in a monitoring pipeline.

        ── FOCUS ──────────────────────────────────────────────────────────────────────
        Extract ONLY rules expressible as conditions on individual transaction events, such as:
          • Amount thresholds          (txn.amount > ₦X)
          • Channel restrictions       (txn.channel = "USSD")
          • Direction controls         (txn.direction = "outward")
          • Customer risk conditions   (customer.riskScore > N, customer.watchlisted = true)
          • Account age limits         (customer.accountAgeDays < N)
          • Velocity/frequency rules   (using api.getTransactionCount() / api.getTransactionVolume())
          • Timing patterns            (hour extracted from txn.occurredAt)
          • Geography signals          (txn.location, txn.lat/lng)
          • Identity gaps              (customer.hasBvn = false, customer.hasNin = false)

        EXCLUDE: KYC onboarding procedures, document submission requirements, manual due-diligence
        workflows, regulatory reporting procedures, and governance obligations that are NOT checkable
        as a condition on a single transaction event.

        """ + SCHEMA_CONTEXT + """

        Respond ONLY with a JSON array of 5–10 rule objects.
        EVERY object MUST contain ALL fields — none may be omitted:

        [
          {
            "category":     "<'Structuring' | 'Velocity & Volume' | 'High-Risk Customers' | 'Timing' | 'Channels' | 'Identity & KYC' | 'Geography' | 'Counterparty'>",
            "tag":          "<1-2 word badge>",
            "name":         "<concise rule name, max 8 words>",
            "policy":       "<plain English: IF [condition on available fields] THEN flag. Include exact threshold from the document. 1-2 sentences.>",
            "ruleType":     "<person | location | timing | series | composite>",
            "needsHistory": <true if rule uses api.getTransactionCount / api.getTransactionVolume, false otherwise>,
            "priority":     "<critical | high | medium>",
            "cbkRef":       "<exact CBN/NFIU/FATF reference if cited — null if none>",
            "dataGaps":     ["<schema field that is MISSING and required by this rule — [] if none>"]
          }
        ]

        Strict field rules:
        - "priority": critical = STR-triggering threshold or blocks settlement; high = flagged-customer pattern; medium = monitoring only
        - "cbkRef": always a string or null — never omit
        - "dataGaps": always an array — [] when fully implementable with the current schema
        - "policy": base ALL thresholds strictly on the document — never invent amounts or time windows
        - "policy": use ₦ amounts; convert USD/EUR at ~₦1,600/$ only when the document states a foreign-currency figure
        - Output ONLY the JSON array — no markdown, no explanation
        """;

    private static final String SUGGEST_TEMPLATES_SYSTEM = """
        You are a senior AML/CFT compliance officer at a Nigerian financial institution supervised by
        the Central Bank of Nigeria (CBN). Your role is to identify the most critical transaction
        monitoring rules this institution should have based on current Nigerian regulations.

        Draw from your knowledge of:
        - CBN AML/CFT Regulations 2022 (Reg. No. CBN/REG/DIR/GEN/LAB/06/012)
        - NFIU Guidance Notes and STR Circulars (2022–2024)
        - CBN Risk-Based Supervision Framework 2021
        - FATF Recommendations (2012 updated through 2023)
        - CBN Circular on Cashless Policy Limits (individuals ₦500k/day cash, corporates ₦3m/day)
        - CBN Directive on Mandatory BVN/NIN Linkage (BSD/DIR/PUB/LAB/14/023)
        - NFIU STR/CTR filing thresholds (single transactions ≥ ₦5m, cumulative ≥ ₦10m/day)
        - CBN Enhanced Due Diligence requirements for PEPs and high-risk customers
        - CBN Virtual/Digital Asset monitoring guidance (2023)
        - Indicators of Ponzi/investment scheme activity in Nigerian context
        - Money mule network detection patterns common in Nigerian markets
        - Naira scarcity era (2023-2024) atypical cash flow patterns
        - CBN NIP (NIP/Nibss Instant Payment) velocity thresholds

        """ + SCHEMA_CONTEXT + """

        EXISTING RULES TO SKIP (do not suggest rules already covered by these):
        {EXISTING_RULES}

        Based on what is MISSING, suggest 8–12 additional rules the institution critically needs.
        Prioritise by compliance risk: "critical" (immediate CBN enforcement risk) > "high" > "medium".

        Respond ONLY with a JSON array. Each object:
        {
          "category":    "<logical group: 'Structuring & Smurfing' | 'Velocity & Volume' | 'Identity & KYC' | 'Timing & Behaviour' | 'High-Risk Customers' | 'Location & Network' | 'Counterparty Patterns'>",
          "tag":         "<1-2 word badge>",
          "name":        "<rule name, max 8 words>",
          "policy":      "<plain English description with specific thresholds — 1-2 sentences>",
          "ruleType":    "<person|location|timing|series|composite>",
          "needsHistory": <boolean>,
          "priority":    "<critical|high|medium>",
          "cbkRef":      "<regulation and section reference, or 'CBN AML/CFT Reg. 2022' if general>",
          "dataGaps":    ["<missing field — omit if none>"]
        }
        Do not include any text outside the JSON array.
        """;

    private static final String SUMMARIZE_SYSTEM =
        "You are a transaction monitoring rule analyst. Extract from the provided policy document " +
        "ONLY information that can inform a real-time transaction screening condition:\n" +
        "  • Specific amount thresholds and daily/cumulative limits (exact figures)\n" +
        "  • Transaction velocity rules (count or volume within a time window)\n" +
        "  • Channel restrictions or high-risk channel definitions\n" +
        "  • Customer risk criteria checkable per-transaction (PEP, KYC tier, account age, watchlist)\n" +
        "  • Timing patterns (off-hours, night-time, weekend rules)\n" +
        "  • Geography signals (high-risk locations, cross-border indicators)\n" +
        "  • Identity gap conditions (missing BVN/NIN, unverified customer)\n" +
        "  • STR/CTR filing thresholds that trigger on a single transaction or daily aggregate\n\n" +
        "IGNORE: manual CDD procedures, document collection requirements, governance workflows, " +
        "and any obligation that is not checkable as a condition on a transaction event.\n\n" +
        "Output a numbered list of extracted rules and thresholds only. Maximum 600 words. No preamble.";

    /** Step 1: distil raw document text into rule-relevant bullet points. */
    public Future<String> summariseDocument(String documentText) {
        if (documentText == null || documentText.isBlank())
            return Future.failedFuture(new IllegalArgumentException("documentText is required"));
        String input = documentText.substring(0, Math.min(documentText.length(), 12_000));
        System.out.println(BLUE + "[Nomos] summarise  docLen=" + input.length() + RESET);
        return ai.complete(SUMMARIZE_SYSTEM, input)
            .map(summary -> {
                System.out.println(BLUE + "[Nomos] summarise  → summaryLen=" + summary.length() + RESET);
                return summary;
            });
    }

    /** Step 2: generate rule templates from the compact summary. */
    public Future<Void> suggestFromSummary(String summary, Consumer<JsonArray> onComplete) {
        System.out.println(BLUE + "[Nomos] generate  summaryLen=" + summary.length() + RESET);
        return ai.stream(SUGGEST_SYSTEM, summary, _token -> {}, () -> {})
            .compose(raw -> {
                String clean = raw.trim()
                    .replaceAll("(?s)^```[a-z]*\\n?", "")
                    .replaceAll("```$", "")
                    .trim();
                try {
                    JsonArray templates = new JsonArray(clean);
                    System.out.println(BLUE + "[Nomos] generate  → templates=" + templates.size() + RESET);
                    onComplete.accept(templates);
                    return Future.succeededFuture();
                } catch (Exception e) {
                    return Future.failedFuture(clean.startsWith("<")
                        ? "AI service returned an unexpected response — please retry."
                        : "AI returned malformed output — please retry.");
                }
            });
    }

    /**
     * Generates AI rule suggestions based on current CBN regulations,
     * automatically skipping rules the institution already has.
     * Results are cached per-institution for 24 hours so subsequent
     * page loads are instant and incur no AI cost.
     */
    public Future<JsonArray> suggestTemplates(Session session) {
        return resolveUser(session).compose(u -> {
            long instId = u.institutionId();
            // L1: in-memory
            CachedTemplates cached = templateCache.get(instId);
            if (cached != null && cached.valid()) {
                System.out.println(BLUE + "[Nomos] suggestTemplates  L1 hit  institution=" + instId + RESET);
                return Future.succeededFuture(cached.templates());
            }
            // L2: Redis — warm L1 on hit, fall through to AI on miss
            return redisGet(instId).compose(fromRedis -> {
                if (fromRedis != null) {
                    templateCache.put(instId, new CachedTemplates(fromRedis,
                        System.currentTimeMillis() + TEMPLATE_CACHE_TTL_MS));
                    return Future.succeededFuture(fromRedis);
                }
                return repo.list(instId).compose(existing -> {
                String names = existing.isEmpty() ? "(none)"
                    : existing.stream().map(r -> "- " + r.name()).collect(Collectors.joining("\n"));
                System.out.println(BLUE + "[Nomos] suggestTemplates  existing=" + existing.size()
                    + "  institution=" + instId + RESET);
                String prompt = SUGGEST_TEMPLATES_SYSTEM.replace("{EXISTING_RULES}", names);
                return ai.completeWithTools(prompt, "Generate rule suggestions for this institution. Use the web_search tool to look up the latest CBN AML/CFT regulations, NFIU thresholds, and FATF guidance before generating templates, so the suggestions reflect current regulatory requirements.")
                    .compose(raw -> {
                        String clean = raw.trim()
                            .replaceAll("(?s)^```[a-z]*\\n?", "")
                            .replaceAll("```$", "")
                            .trim();
                        try {
                            JsonArray arr = new JsonArray(clean);
                            long exp = System.currentTimeMillis() + TEMPLATE_CACHE_TTL_MS;
                            System.out.println(BLUE + "[Nomos] suggestTemplates  → count=" + arr.size()
                                + "  cached until +" + (TEMPLATE_CACHE_TTL_MS / 3600_000) + "h" + RESET);
                            templateCache.put(instId, new CachedTemplates(arr, exp));
                            redisPut(instId, arr);
                            return Future.succeededFuture(arr);
                        } catch (Exception e) {
                            return Future.<JsonArray>failedFuture(clean.startsWith("<")
                                ? "AI service returned an unexpected response — please retry."
                                : "AI returned malformed output — please retry.");
                        }
                    });
                }); // repo.list compose
            });     // redisGet compose
        });         // resolveUser compose
    }

    /** Evicts the template cache for an institution (call after rules are created/deleted). */
    public void evictTemplateCache(long institutionId) {
        templateCache.remove(institutionId);
        redisDel(institutionId);
    }

    /**
     * Batch-creates multiple rules as drafts from name+policy pairs.
     * Comprehension and function generation happen later per-rule via the normal flow.
     */
    public Future<JsonArray> createBatch(Session session, JsonArray rules) {
        if (rules == null || rules.isEmpty())
            return Future.failedFuture(new IllegalArgumentException("rules array is required"));
        return resolveUser(session).compose(u -> {
            // Chain creates sequentially to avoid overwhelming the DB pool
            Future<JsonArray> chain = Future.succeededFuture(new JsonArray());
            for (int i = 0; i < rules.size(); i++) {
                JsonObject r = rules.getJsonObject(i);
                String name   = r.getString("name",            "").trim();
                String policy = r.getString("policyStatement", "").trim();
                if (name.isEmpty() || policy.isEmpty()) continue;
                final String n = name, p = policy;
                chain = chain.compose(acc ->
                    repo.create(u.institutionId(), n, p, u.email(), null, null)
                        .map(created -> acc.add(created.toJson())));
            }
            return chain;
        });
    }

    /** Delete a draft rule. */
    public Future<Void> delete(Session session, long id) {
        return resolveUser(session).compose(u ->
            repo.findById(id, u.institutionId()).compose(opt -> {
                if (opt.isEmpty())
                    return Future.failedFuture(new IllegalArgumentException("not found"));
                if (!"draft".equals(opt.get().status()))
                    return Future.failedFuture(new IllegalArgumentException("only draft rules can be deleted"));
                System.out.println(BLUE + "[Nomos] delete  id=" + id + "  name=" + opt.get().name() + RESET);
                return repo.delete(id, u.institutionId());
            }));
    }

    /** Reprocess a draft rule in-place (edit + regenerate flow). */
    public Future<InstitutionRule> reprocessDraft(Session session, long id, String name,
                                                   String policyStatement, JsonObject comprehension,
                                                   String functionSource) {
        if (name == null || name.isBlank())
            return Future.failedFuture(new IllegalArgumentException("name is required"));
        if (policyStatement == null || policyStatement.isBlank())
            return Future.failedFuture(new IllegalArgumentException("policyStatement is required"));
        System.out.println(BLUE + "[Nomos] reprocess  id=" + id + "  name=" + name.trim() + RESET);
        return resolveUser(session).compose(u ->
            repo.reprocessDraft(id, u.institutionId(), name.trim(), policyStatement.trim(),
                                comprehension, functionSource));
    }

    public Future<Optional<InstitutionRule>> get(Session session, long id) {
        return resolveUser(session).compose(u -> repo.findById(id, u.institutionId()));
    }

    public Future<Void> streamComprehension(Session session, long id,
                                             Consumer<String> onToken,
                                             Consumer<JsonObject> onComplete) {
        return resolveUser(session).compose(u ->
            repo.findById(id, u.institutionId()).compose(opt -> {
                if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("not found"));
                InstitutionRule rule = opt.get();
                return ai.stream(COMPREHEND_SYSTEM, rule.policyStatement(), onToken, () -> {})
                    .compose(fullText -> {
                        try {
                            JsonObject comprehension = new JsonObject(fullText.trim());
                            return repo.saveComprehension(id, u.institutionId(), comprehension)
                                .onSuccess(v -> onComplete.accept(comprehension));
                        } catch (Exception e) {
                            return Future.failedFuture(new RuntimeException(clean.startsWith("<") ? "AI service returned an unexpected response — please retry." : "AI returned malformed output — please retry."));
                        }
                    });
            })).mapEmpty();
    }

    public Future<Void> streamGeneration(Session session, long id,
                                          Consumer<String> onToken,
                                          Consumer<String> onComplete) {
        return resolveUser(session).compose(u ->
            repo.findById(id, u.institutionId()).compose(opt -> {
                if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("not found"));
                InstitutionRule rule = opt.get();
                if (rule.comprehension() == null)
                    return Future.failedFuture(new IllegalArgumentException("comprehension must be run first"));

                JsonObject comp    = rule.comprehension();
                String ruleType2   = comp.getString("ruleType", "composite");
                boolean needsHist2 = Boolean.TRUE.equals(comp.getBoolean("needsHistory", false));
                String userMsg = "Comprehension JSON:\n" + comp.encodePrettily()
                    + "\n\nRule type: " + ruleType2
                    + (needsHist2 ? "\nThis rule REQUIRES api.* calls for historical data."
                                  : "\nThis rule does NOT need api.* calls — use only txn/customer fields.");
                return ai.stream(GENERATE_SYSTEM, userMsg, onToken, () -> {})
                    .compose(source -> {
                        String clean = source.trim()
                            .replaceAll("^```[a-z]*\\n?", "")
                            .replaceAll("```$", "")
                            .trim();
                        return repo.saveFunction(id, u.institutionId(), clean, null)
                            .onSuccess(v -> onComplete.accept(clean));
                    });
            })).mapEmpty();
    }

    public Future<Void> updateActions(Session session, long id, JsonObject actions) {
        return resolveUser(session).compose(u ->
            repo.findById(id, u.institutionId()).compose(opt -> {
                if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("not found"));
                RuleActions validated = RuleActions.fromJson(actions);
                return repo.updateActions(id, u.institutionId(), validated.toJson());
            }));
    }

    // ── Workflow: CCO submits to developer ───────────────────────────────────

    public Future<Void> submitForDevReview(Session session, long id) {
        return resolveUser(session).compose(u -> {
            requireCco(u);
            return repo.findById(id, u.institutionId()).compose(opt -> {
                if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("not found"));
                InstitutionRule rule = opt.get();
                if (rule.functionSource() == null || rule.functionSource().isBlank())
                    return Future.failedFuture(new IllegalArgumentException("generate the function before submitting"));
                if (!"draft".equals(rule.status()) && !"pending_approval".equals(rule.status()))
                    return Future.failedFuture(new IllegalArgumentException("rule is not in draft state"));
                return repo.submitForDevReview(id, u.institutionId());
            });
        });
    }

    // ── Workflow: Developer accepts or submits edits ─────────────────────────

    public Future<Void> devAccept(Session session, long id) {
        return resolveUser(session).compose(u -> {
            requireDeveloper(u);
            return repo.findById(id, u.institutionId()).compose(opt -> {
                if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("not found"));
                if (!"pending_dev_review".equals(opt.get().status()))
                    return Future.failedFuture(new IllegalArgumentException("rule is not pending developer review"));
                return repo.devAccept(id, u.institutionId(), u.email());
            });
        });
    }

    public Future<Void> devSubmitEdits(Session session, long id, String editedSource, String note) {
        return resolveUser(session).compose(u -> {
            requireDeveloper(u);
            if (editedSource == null || editedSource.isBlank())
                return Future.failedFuture(new IllegalArgumentException("editedSource is required"));
            return repo.findById(id, u.institutionId()).compose(opt -> {
                if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("not found"));
                if (!"pending_dev_review".equals(opt.get().status()))
                    return Future.failedFuture(new IllegalArgumentException("rule is not pending developer review"));
                return repo.devSubmitEdits(id, u.institutionId(), u.email(), editedSource.trim(), note);
            });
        });
    }

    // ── Workflow: CCO approves or rejects developer edits ────────────────────

    public Future<Void> ccoApproveEdits(Session session, long id) {
        return resolveUser(session).compose(u -> {
            requireCco(u);
            return repo.findById(id, u.institutionId()).compose(opt -> {
                if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("not found"));
                if (!"pending_cco_approval".equals(opt.get().status()))
                    return Future.failedFuture(new IllegalArgumentException("rule is not pending CCO approval"));
                return repo.ccoApproveEdits(id, u.institutionId(), u.email());
            });
        });
    }

    public Future<Void> ccoRejectEdits(Session session, long id, String note) {
        return resolveUser(session).compose(u -> {
            requireCco(u);
            return repo.findById(id, u.institutionId()).compose(opt -> {
                if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("not found"));
                if (!"pending_cco_approval".equals(opt.get().status()))
                    return Future.failedFuture(new IllegalArgumentException("rule is not pending CCO approval"));
                return repo.ccoRejectEdits(id, u.institutionId(), note);
            });
        });
    }

    // ── Workflow: IT runs tests and deploys ──────────────────────────────────

    public Future<JsonArray> runTests(Session session, long id, JsonArray scenarios) {
        return resolveUser(session).compose(u -> {
            requireItRole(u);
            return repo.findById(id, u.institutionId()).compose(opt -> {
                if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("not found"));
                InstitutionRule rule = opt.get();
                String src = rule.functionSource();
                if (src == null || src.isBlank())
                    return Future.failedFuture(new IllegalArgumentException("no function source to test"));

                JsonArray results = new JsonArray();
                for (int i = 0; i < scenarios.size(); i++) {
                    JsonObject s     = scenarios.getJsonObject(i);
                    String label     = s.getString("label", "Scenario " + (i + 1));
                    JsonObject txn   = s.getJsonObject("txn",      new JsonObject());
                    JsonObject cust  = s.getJsonObject("customer", new JsonObject());
                    JsonObject ctx   = s.getJsonObject("context",  new JsonObject());

                    WasmRuleExecutor.RuleResult r = executor.execute(src, txn, cust, ctx);
                    results.add(new JsonObject()
                        .put("label",     label)
                        .put("triggered", r.triggered())
                        .put("reason",    r.reason()));
                }

                return repo.saveTestResults(id, u.institutionId(), results, u.email())
                    .map(results);
            });
        });
    }

    public Future<Void> deploy(Session session, long id) {
        return resolveUser(session).compose(u -> {
            requireItRole(u);
            return repo.findById(id, u.institutionId()).compose(opt -> {
                if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("not found"));
                if (!"pending_it_vetting".equals(opt.get().status()))
                    return Future.failedFuture(new IllegalArgumentException("rule is not pending IT vetting"));
                return repo.deploy(id, u.institutionId(), u.email());
            });
        });
    }

    public Future<Void> retire(Session session, long id) {
        return resolveUser(session).compose(u ->
            repo.findById(id, u.institutionId()).compose(opt -> {
                if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("not found"));
                return repo.updateStatus(id, u.institutionId(), "retired", u.email());
            }));
    }

    // ── Legacy approve (kept for backward compat with old pending_approval rules) ──

    public Future<Void> approve(Session session, long id) {
        return resolveUser(session).compose(u ->
            repo.findById(id, u.institutionId()).compose(opt -> {
                if (opt.isEmpty()) return Future.failedFuture(new IllegalArgumentException("not found"));
                InstitutionRule rule = opt.get();
                if (!"pending_approval".equals(rule.status()))
                    return Future.failedFuture(new IllegalArgumentException("rule is not pending approval"));
                if (u.email().equals(rule.createdBy()))
                    return Future.failedFuture(new IllegalArgumentException("maker cannot approve their own rule"));
                return repo.updateStatus(id, u.institutionId(), "active", u.email());
            }));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private Future<User> resolveUser(Session session) {
        return users.findById(session.userId())
            .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")));
    }

    private static void requireCco(User u) {
        if (!"cco".equals(u.role()) && !"admin".equals(u.role()))
            throw AuthException.security("only CCO or admin can perform this action");
    }

    private static void requireDeveloper(User u) {
        if (!"developer".equals(u.role()) && !"admin".equals(u.role()))
            throw AuthException.security("only a developer can perform this action");
    }

    private static void requireItRole(User u) {
        if (!"developer".equals(u.role()) && !"admin".equals(u.role()))
            throw AuthException.security("only IT (developer/admin) can perform this action");
    }
}
