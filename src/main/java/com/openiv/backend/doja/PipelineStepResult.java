package com.openiv.backend.doja;

/**
 * Result of one step in the Doja verification pipeline.
 * Every step always runs and produces its own risk score (0–100).
 */
public record PipelineStepResult(
    String step,       // "bvn_nin" | "phone_match" | "liveness" | "pep_check"
    String status,     // "pass" | "fail" | "error" | "unverified"
    String detail,
    long   durationMs,
    int    riskScore   // 0–100 step-level risk contribution
) {
  public boolean passed()  { return "pass".equals(status); }
  public boolean skipped() { return false; } // steps no longer skip
}
