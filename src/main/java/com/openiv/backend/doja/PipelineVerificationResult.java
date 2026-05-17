package com.openiv.backend.doja;

import java.util.List;

/**
 * Aggregate result of running all steps in the Doja verification pipeline.
 * overallRiskScore is the average of all step risk scores (0–100).
 */
public record PipelineVerificationResult(
    String                   customerId,
    List<PipelineStepResult> steps,
    String                   overallStatus,    // "verified" | "partial" | "flagged"
    int                      kycTier,          // 0–3 derived from overallRiskScore
    long                     totalDurationMs,
    int                      overallRiskScore,  // average of step scores
    String                   identityPhoto,    // base64 photo from BVN/NIN record (nullable)
    String                   firstName,
    String                   lastName,
    String                   phone,
    String                   dateOfBirth
) {
  public boolean fullyVerified() { return "verified".equals(overallStatus); }
  public boolean flagged()       { return "flagged".equals(overallStatus);  }
}
