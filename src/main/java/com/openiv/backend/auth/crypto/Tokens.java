package com.openiv.backend.auth.crypto;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * Opaque session tokens. 256 bits of entropy, URL-safe base64, stored hashed server-side.
 *
 * <p>Opaque (not JWT) because banking sessions need atomic revocation: a stolen token must die
 * the instant we blacklist it. With JWT you're stuck until expiry or maintaining a revocation
 * list that defeats the stateless property anyway.
 */
public final class Tokens {

  private static final SecureRandom RNG = new SecureRandom();
  private static final int BYTES = 32;

  private Tokens() {}

  /** Generate a fresh session token. Return this to the client exactly once; never log it. */
  public static String generate() {
    byte[] buf = new byte[BYTES];
    RNG.nextBytes(buf);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
  }

  /** Hash for storage. Server-side lookups always hash-then-compare. */
  public static String hash(String token) {
    return Codes.sha256(token);
  }
}
