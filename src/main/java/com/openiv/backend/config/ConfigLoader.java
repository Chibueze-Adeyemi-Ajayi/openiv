package com.openiv.backend.config;

import io.vertx.config.ConfigRetriever;
import io.vertx.config.ConfigRetrieverOptions;
import io.vertx.config.ConfigStoreOptions;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Loads configuration from (in precedence order, highest last):
 * <ol>
 *   <li>Classpath defaults: {@code application.json} bundled with the app.</li>
 *   <li>Filesystem override: {@code ./config/application.json} (optional, for operators).</li>
 *   <li>Selected environment variables (optional, highest precedence).</li>
 * </ol>
 */
public final class ConfigLoader {

  private static final String CLASSPATH_DEFAULTS = "/application.json";

  private static final String[] ENV_KEYS = {
      "OPENIV_ENV",
      "OPENIV_HTTP_PORT",
      "OPENIV_HTTP_HOST",
      "OPENIV_DB_HOST",
      "OPENIV_DB_PORT",
      "OPENIV_DB_NAME",
      "OPENIV_DB_USER",
      "OPENIV_DB_PASSWORD",
      "OPENIV_DB_POOL_SIZE",
      "OPENIV_DB_PIPELINING_LIMIT",
      "OPENIV_DB_MIGRATE",
      "OPENIV_DB_SSL_MODE",
      "OPENIV_SECURITY_CORS_ORIGINS",
      "OPENIV_SECURITY_MAX_BODY_BYTES",
      "OPENIV_SECURITY_RATE_LIMIT_PER_MINUTE",
      "OPENIV_SECURITY_REQUEST_TIMEOUT_MS",
      "OPENIV_SECURITY_HSTS_ENABLED",
      "OPENIV_SECURITY_TLS_REQUIRED",
      "OPENIV_SECURITY_AUTH_REQUIRED",
      "OPENIV_SECURITY_TRUSTED_PROXIES",
      "OPENIV_TOTP_PUBLIC_KEY",
      "OPENIV_TOTP_PRIVATE_KEY",
  };

  private ConfigLoader() {}

  public static Future<AppConfig> load(Vertx vertx) {
    JsonObject defaults = readClasspathJson(CLASSPATH_DEFAULTS);

    ConfigStoreOptions defaultsStore = new ConfigStoreOptions()
        .setType("json")
        .setConfig(defaults);

    ConfigStoreOptions overridesStore = new ConfigStoreOptions()
        .setType("file")
        .setFormat("json")
        .setConfig(new JsonObject().put("path", "config/application.json"))
        .setOptional(true);

    JsonArray envKeys = new JsonArray();
    for (String key : ENV_KEYS) {
      envKeys.add(key);
    }
    ConfigStoreOptions envStore = new ConfigStoreOptions()
        .setType("env")
        .setConfig(new JsonObject().put("keys", envKeys));

    ConfigRetrieverOptions opts = new ConfigRetrieverOptions()
        .addStore(defaultsStore)
        .addStore(overridesStore)
        .addStore(envStore);

    return ConfigRetriever.create(vertx, opts)
        .getConfig()
        .map(ConfigLoader::applyEnvOverrides)
        .map(AppConfig::from);
  }

  private static JsonObject applyEnvOverrides(JsonObject merged) {
    if (merged.containsKey("OPENIV_ENV")) {
      merged.put("environment", merged.getString("OPENIV_ENV"));
    }
    JsonObject http = merged.getJsonObject("http", new JsonObject());
    moveIntKey(merged, "OPENIV_HTTP_PORT", http, "port");
    moveStringKey(merged, "OPENIV_HTTP_HOST", http, "host");
    merged.put("http", http);

    JsonObject db = merged.getJsonObject("db", new JsonObject());
    moveStringKey(merged, "OPENIV_DB_HOST", db, "host");
    moveIntKey(merged, "OPENIV_DB_PORT", db, "port");
    moveStringKey(merged, "OPENIV_DB_NAME", db, "database");
    moveStringKey(merged, "OPENIV_DB_USER", db, "user");
    moveStringKey(merged, "OPENIV_DB_PASSWORD", db, "password");
    moveIntKey(merged, "OPENIV_DB_POOL_SIZE", db, "reactivePoolSize");
    moveIntKey(merged, "OPENIV_DB_PIPELINING_LIMIT", db, "pipeliningLimit");
    moveBoolKey(merged, "OPENIV_DB_MIGRATE", db, "migrate");
    moveStringKey(merged, "OPENIV_DB_SSL_MODE", db, "sslMode");
    merged.put("db", db);

    JsonObject security = merged.getJsonObject("security", new JsonObject());
    moveCsvKey(merged, "OPENIV_SECURITY_CORS_ORIGINS", security, "corsAllowedOrigins");
    moveCsvKey(merged, "OPENIV_SECURITY_TRUSTED_PROXIES", security, "trustedProxies");
    moveLongKey(merged, "OPENIV_SECURITY_MAX_BODY_BYTES", security, "maxBodyBytes");
    moveIntKey(merged, "OPENIV_SECURITY_RATE_LIMIT_PER_MINUTE", security, "rateLimitRequestsPerMinute");
    moveLongKey(merged, "OPENIV_SECURITY_REQUEST_TIMEOUT_MS", security, "requestTimeoutMillis");
    moveBoolKey(merged, "OPENIV_SECURITY_HSTS_ENABLED", security, "hstsEnabled");
    moveBoolKey(merged, "OPENIV_SECURITY_TLS_REQUIRED", security, "tlsRequired");
    moveBoolKey(merged, "OPENIV_SECURITY_AUTH_REQUIRED", security, "authRequired");
    merged.put("security", security);

    JsonObject totp = merged.getJsonObject("totp", new JsonObject());
    moveStringKey(merged, "OPENIV_TOTP_PUBLIC_KEY", totp, "publicKey");
    moveStringKey(merged, "OPENIV_TOTP_PRIVATE_KEY", totp, "privateKey");
    merged.put("totp", totp);

    return merged;
  }

  private static void moveLongKey(JsonObject src, String srcKey, JsonObject dst, String dstKey) {
    if (src.containsKey(srcKey)) {
      dst.put(dstKey, Long.parseLong(src.getString(srcKey)));
    }
  }

  private static void moveCsvKey(JsonObject src, String srcKey, JsonObject dst, String dstKey) {
    if (!src.containsKey(srcKey)) {
      return;
    }
    String raw = src.getString(srcKey);
    if (raw == null || raw.isBlank()) {
      return;
    }
    JsonArray arr = new JsonArray();
    for (String item : raw.split(",")) {
      String trimmed = item.trim();
      if (!trimmed.isEmpty()) {
        arr.add(trimmed);
      }
    }
    dst.put(dstKey, arr);
  }

  private static void moveStringKey(JsonObject src, String srcKey, JsonObject dst, String dstKey) {
    if (src.containsKey(srcKey)) {
      dst.put(dstKey, src.getString(srcKey));
    }
  }

  private static void moveIntKey(JsonObject src, String srcKey, JsonObject dst, String dstKey) {
    if (src.containsKey(srcKey)) {
      dst.put(dstKey, Integer.parseInt(src.getString(srcKey)));
    }
  }

  private static void moveBoolKey(JsonObject src, String srcKey, JsonObject dst, String dstKey) {
    if (src.containsKey(srcKey)) {
      dst.put(dstKey, Boolean.parseBoolean(src.getString(srcKey)));
    }
  }

  private static JsonObject readClasspathJson(String resourcePath) {
    try (InputStream in = ConfigLoader.class.getResourceAsStream(resourcePath)) {
      if (in == null) {
        return new JsonObject();
      }
      String text = new String(in.readAllBytes(), StandardCharsets.UTF_8);
      return new JsonObject(text);
    } catch (IOException e) {
      throw new IllegalStateException("Failed to read classpath config " + resourcePath, e);
    }
  }
}
