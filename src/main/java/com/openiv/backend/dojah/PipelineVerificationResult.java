package com.openiv.backend.dojah;

import java.util.List;

/**
 * Aggregate result of running the Doja verification pipeline for one customer.
 *
 * <p>
 * {@code overallRiskScore} is the average of all step risk scores (0–100).
 *
 * <p>
 * Billing fields describe how the run consumed the institution's monthly
 * KYC cap:
 * <ul>
 * <li>{@code pointsReserved} — worst-case step count locked up-front.</li>
 * <li>{@code pointsUsed} — actual Dojah calls billed (one per step).</li>
 * <li>{@code pointsRefunded} — unused points released back to the cap
 * ({@code pointsReserved} − {@code pointsUsed}).</li>
 * <li>{@code pointsRemaining}— points left in the institution's cap after
 * this run settles, or -1 when the plan has no cap.</li>
 * <li>{@code capReached} — true when pre-flight refused to start because
 * the institution did not have enough remaining points.</li>
 * </ul>
 */
public record PipelineVerificationResult(
    String customerId,
    List<PipelineStepResult> steps,
    String overallStatus, // "verified" | "partial" | "flagged" | "cap_reached"
    int kycTier, // 0–3 derived from overallRiskScore
    long totalDurationMs,
    int overallRiskScore, // average of step scores
    String identityPhoto, // base64 photo from BVN/NIN record (nullable)
    String firstName,
    String lastName,
    String phone,
    String dateOfBirth,
    // ── billing ─────────────────────────────────────────────────────────────
    int pointsReserved,
    int pointsUsed,
    int pointsRefunded,
    long pointsRemaining,
    boolean capReached,
    String capReachedDetail) {
  public boolean fullyVerified() {
    return "verified".equals(overallStatus);
  }

  public boolean flagged() {
    return "flagged".equals(overallStatus);
  }

  /**
   * Constructor compatible with call sites that pre-date the billing fields.
   * Defaults billing to zero / not-cap-reached.
   */
  public PipelineVerificationResult(String customerId, List<PipelineStepResult> steps,
      String overallStatus, int kycTier, long totalDurationMs, int overallRiskScore,
      String identityPhoto, String firstName, String lastName, String phone, String dateOfBirth) {
    this(customerId, steps, overallStatus, kycTier, totalDurationMs, overallRiskScore,
        identityPhoto, firstName, lastName, phone, dateOfBirth,
        0, 0, 0, -1L, false, null);
  }
}
