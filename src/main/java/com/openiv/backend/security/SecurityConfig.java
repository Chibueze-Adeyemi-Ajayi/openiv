package com.openiv.backend.security;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.util.List;

/**
 * Typed security configuration. All values are overridable via {@code application.json}
 * and the {@code OPENIV_SECURITY_*} env vars.
 *
 * <p>Defaults aim at a strict-by-default posture; operators widen as their environment
 * requires rather than relaxing globally.
 */
public record SecurityConfig(
    List<String> corsAllowedOrigins,
    List<String> corsAllowedMethods,
    List<String> corsAllowedHeaders,
    boolean corsAllowCredentials,
    long maxBodyBytes,
    int rateLimitRequestsPerMinute,
    long requestTimeoutMillis,
    boolean hstsEnabled,
    long hstsMaxAgeSeconds,
    String contentSecurityPolicy,
    boolean tlsRequired,
    List<String> trustedProxies,
    boolean authRequired
) {

  public static SecurityConfig from(JsonObject json) {
    JsonObject s = json == null ? new JsonObject() : json;
    return new SecurityConfig(
        stringList(s.getJsonArray("corsAllowedOrigins", new JsonArray())),
        stringList(s.getJsonArray("corsAllowedMethods",
            new JsonArray().add("GET").add("POST").add("PUT").add("PATCH").add("DELETE"))),
        stringList(s.getJsonArray("corsAllowedHeaders",
            new JsonArray().add("authorization").add("content-type").add("x-request-id"))),
        s.getBoolean("corsAllowCredentials", false),
        s.getLong("maxBodyBytes", 64L * 1024L),
        s.getInteger("rateLimitRequestsPerMinute", 600),
        s.getLong("requestTimeoutMillis", 30_000L),
        s.getBoolean("hstsEnabled", true),
        s.getLong("hstsMaxAgeSeconds", 63_072_000L),
        s.getString("contentSecurityPolicy",
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"),
        s.getBoolean("tlsRequired", false),
        stringList(s.getJsonArray("trustedProxies", new JsonArray())),
        s.getBoolean("authRequired", true)
    );
  }

  private static List<String> stringList(JsonArray arr) {
    return arr.stream().map(Object::toString).toList();
  }
}
