package com.openiv.backend.server;

import com.openiv.backend.auth.crypto.TotpCipherConfig;
import com.openiv.backend.config.AppConfig;
import com.openiv.backend.db.DbConfig;
import com.openiv.backend.security.SecurityConfig;
import io.vertx.core.Vertx;
import io.vertx.ext.web.client.WebClient;
import io.vertx.junit5.VertxExtension;
import io.vertx.junit5.VertxTestContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure unit tests — no database, no auth. DB-backed endpoints are covered in
 * {@code *IT.java}
 * via Testcontainers.
 */
@ExtendWith(VertxExtension.class)
class MainVerticleTest {

  private static AppConfig testConfig() {
    SecurityConfig security = new SecurityConfig(
        List.of(), // corsAllowedOrigins
        List.of("GET", "POST"), // corsAllowedMethods
        List.of("content-type"), // corsAllowedHeaders
        false, // corsAllowCredentials
        65536L, // maxBodyBytes
        100_000, // rateLimitRequestsPerMinute (effectively off for tests)
        30_000L, // requestTimeoutMillis
        false, // hstsEnabled
        63_072_000L, // hstsMaxAgeSeconds
        "default-src 'none'", // csp
        false, // tlsRequired
        List.of(), // trustedProxies
        false // authRequired
    );
    DbConfig db = new DbConfig("localhost", 5432, "test", "test", "test",
        1, 1, false, "disable");
    return new AppConfig(
        "development",
        new AppConfig.HttpConfig(0, "127.0.0.1"),
        db,
        security,
        new TotpCipherConfig("", ""),
        new AppConfig.EmailConfig("localhost", null, false), null, null, null, null, null, null, null);
  }

  @Test
  void healthzReturnsAlive(Vertx vertx, VertxTestContext testContext) {
    MainVerticle verticle = new MainVerticle(testConfig(), null);
    vertx.deployVerticle(verticle)
        .onFailure(testContext::failNow)
        .onSuccess(id -> WebClient.create(vertx)
            .get(verticle.httpPort(), "127.0.0.1", "/healthz")
            .send()
            .onFailure(testContext::failNow)
            .onSuccess(resp -> testContext.verify(() -> {
              assertThat(resp.statusCode()).isEqualTo(200);
              assertThat(resp.bodyAsJsonObject().getString("status")).isEqualTo("alive");
              assertThat(resp.getHeader("X-Request-ID")).isNotBlank();
              assertThat(resp.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
              assertThat(resp.getHeader("X-Frame-Options")).isEqualTo("DENY");
              testContext.completeNow();
            })));
  }

  @Test
  void v1IndexReturnsServiceMetadata(Vertx vertx, VertxTestContext testContext) {
    MainVerticle verticle = new MainVerticle(testConfig(), null);
    vertx.deployVerticle(verticle)
        .onFailure(testContext::failNow)
        .onSuccess(id -> WebClient.create(vertx)
            .get(verticle.httpPort(), "127.0.0.1", "/api/v1/")
            .send()
            .onFailure(testContext::failNow)
            .onSuccess(resp -> testContext.verify(() -> {
              assertThat(resp.statusCode()).isEqualTo(200);
              assertThat(resp.bodyAsJsonObject().getString("name")).isEqualTo("openiv-backend");
              assertThat(resp.bodyAsJsonObject().getString("version")).isEqualTo("v1");
              testContext.completeNow();
            })));
  }

  @Test
  void v1TimeReturns503WithoutPool(Vertx vertx, VertxTestContext testContext) {
    MainVerticle verticle = new MainVerticle(testConfig(), null);
    vertx.deployVerticle(verticle)
        .onFailure(testContext::failNow)
        .onSuccess(id -> WebClient.create(vertx)
            .get(verticle.httpPort(), "127.0.0.1", "/api/v1/time")
            .send()
            .onFailure(testContext::failNow)
            .onSuccess(resp -> testContext.verify(() -> {
              assertThat(resp.statusCode()).isEqualTo(503);
              testContext.completeNow();
            })));
  }

  @Test
  void traceMethodIsRejected(Vertx vertx, VertxTestContext testContext) {
    MainVerticle verticle = new MainVerticle(testConfig(), null);
    vertx.deployVerticle(verticle)
        .onFailure(testContext::failNow)
        .onSuccess(id -> WebClient.create(vertx)
            .request(io.vertx.core.http.HttpMethod.TRACE, verticle.httpPort(), "127.0.0.1", "/healthz")
            .send()
            .onFailure(testContext::failNow)
            .onSuccess(resp -> testContext.verify(() -> {
              assertThat(resp.statusCode()).isEqualTo(405);
              testContext.completeNow();
            })));
  }
}
