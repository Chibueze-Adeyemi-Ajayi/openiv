package com.openiv.backend.config;

import com.openiv.backend.auth.crypto.TotpCipherConfig;
import com.openiv.backend.db.DbConfig;
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
    TotpCipherConfig totp
) {

  public static AppConfig from(JsonObject json) {
    JsonObject httpJson = json.getJsonObject("http", new JsonObject());
    JsonObject dbJson = json.getJsonObject("db", new JsonObject());
    JsonObject securityJson = json.getJsonObject("security", new JsonObject());
    JsonObject totpJson = json.getJsonObject("totp", new JsonObject());
    String env = json.getString("environment", "production");
    return new AppConfig(
        env,
        new HttpConfig(
            httpJson.getInteger("port", 8080),
            httpJson.getString("host", "0.0.0.0")
        ),
        DbConfig.from(dbJson),
        SecurityConfig.from(securityJson),
        TotpCipherConfig.from(totpJson)
    );
  }

  public boolean isDevelopment() {
    return "development".equalsIgnoreCase(environment);
  }

  public record HttpConfig(int port, String host) {}
}
