package com.openiv.backend.auth.crypto;

import dev.samstevens.totp.code.CodeVerifier;
import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.code.DefaultCodeVerifier;
import dev.samstevens.totp.code.HashingAlgorithm;
import dev.samstevens.totp.secret.DefaultSecretGenerator;
import dev.samstevens.totp.secret.SecretGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;
import dev.samstevens.totp.time.TimeProvider;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * RFC 6238 TOTP (authenticator apps: Google Authenticator, Authy, 1Password, etc.).
 *
 * <p>SHA-1, 6 digits, 30 second window — the universally compatible defaults. Accepts ±1 step
 * of skew so a code typed at the window boundary still works.
 *
 * <p>The secret returned here is base32, 160 bits. Store encrypted-at-rest (see
 * db/migration/V2 note on totp_secrets.secret).
 */
public final class Totp {

  private static final String ISSUER = "OpenIV";
  private static final int SECRET_BITS = 160;
  private static final int TIME_STEP_SECONDS = 30;
  private static final int ACCEPTED_WINDOW = 1;

  private static final SecretGenerator SECRET_GEN = new DefaultSecretGenerator(SECRET_BITS / 8);
  private static final TimeProvider CLOCK = new SystemTimeProvider();
  private static final CodeVerifier VERIFIER = buildVerifier();

  private Totp() {}

  public static String generateSecret() {
    return SECRET_GEN.generate();
  }

  /** {@code otpauth://} URI for authenticator apps. Clients render the QR code from this. */
  public static String otpauthUri(String secret, String accountLabel) {
    String label = URLEncoder.encode(ISSUER + ":" + accountLabel, StandardCharsets.UTF_8);
    String issuer = URLEncoder.encode(ISSUER, StandardCharsets.UTF_8);
    return "otpauth://totp/" + label
        + "?secret=" + secret
        + "&issuer=" + issuer
        + "&algorithm=SHA1"
        + "&digits=6"
        + "&period=" + TIME_STEP_SECONDS;
  }

  public static boolean verify(String secret, String code) {
    if (secret == null || code == null) {
      return false;
    }
    return VERIFIER.isValidCode(secret, code);
  }

  private static CodeVerifier buildVerifier() {
    DefaultCodeVerifier v = new DefaultCodeVerifier(new DefaultCodeGenerator(HashingAlgorithm.SHA1), CLOCK);
    v.setTimePeriod(TIME_STEP_SECONDS);
    v.setAllowedTimePeriodDiscrepancy(ACCEPTED_WINDOW);
    return v;
  }
}
