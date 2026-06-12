package com.openiv.backend.transactions;

import io.vertx.core.json.JsonObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Holds the scoring result type and priority/case helpers used across the
 * transaction-analysis pipeline.
 *
 * Removed: scoreTransaction() — that method was dead code replaced by
 * HybridTransactionAnalysisService.scoreWithThresholds(), which reads live
 * per-institution thresholds from the database instead of hardcoded constants.
 */
public class TransactionScorer {

  public static class ScoringResult {
    public int score;
    public List<String> flags;
    public String reason;
    public List<Integer> ruleScores;

    public ScoringResult(int score, List<String> flags, String reason) {
      this(score, flags, reason, new ArrayList<>());
    }

    public ScoringResult(int score, List<String> flags, String reason, List<Integer> ruleScores) {
      this.score      = score;
      this.flags      = flags;
      this.reason     = reason;
      this.ruleScores = ruleScores;
    }

    public JsonObject toJson() {
      return new JsonObject()
          .put("score",  score)
          .put("flags",  flags)
          .put("reason", reason);
    }
  }

  /** Maps a 0-100 risk score to a case priority label. */
  public static String getPriority(int riskScore) {
    if (riskScore >= 75) return "critical";
    if (riskScore >= 60) return "high";
    if (riskScore >= 40) return "medium";
    return "low";
  }

  /** Returns true when the score meets the institution's case-creation threshold. */
  public static boolean shouldCreateCase(int riskScore, int caseThreshold) {
    return riskScore >= caseThreshold;
  }
}
