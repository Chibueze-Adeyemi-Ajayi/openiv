package com.openiv.backend.server;

import com.openiv.backend.auth.crypto.TotpCipherConfig;
import com.openiv.backend.config.AppConfig;
import com.openiv.backend.db.DataSources;
import com.openiv.backend.db.DbConfig;
import com.openiv.backend.db.Migrations;
import com.openiv.backend.security.SecurityConfig;
import io.vertx.core.Vertx;
import io.vertx.ext.web.client.WebClient;
import io.vertx.junit5.VertxExtension;
import io.vertx.junit5.VertxTestContext;
import io.vertx.sqlclient.Pool;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end integration test. Spins up a real Postgres via Testcontainers, runs Flyway,
 * exercises the jOOQ → pg-client path through the HTTP server. Requires Docker.
 */
@Testcontainers
@ExtendWith(VertxExtension.class)
class MainVerticleIT {

  @Container
  @SuppressWarnings("resource")
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
      .withDatabaseName("openiv_it")
      .withUsername("openiv")
      .withPassword("openiv");

  @Test
  void timeEndpointRoundTripsThroughJooqAndPgClient(Vertx vertx, VertxTestContext testContext)
      throws InterruptedException {
    DbConfig db = new DbConfig(
        POSTGRES.getHost(),
        POSTGRES.getFirstMappedPort(),
        POSTGRES.getDatabaseName(),
        POSTGRES.getUsername(),
        POSTGRES.getPassword(),
        4, 64, true, "disable"
    );
    SecurityConfig security = new SecurityConfig(
        List.of(), List.of("GET"), List.of("content-type"),
        false, 65536L, 100_000, 30_000L,
        false, 63_072_000L, "default-src 'none'",
        false, List.of(), false
    );
    AppConfig cfg = new AppConfig(
        "development",
        new AppConfig.HttpConfig(0, "127.0.0.1"),
        db,
        security,
        new TotpCipherConfig("", ""),
        new AppConfig.EmailConfig("localhost", 25, null, null, "test@openiv.local", false));

    Migrations.run(vertx, db)
        .onFailure(testContext::failNow)
        .onSuccess(v -> {
          Pool pool = DataSources.reactivePool(vertx, db);
          MainVerticle verticle = new MainVerticle(cfg, pool);
          vertx.deployVerticle(verticle)
              .onFailure(testContext::failNow)
              .onSuccess(id -> WebClient.create(vertx)
                  .get(verticle.httpPort(), "127.0.0.1", "/api/v1/time")
                  .send()
                  .onFailure(testContext::failNow)
                  .onSuccess(resp -> testContext.verify(() -> {
                    assertThat(resp.statusCode()).isEqualTo(200);
                    assertThat(resp.bodyAsJsonObject().getString("now")).isNotBlank();
                    pool.close().onComplete(close -> testContext.completeNow());
                  })));
        });

    assertThat(testContext.awaitCompletion(60, TimeUnit.SECONDS)).isTrue();
    if (testContext.failed()) {
      throw new AssertionError(testContext.causeOfFailure());
    }
  }
}
