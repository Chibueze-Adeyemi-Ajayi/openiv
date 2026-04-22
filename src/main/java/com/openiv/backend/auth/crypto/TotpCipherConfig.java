package com.openiv.backend.auth.crypto;

import io.vertx.core.json.JsonObject;

/**
 * RSA key material for {@link TotpCipher}. Read from {@code totp} section of application.json
 * or from {@code OPENIV_TOTP_PUBLIC_KEY} / {@code OPENIV_TOTP_PRIVATE_KEY} env vars.
 */
public record TotpCipherConfig(String publicKeyPem, String privateKeyPem) {

  public static TotpCipherConfig from(JsonObject json) {
    JsonObject t = json == null ? new JsonObject() : json;
    return new TotpCipherConfig(
        t.getString("publicKey", ""),
        t.getString("privateKey", "")
    );
  }

  public boolean isConfigured() {
    return publicKeyPem != null && !publicKeyPem.isBlank()
        && privateKeyPem != null && !privateKeyPem.isBlank();
  }
}
