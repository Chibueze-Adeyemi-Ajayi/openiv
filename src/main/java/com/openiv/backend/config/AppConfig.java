package com.openiv.backend.config;

import com.openiv.backend.auth.crypto.TotpCipherConfig;
import com.openiv.backend.db.DbConfig;
import com.openiv.backend.doja.DojaConfig;
import com.openiv.backend.security.SecurityConfig;
import io.vertx.core.json.JsonObject;

/**
 * Immutable, typed view of application configuration loaded at startup.
 */
public record AppConfig(
    String environment,
    HttpConfig http,
    DbConfig db,
    SecurityConfig security,
    TotpCipherConfig totp,
    EmailConfig email,
    DojaConfig doja
) {

  public record EmailConfig(String host, int port, String user, String password, String from, boolean useSsl, boolean enabled) {}

  public static AppConfig from(JsonObject json) {
    JsonObject httpJson = json.getJsonObject("http", new JsonObject());
    JsonObject dbJson = json.getJsonObject("db", new JsonObject());
    JsonObject securityJson = json.getJsonObject("security", new JsonObject());
    JsonObject totpJson = json.getJsonObject("totp", new JsonObject());
    boolean emailPresent = json.containsKey("email");
    JsonObject emailJson = json.getJsonObject("email", new JsonObject());
    JsonObject dojaJson  = json.getJsonObject("doja",  new JsonObject());
    String env = json.getString("environment", "production");

    // Env-var overrides take precedence over application.json values
    String dojaAppId  = envOr("DOJA_APP_ID",  dojaJson.getString("appId",  ""));
    String dojaApiKey = envOr("DOJA_API_KEY", dojaJson.getString("apiKey", ""));
    String dojaUrl    = envOr("DOJA_BASE_URL", dojaJson.getString("baseUrl", DojaConfig.SANDBOX_BASE_URL));

    return new AppConfig(
        env,
        new HttpConfig(
            httpJson.getInteger("port", 8080),
            httpJson.getString("host", "0.0.0.0")
        ),
        DbConfig.from(dbJson),
        SecurityConfig.from(securityJson),
        TotpCipherConfig.from(totpJson),
        new EmailConfig(
            emailJson.getString("host", "localhost"),
            emailJson.getInteger("port", 25),
            emailJson.getString("user"),
            emailJson.getString("password"),
            emailJson.getString("from", "noreply@openiv.com"),
            emailJson.getBoolean("useSsl", false),
            emailJson.getBoolean("enabled", emailPresent)
        ),
        new DojaConfig(dojaUrl, dojaAppId, dojaApiKey, dojaJson.getBoolean("enabled", true))
    );
  }

  private static String envOr(String envVar, String fallback) {
    String v = System.getenv(envVar);
    return (v != null && !v.isBlank()) ? v : (fallback != null ? fallback : "");
  }

  public boolean isDevelopment() {
    return "development".equalsIgnoreCase(environment);
  }

  public record HttpConfig(int port, String host) {}
}
