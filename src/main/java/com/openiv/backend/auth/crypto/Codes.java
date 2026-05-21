package com.openiv.backend.auth.crypto;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;

/**
 * Short-lived verification codes (email verification, password reset).
 *
 * <p>6-digit numeric. Stored hashed (SHA-256) so a DB leak can't replay codes. Hash-only is
 * acceptable here because the keyspace is small (10^6) and codes expire within minutes — an
 * offline brute force buys an attacker nothing useful.
 */
public final class Codes {

  private static final SecureRandom RNG = new SecureRandom();

  private Codes() {}

  /** Generate a random N-digit numeric code, zero-padded. */
  public static String generateNumeric(int digits) {
    if (digits < 4 || digits > 10) {
      throw new IllegalArgumentException("digits out of range");
    }
    int bound = (int) Math.pow(10, digits);
    int value = RNG.nextInt(bound);
    return String.format("%0" + digits + "d", value);
  }

  /** Invitation codes: longer, random, readable. Format: XXXX-XXXX-XXXX-XXXX (upper A-Z, 2-9). */
  public static String generateInviteCode() {
    // Avoid ambiguous chars: 0/O, 1/I/L.
    String alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    StringBuilder sb = new StringBuilder(19);
    for (int i = 0; i < 16; i++) {
      if (i > 0 && i % 4 == 0) {
        sb.append('-');
      }
      sb.append(alphabet.charAt(RNG.nextInt(alphabet.length())));
    }
    return sb.toString();
  }

  /**
   * Generates a human-friendly temporary password: 4 uppercase letters + dash + 4 digits + dash +
   * 4 uppercase letters. Always satisfies the minimum strength requirements (letters + digits,
   * 13 chars). Example: {@code JWBK-4892-MNQR}.
   */
  public static String generateTempPassword() {
    String letters = "ABCDEFGHJKMNPQRSTUVWXYZ"; // no I/O/L (ambiguous)
    String digits  = "23456789";                 // no 0/1
    StringBuilder sb = new StringBuilder(14);
    for (int i = 0; i < 4; i++) sb.append(letters.charAt(RNG.nextInt(letters.length())));
    sb.append('-');
    for (int i = 0; i < 4; i++) sb.append(digits.charAt(RNG.nextInt(digits.length())));
    sb.append('-');
    for (int i = 0; i < 4; i++) sb.append(letters.charAt(RNG.nextInt(letters.length())));
    return sb.toString();
  }

  public static String sha256(String plaintext) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] digest = md.digest(plaintext.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 unavailable", e);
    }
  }

  /**
   * Constant-time string comparison. Use for hash comparisons — equals() short-circuits on
   * first mismatch, which can leak timing.
   */
  public static boolean constantTimeEquals(String a, String b) {
    if (a == null || b == null || a.length() != b.length()) {
      return false;
    }
    int diff = 0;
    for (int i = 0; i < a.length(); i++) {
      diff |= a.charAt(i) ^ b.charAt(i);
    }
    return diff == 0;
  }
}
