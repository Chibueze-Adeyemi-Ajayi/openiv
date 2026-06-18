package com.openiv.backend.config;

import com.openiv.backend.auth.crypto.TotpCipherConfig;
import com.openiv.backend.db.DbConfig;
import com.openiv.backend.dojah.DojahConfig;
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
    DojahConfig doja,
    CloudinaryConfig cloudinary,
    BillingConfig billing,
    SuperAdminConfig superAdmin,
    AiConfig ai,
    WebAuthnConfig webAuthn,
    RedisConfig redis) {

  public record EmailConfig(String apiToken, String from, boolean enabled) {
  }

  public record CloudinaryConfig(String cloudName, String apiKey, String apiSecret) {
  }

  public record BillingConfig(String paystackSecretKey, String paystackPublicKey, String paystackWebhookSecret) {
  }

  public record SuperAdminConfig(String password) {
  }

  public record AiConfig(String groqApiKey, String freeModelApiKey, String model, String serpApiKey) {
    public boolean enabled()        { return activeKey() != null; }
    public boolean hasFreeModel()   { return freeModelApiKey != null && !freeModelApiKey.isBlank(); }
    /** Returns the active API key — FreeModel wins when set, Groq is fallback. */
    public String  activeKey()      { return hasFreeModel() ? freeModelApiKey : (groqApiKey != null && !groqApiKey.isBlank() ? groqApiKey : null); }
    /** Returns the base URL for the active provider. */
    public String  activeBaseUrl()  { return hasFreeModel() ? "https://api.freemodel.dev/v1" : "https://api.groq.com/openai/v1"; }
  }

  public record WebAuthnConfig(String rpId, String rpOrigin) {}

  /** Redis connection string — null means Redis is disabled (in-memory cache only). */
  public record RedisConfig(String url) {
    public boolean enabled() { return url != null && !url.isBlank(); }
  }

  public static AppConfig from(JsonObject json) {
    JsonObject httpJson = json.getJsonObject("http", new JsonObject());
    JsonObject dbJson = json.getJsonObject("db", new JsonObject());
    JsonObject securityJson = json.getJsonObject("security", new JsonObject());
    JsonObject totpJson = json.getJsonObject("totp", new JsonObject());
    JsonObject emailJson = json.getJsonObject("email", new JsonObject());
    boolean emailPresent = json.containsKey("email") && emailJson.getString("apiToken") != null;
    JsonObject dojaJson = json.getJsonObject("doja", new JsonObject());
    JsonObject cloudinaryJson = json.getJsonObject("cloudinary", new JsonObject());
    JsonObject billingJson = json.getJsonObject("billing", new JsonObject());
    String env = json.getString("environment", "production");

    // Env-var overrides take precedence over application.json values
    String dojaAppId = envOr("DOJA_APP_ID", dojaJson.getString("appId", ""));
    String dojaApiKey = envOr("DOJA_API_KEY", dojaJson.getString("apiKey", ""));
    String dojaUrl = envOr("DOJA_BASE_URL", dojaJson.getString("baseUrl", DojahConfig.SANDBOX_BASE_URL));

    String cloudName = envOr("CLOUDINARY_CLOUD_NAME", cloudinaryJson.getString("cloudName", ""));
    String cloudApiKey = envOr("CLOUDINARY_API_KEY", cloudinaryJson.getString("apiKey", ""));
    String cloudSecret = envOr("CLOUDINARY_API_SECRET", cloudinaryJson.getString("apiSecret", ""));

    String paystackSecret = envOr("PAYSTACK_SECRET_KEY", billingJson.getString("paystackSecretKey", ""));
    String paystackPublic = envOr("PAYSTACK_PUBLIC_KEY", billingJson.getString("paystackPublicKey", ""));
    String paystackWebhook = envOr("PAYSTACK_WEBHOOK_SECRET", billingJson.getString("paystackWebhookSecret", ""));

    JsonObject superAdminJson = json.getJsonObject("superadmin", new JsonObject());
    String superAdminPassword = envOr("SUPER_ADMIN_PASSWORD", superAdminJson.getString("password", ""));

    JsonObject aiJson      = json.getJsonObject("ai", new JsonObject());
    String anthropicKey    = envOr("GROQ_API_KEY",       aiJson.getString("groqApiKey",      ""));
    String freeModelKey    = envOr("FREE_MODEL_API_KEY", aiJson.getString("freeModelApiKey", ""));
    String anthropicModel  = envOr("AI_MODEL",           aiJson.getString("model",           "gpt-5.5"));
    String serpApiKey      = envOr("SERP_API_KEY",       aiJson.getString("serpApiKey",      ""));

    String webAuthnRpId     = envOr("WEBAUTHN_RP_ID",     "localhost");
    String webAuthnRpOrigin = envOr("WEBAUTHN_ORIGIN",    "http://localhost:5173");

    JsonObject redisJson = json.getJsonObject("redis", new JsonObject());
    String redisUrl = envOr("REDIS_URL", redisJson.getString("url", ""));

    return new AppConfig(
        env,
        new HttpConfig(
            httpJson.getInteger("port", 8080),
            httpJson.getString("host", "0.0.0.0")),
        DbConfig.from(dbJson),
        SecurityConfig.from(securityJson),
        TotpCipherConfig.from(totpJson),
        new EmailConfig(
            envOr("MAILTRAP_API_TOKEN", emailJson.getString("apiToken", "")),
            emailJson.getString("from", "noreply@openiv.ng"),
            emailJson.getBoolean("enabled", emailPresent)),
        new DojahConfig(dojaUrl, dojaAppId, dojaApiKey, dojaJson.getBoolean("enabled", true)),
        new CloudinaryConfig(cloudName, cloudApiKey, cloudSecret),
        new BillingConfig(paystackSecret, paystackPublic, paystackWebhook),
        new SuperAdminConfig(superAdminPassword),
        new AiConfig(anthropicKey, freeModelKey, anthropicModel, serpApiKey),
        new WebAuthnConfig(webAuthnRpId, webAuthnRpOrigin),
        new RedisConfig(redisUrl.isBlank() ? null : redisUrl));
  }

  private static String envOr(String envVar, String fallback) {
    String v = System.getenv(envVar);
    return (v != null && !v.isBlank()) ? v : (fallback != null ? fallback : "");
  }

  public boolean isDevelopment() {
    return "development".equalsIgnoreCase(environment);
  }

  public record HttpConfig(int port, String host) {
  }
}
