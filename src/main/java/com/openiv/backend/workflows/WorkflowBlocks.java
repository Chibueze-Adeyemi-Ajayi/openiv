package com.openiv.backend.workflows;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * The block palette. Each block type declares the customer payload fields it
 * needs; the union across a workflow's blocks is the institution's import
 * contract ("blocks define the payload").
 *
 * A block may appear at most once in a sequence. Case creation on match is
 * built into the executor — it is not a block.
 */
public final class WorkflowBlocks {

  /** BVN and/or NIN lookup — verifies the identifier resolves to a real registered identity. */
  public static final String IDENTITY_VERIFY      = "identity_verify";
  /** Selfie matched against the photo on the BVN or NIN record (liveness + face match). */
  public static final String LIVENESS_MATCH       = "liveness_match";
  /** AML/PEP screening against global watchlists. */
  public static final String PEP_SANCTIONS_SCREEN = "pep_sanctions_screen";
  /** Basic phone carrier lookup — confirms the number is active and registered. */
  public static final String PHONE_BASIC          = "phone_basic";
  /** Phone fraud signals — risk score, leaked, spammer, disposable, suspicious flags. */
  public static final String PHONE_FRAUD          = "phone_fraud";
  /** ID document analysis — passport, driver's licence, national ID, residence permit. */
  public static final String DOCUMENT_VERIFY      = "document_verify";
  /** Internal case history — escalated investigation records lower the trust score. */
  public static final String CASE_HISTORY           = "case_history";
  /** Internal flagged transaction history — repeated suspicious transactions lower the trust score. */
  public static final String FLAGGED_TRANSACTIONS   = "flagged_transactions";

  /** Block type → fields that MUST be in the import payload. */
  private static final Map<String, Set<String>> REQUIRED_FIELDS = Map.of(
      IDENTITY_VERIFY,      Set.of(),
      LIVENESS_MATCH,       Set.of(),
      PEP_SANCTIONS_SCREEN, Set.of("name", "dob"),
      PHONE_BASIC,          Set.of("phone"),
      PHONE_FRAUD,          Set.of("phone"),
      DOCUMENT_VERIFY,      Set.of(),
      CASE_HISTORY,         Set.of(),
      FLAGGED_TRANSACTIONS, Set.of());

  /** Block type → fields accepted but not enforced — block skips gracefully if absent. */
  private static final Map<String, Set<String>> OPTIONAL_FIELDS = Map.of(
      IDENTITY_VERIFY,      Set.of("bvn", "nin"),
      LIVENESS_MATCH,       Set.of("selfie"),
      PEP_SANCTIONS_SCREEN, Set.of(),
      PHONE_BASIC,          Set.of(),
      PHONE_FRAUD,          Set.of(),
      DOCUMENT_VERIFY,      Set.of("doc_front", "doc_back"),
      CASE_HISTORY,         Set.of(),
      FLAGGED_TRANSACTIONS, Set.of());

  /** Default sequence seeded for every institution — identity block at the apex. */
  public static JsonArray defaultSequence() {
    return new JsonArray()
        .add(new JsonObject().put("type", IDENTITY_VERIFY))
        .add(new JsonObject().put("type", PEP_SANCTIONS_SCREEN))
        .add(new JsonObject().put("type", PHONE_BASIC));
  }

  private WorkflowBlocks() {}

  public static boolean isKnownType(String type) {
    return REQUIRED_FIELDS.containsKey(type);
  }

  /** Null when valid, else a human-readable error. */
  public static String validate(JsonArray blocks) {
    if (blocks == null || blocks.isEmpty()) return "Workflow needs at least one block";
    Set<String> seen = new LinkedHashSet<>();
    for (int i = 0; i < blocks.size(); i++) {
      String type = blocks.getJsonObject(i).getString("type", "");
      if (!isKnownType(type)) return "Unknown block type: " + type;
      if (!seen.add(type))    return "Duplicate block: " + type;
    }
    return null;
  }

  /**
   * Union of required and optional customer fields across the workflow's blocks.
   * externalId is always required. Optional fields (e.g. bvn/nin for identity_verify)
   * are accepted but not enforced — the block will use whichever is present.
   */
  public static JsonObject payloadSchema(JsonArray blocks) {
    Set<String> required = new LinkedHashSet<>();
    Set<String> optional = new LinkedHashSet<>();
    required.add("externalId");
    for (int i = 0; i < blocks.size(); i++) {
      String type = blocks.getJsonObject(i).getString("type", "");
      Set<String> req = REQUIRED_FIELDS.get(type);
      if (req != null) required.addAll(req);
      Set<String> opt = OPTIONAL_FIELDS.get(type);
      if (opt != null) optional.addAll(opt);
    }
    optional.removeAll(required); // don't list a field in both arrays
    JsonArray reqArr = new JsonArray();
    required.forEach(reqArr::add);
    JsonArray optArr = new JsonArray();
    optional.forEach(optArr::add);
    return new JsonObject()
        .put("type", "object")
        .put("required", reqArr)
        .put("optional", optArr);
  }
}
