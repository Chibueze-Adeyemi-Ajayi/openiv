package com.openiv.backend.dojah;

/**
 * Doja.io sandbox / live configuration.
 *
 * Read from application.json "doja" block, with env-var overrides:
 * DOJA_APP_ID → appId
 * DOJA_API_KEY → apiKey
 * DOJA_BASE_URL → baseUrl (optional; defaults to sandbox URL)
 */
public record DojahConfig(
    String baseUrl,
    String appId,
    String apiKey,
    boolean enabled) {
  public static final String SANDBOX_BASE_URL = "https://sandbox.doja.io";

  public boolean isConfigured() {
    return enabled
        && appId != null && !appId.isBlank()
        && apiKey != null && !apiKey.isBlank();
  }
}
