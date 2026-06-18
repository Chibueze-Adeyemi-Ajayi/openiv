package com.openiv.backend.dojah;

/**
 * Result of one step in the Doja verification pipeline.
 *
 * <p>
 * Each step contributes a risk score (0–100) to the overall pipeline score.
 * {@code dojahCalled = true} indicates the step actually made a billable Dojah
 * API call (used to count points consumed against the institution's monthly
 * KYC cap). Steps that short-circuited on missing data report
 * {@code dojahCalled = false}.
 */
public record PipelineStepResult(
    String step, // "bvn_nin" | "phone_record_basic" | "phone_record_fraud"
                 // | "phone_beam_basic" | "phone_beam_fraud" | "liveness" | "pep_check"
    String status, // "pass" | "fail" | "error" | "unverified" | "skipped"
    String detail,
    long durationMs,
    int riskScore, // 0–100 step-level risk contribution
    boolean dojahCalled // true when this step billed against the KYC cap
) {
  /** Convenience constructor for steps that did not make a Dojah call. */
  public PipelineStepResult(String step, String status, String detail, long durationMs, int riskScore) {
    this(step, status, detail, durationMs, riskScore, false);
  }

  public boolean passed() {
    return "pass".equals(status);
  }

  public boolean skipped() {
    return "skipped".equals(status);
  }
}
