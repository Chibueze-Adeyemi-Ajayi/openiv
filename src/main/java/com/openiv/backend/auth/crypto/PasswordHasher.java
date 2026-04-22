package com.openiv.backend.auth.crypto;

import com.password4j.Argon2Function;
import com.password4j.Password;
import com.password4j.types.Argon2;

/**
 * Argon2id password hashing. Parameters follow OWASP 2023 guidance for interactive login
 * (memory 19 MiB, 2 iterations, 1 parallelism, 32-byte output). Tune via load testing against
 * the target hardware — the goal is ~300-500ms per hash on production login nodes.
 *
 * <p>The resulting hash string embeds the algorithm, salt, and parameters so we can re-verify
 * without storing them separately; and it lets us rotate parameters later without invalidating
 * existing users' passwords.
 */
public final class PasswordHasher {

  private static final int MEMORY_KIB = 19 * 1024;
  private static final int ITERATIONS = 2;
  private static final int PARALLELISM = 1;
  private static final int HASH_LENGTH = 32;

  private static final Argon2Function ARGON2 = Argon2Function.getInstance(
      MEMORY_KIB, ITERATIONS, PARALLELISM, HASH_LENGTH, Argon2.ID);

  private PasswordHasher() {}

  public static String hash(String plaintext) {
    if (plaintext == null || plaintext.isEmpty()) {
      throw new IllegalArgumentException("password must not be empty");
    }
    return Password.hash(plaintext).addRandomSalt(16).with(ARGON2).getResult();
  }

  public static boolean verify(String plaintext, String storedHash) {
    if (plaintext == null || storedHash == null) {
      return false;
    }
    return Password.check(plaintext, storedHash).with(ARGON2);
  }
}
