package com.openiv.backend.doja;

/**
 * Result of a Dojah NUBAN (bank account) lookup.
 *
 * {@code bvn} maps to Dojah's {@code identity_number} field.
 * {@code phone} maps to Dojah's {@code phone} field.
 * Both are used by the intelligence pipeline for downstream BVN verification
 * and phone fraud screening.
 */
public record NubanResult(
    boolean resolved,     // false if Dojah returned no entity (account not found)
    String  accountName,  // e.g. "JOHN DOE MUSA"
    String  firstName,
    String  lastName,
    String  otherNames,   // middle name
    String  dob,          // DD/MM/YYYY as returned by Dojah
    String  phone,        // phone number linked to this account
    String  bvn,          // BVN linked to this account (identity_number from Dojah)
    String  identityType, // "BVN" or other
    String  city,
    String  state,
    String  rawJson
) {

  public static NubanResult unresolved(String rawJson) {
    return new NubanResult(
        false, null, null, null, null, null,
        null, null, null, null, null, rawJson);
  }

  /** Full name suitable for PEP screening — prefers accountName, falls back to parts. */
  public String fullName() {
    if (accountName != null && !accountName.isBlank()) return accountName;
    StringBuilder sb = new StringBuilder();
    if (firstName  != null) sb.append(firstName).append(' ');
    if (otherNames != null) sb.append(otherNames).append(' ');
    if (lastName   != null) sb.append(lastName);
    return sb.toString().trim();
  }
}
