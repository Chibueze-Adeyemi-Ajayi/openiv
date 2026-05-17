package com.openiv.backend.doja;

/**
 * Result of a single Dojah API call (BVN lookup, NIN lookup, phone lookup, or selfie verify).
 * matchScore uses Dojah's 0–100 scale; -1 means no selfie was submitted.
 */
public record DojaVerificationResult(
    String  type,        // "bvn" | "nin" | "phone"
    String  reference,   // identifier that was checked
    boolean verified,    // true = API confirmed identity / selfie matched
    String  firstName,
    String  lastName,
    String  middleName,
    String  dateOfBirth,
    String  phone,
    boolean faceMatch,   // true if selfie matched at ≥ 90% confidence
    double  matchScore,  // 0–100 confidence value from Dojah; -1 if no selfie
    String  rawResponse, // full JSON string for audit trail
    String  photo        // base64 identity photo from BVN/NIN record (nullable)
) {
  public static DojaVerificationResult unverified(String type, String reference, String rawResponse) {
    return new DojaVerificationResult(
        type, reference, false,
        null, null, null, null, null,
        false, -1,
        rawResponse, null);
  }
}
