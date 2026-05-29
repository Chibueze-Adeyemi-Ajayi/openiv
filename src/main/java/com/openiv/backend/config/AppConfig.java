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
    DojaConfig doja,
    CloudinaryConfig cloudinary,
    BillingConfig billing
) {

  public record EmailConfig(String apiToken, String from, boolean enabled) {}

  public record CloudinaryConfig(String cloudName, String apiKey, String apiSecret) {}

  public record BillingConfig(String paystackSecretKey, String paystackPublicKey, String paystackWebhookSecret) {}

  public static AppConfig from(JsonObject json) {
    JsonObject httpJson = json.getJsonObject("http", new JsonObject());
    JsonObject dbJson = json.getJsonObject("db", new JsonObject());
    JsonObject securityJson = json.getJsonObject("security", new JsonObject());
    JsonObject totpJson = json.getJsonObject("totp", new JsonObject());
    JsonObject emailJson = json.getJsonObject("email", new JsonObject());
    boolean emailPresent = json.containsKey("email") && emailJson.getString("apiToken") != null;
    JsonObject dojaJson       = json.getJsonObject("doja",       new JsonObject());
    JsonObject cloudinaryJson = json.getJsonObject("cloudinary", new JsonObject());
    JsonObject billingJson    = json.getJsonObject("billing",    new JsonObject());
    String env = json.getString("environment", "production");

    // Env-var overrides take precedence over application.json values
    String dojaAppId  = envOr("DOJA_APP_ID",  dojaJson.getString("appId",  ""));
    String dojaApiKey = envOr("DOJA_API_KEY", dojaJson.getString("apiKey", ""));
    String dojaUrl    = envOr("DOJA_BASE_URL", dojaJson.getString("baseUrl", DojaConfig.SANDBOX_BASE_URL));

    String cloudName   = envOr("CLOUDINARY_CLOUD_NAME",  cloudinaryJson.getString("cloudName",  ""));
    String cloudApiKey = envOr("CLOUDINARY_API_KEY",      cloudinaryJson.getString("apiKey",     ""));
    String cloudSecret = envOr("CLOUDINARY_API_SECRET",   cloudinaryJson.getString("apiSecret",  ""));

    String paystackSecret  = envOr("PAYSTACK_SECRET_KEY",     billingJson.getString("paystackSecretKey",  ""));
    String paystackPublic  = envOr("PAYSTACK_PUBLIC_KEY",     billingJson.getString("paystackPublicKey",  ""));
    String paystackWebhook = envOr("PAYSTACK_WEBHOOK_SECRET", billingJson.getString("paystackWebhookSecret", ""));

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
            envOr("MAILTRAP_API_TOKEN", emailJson.getString("apiToken", "")),
            emailJson.getString("from", "noreply@openiv.ng"),
            emailJson.getBoolean("enabled", emailPresent)
        ),
        new DojaConfig(dojaUrl, dojaAppId, dojaApiKey, dojaJson.getBoolean("enabled", true)),
        new CloudinaryConfig(cloudName, cloudApiKey, cloudSecret),
        new BillingConfig(paystackSecret, paystackPublic, paystackWebhook)
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
