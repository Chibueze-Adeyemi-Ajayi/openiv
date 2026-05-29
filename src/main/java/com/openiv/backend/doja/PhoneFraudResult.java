package com.openiv.backend.doja;

/**
 * Result of Dojah's /api/v1/fraud/phone screening.
 * Distinct from the basic KYC phone lookup — this endpoint returns
 * a fraud risk score and specific abuse signals.
 */
public record PhoneFraudResult(
    boolean resolved,
    String  phone,
    boolean valid,
    // carrier info
    String  carrier,
    String  lineType,       // "Wireless" | "Landline" | "VoIP"
    String  country,
    // fraud signals
    int     riskScore,      // 0 = clean, 100 = highest risk
    boolean leaked,         // appeared in known data leaks
    boolean spammer,        // reported spam source
    boolean disposable,     // disposable / virtual number
    boolean suspicious,     // combined risk flag
    boolean recentAbuse,    // recent abusive activity
    boolean active,
    String  rawJson
) {

  public static PhoneFraudResult unresolved(String rawJson) {
    return new PhoneFraudResult(
        false, null, false,
        null, null, null,
        0, false, false, false, false, false, false,
        rawJson);
  }

  /** True if any fraud signal is raised — convenience for the scoring engine. */
  public boolean hasFraudSignal() {
    return leaked || spammer || disposable || suspicious || recentAbuse || riskScore >= 40;
  }
}
