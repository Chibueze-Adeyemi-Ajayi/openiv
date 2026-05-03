package com.openiv.backend.transactions;

import io.vertx.core.json.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

public class TransactionScorer {
  private static final Logger log = LoggerFactory.getLogger(TransactionScorer.class);

  public static class ScoringResult {
    public int score;
    public List<String> flags;
    public String reason;

    public ScoringResult(int score, List<String> flags, String reason) {
      this.score = score;
      this.flags = flags;
      this.reason = reason;
    }

    public JsonObject toJson() {
      return new JsonObject()
          .put("score", score)
          .put("flags", flags)
          .put("reason", reason);
    }
  }

  /**
   * Score transaction based on rule-based thresholds.
   * Returns score 0-100 and list of triggered rules.
   */
  public static ScoringResult scoreTransaction(
      Transaction txn,
      long totalTodayCount,
      long totalYesterdayCount,
      long customerTransactionsLast24h,
      boolean hasOtpAlert) {

    var flags = new ArrayList<String>();
    int score = 20; // baseline

    // Rule 1: High-value wire transfer (> 5M NGN)
    if ("wire".equalsIgnoreCase(txn.channel()) && txn.amount().compareTo(BigDecimal.valueOf(5_000_000)) > 0) {
      flags.add("High-value wire transfer");
      score += 20;
    }

    // Rule 2: Velocity clustering - same beneficiary
    // (This would need a count query, for now we'll check overall velocity)
    if (customerTransactionsLast24h > 5) {
      flags.add("High transaction velocity (5+ in 24h)");
      score += 15;
    }

    // Rule 3: Late-night large transfer (23:00-05:00)
    if (isLateNight(txn.occurredAt()) && txn.amount().compareTo(BigDecimal.valueOf(1_000_000)) > 0) {
      flags.add("Late-night large transfer (23:00-05:00)");
      score += 18;
    }

    // Rule 4: OTP Attack Correlation
    if (hasOtpAlert) {
      flags.add("OTP attack detected in time window");
      score += 25;
    }

    // Rule 5: Institution-wide spike
    if (totalTodayCount > totalYesterdayCount * 1.3) {
      flags.add("Institution transaction volume spike (>30%)");
      score += 12;
    }

    // Rule 6: New/unusual channel combination
    if ("wire".equalsIgnoreCase(txn.channel()) && txn.amount().compareTo(BigDecimal.valueOf(2_000_000)) > 0) {
      flags.add("Large wire transfer to new beneficiary");
      score += 15;
    }

    // Rule 7: POS transaction patterns
    if ("pos".equalsIgnoreCase(txn.channel())) {
      // POS transactions at unusual times or excessive amounts
      if (isLateNight(txn.occurredAt())) {
        flags.add("POS transaction at unusual time (23:00-05:00)");
        score += 10;
      }
      if (txn.amount().compareTo(BigDecimal.valueOf(500_000)) > 0) {
        flags.add("Unusually high POS transaction amount");
        score += 8;
      }
    }

    // Cap score at 100
    score = Math.min(score, 100);

    var reason = String.format("Score: %d. Triggers: %s", score, String.join(", ", flags));
    return new ScoringResult(score, flags, reason);
  }

  private static boolean isLateNight(OffsetDateTime dt) {
    int hour = dt.atZoneSameInstant(ZoneOffset.UTC).getHour();
    return hour >= 23 || hour < 5;
  }

  /**
   * Determine case priority based on risk score.
   */
  public static String getPriority(int riskScore) {
    if (riskScore >= 75) return "critical";
    if (riskScore >= 60) return "high";
    if (riskScore >= 40) return "medium";
    return "low";
  }

  /**
   * Determine if transaction should auto-create a case.
   */
  public static boolean shouldCreateCase(int riskScore) {
    return riskScore >= 40;
  }
}
