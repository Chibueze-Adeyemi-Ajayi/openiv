package com.openiv.backend.auth.crypto;

import javax.crypto.Cipher;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * Encrypts TOTP secrets at rest using RSA-OAEP (SHA-256).
 *
 * <p>A 2048-bit RSA key can safely encrypt up to ~190 bytes with OAEP-SHA256; TOTP secrets are
 * 20 bytes, so direct RSA encryption is fine — no hybrid envelope scheme needed at this size.
 *
 * <p>On ciphertext format we prefix {@code v1:} so a future migration to a different algorithm
 * (e.g. hybrid AES-GCM + RSA-wrap, or a KMS-managed key) can coexist with legacy rows. When
 * we see a prefix we don't recognize, we fail loudly rather than silently misinterpret.
 *
 * <p><b>Key material.</b> Both keys come from {@link TotpCipherConfig}, sourced from
 * {@code application.json} or env vars. Production keys should come from a KMS/HSM —
 * see {@code env OPENIV_TOTP_PRIVATE_KEY} pattern.
 */
public final class TotpCipher {

  private static final String TRANSFORM = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding";
  private static final String PREFIX_V1 = "v1:";

  private final PublicKey publicKey;
  private final PrivateKey privateKey;

  public TotpCipher(PublicKey publicKey, PrivateKey privateKey) {
    this.publicKey = publicKey;
    this.privateKey = privateKey;
  }

  /** Build from PEM strings (may include surrounding whitespace / markers). */
  public static TotpCipher fromPem(String publicKeyPem, String privateKeyPem) {
    if (isBlank(publicKeyPem) || isBlank(privateKeyPem)) {
      throw new IllegalStateException(
          "TOTP cipher keys not configured. Set totp.publicKey / totp.privateKey in application.json "
          + "or OPENIV_TOTP_PUBLIC_KEY / OPENIV_TOTP_PRIVATE_KEY env vars.");
    }
    return new TotpCipher(parsePublicKey(publicKeyPem), parsePrivateKey(privateKeyPem));
  }

  public String encrypt(String plaintext) {
    try {
      Cipher cipher = Cipher.getInstance(TRANSFORM);
      cipher.init(Cipher.ENCRYPT_MODE, publicKey);
      byte[] ct = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
      return PREFIX_V1 + Base64.getEncoder().encodeToString(ct);
    } catch (Exception e) {
      throw new IllegalStateException("TOTP encryption failed", e);
    }
  }

  public String decrypt(String ciphertext) {
    if (ciphertext == null || !ciphertext.startsWith(PREFIX_V1)) {
      throw new IllegalStateException(
          "TOTP ciphertext missing v1 prefix — refusing to interpret unknown format");
    }
    try {
      byte[] raw = Base64.getDecoder().decode(ciphertext.substring(PREFIX_V1.length()));
      Cipher cipher = Cipher.getInstance(TRANSFORM);
      cipher.init(Cipher.DECRYPT_MODE, privateKey);
      return new String(cipher.doFinal(raw), StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new IllegalStateException("TOTP decryption failed", e);
    }
  }

  private static PublicKey parsePublicKey(String pem) {
    byte[] der = pemToDer(pem, "PUBLIC KEY");
    try {
      return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
    } catch (Exception e) {
      throw new IllegalStateException("Failed to parse RSA public key", e);
    }
  }

  private static PrivateKey parsePrivateKey(String pem) {
    byte[] der = pemToDer(pem, "PRIVATE KEY");
    try {
      return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
    } catch (Exception e) {
      throw new IllegalStateException("Failed to parse RSA private key (expected PKCS#8)", e);
    }
  }

  private static byte[] pemToDer(String pem, String kind) {
    String stripped = pem
        .replace("-----BEGIN " + kind + "-----", "")
        .replace("-----END " + kind + "-----", "")
        .replaceAll("\\s+", "");
    return Base64.getDecoder().decode(stripped);
  }

  private static boolean isBlank(String s) {
    return s == null || s.isBlank();
  }
}
