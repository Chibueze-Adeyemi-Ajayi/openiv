package com.openiv.backend.db;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import io.vertx.core.Vertx;
import io.vertx.pgclient.PgBuilder;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.pgclient.SslMode;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.PoolOptions;

import javax.sql.DataSource;

/**
 * Factories for the two connectivity paths:
 * <ul>
 *   <li>{@link #reactivePool(Vertx, DbConfig)} — the hot path. Reactive PgPool with pipelining.</li>
 *   <li>{@link #jdbcDataSource(DbConfig)} — JDBC, used exclusively by Flyway at startup.</li>
 * </ul>
 */
public final class DataSources {

  private DataSources() {}

  /**
   * Reactive Postgres pool. Pipelining is critical for throughput: it allows multiple in-flight
   * queries per connection, often multiplying Postgres RPS by 4-10x under load.
   */
  public static Pool reactivePool(Vertx vertx, DbConfig db) {
    PgConnectOptions connect = new PgConnectOptions()
        .setHost(db.host())
        .setPort(db.port())
        .setDatabase(db.database())
        .setUser(db.user())
        .setPassword(db.password())
        .setCachePreparedStatements(true)
        .setPreparedStatementCacheMaxSize(1024)
        .setPipeliningLimit(db.pipeliningLimit())
        .setReconnectAttempts(5)
        .setReconnectInterval(500)
        .setTcpKeepAlive(true)
        .setTcpNoDelay(true)
        .setSslMode(toSslMode(db.sslMode()));

    // setSslMode() alone tells the *protocol* to request SSL but does not wire up the
    // Netty TLS context. Without trustAll (or explicit certs), Vert.x pgclient cannot
    // complete the TLS handshake and falls back to plain-text — which Render/RDS reject
    // with "FATAL: SSL/TLS required". trustAll is acceptable here: sslMode=require
    // already enforces encryption; we only skip server-cert *authenticity* verification,
    // which is the standard posture for managed Postgres providers (Render, Supabase, etc.).
    if (!"disable".equalsIgnoreCase(db.sslMode())) {
      connect.setTrustAll(true);
    }

    PoolOptions poolOptions = new PoolOptions()
        .setMaxSize(db.reactivePoolSize())
        .setShared(true)
        .setName("openiv-pg-pool");

    return PgBuilder.pool()
        .with(poolOptions)
        .connectingTo(connect)
        .using(vertx)
        .build();
  }

  private static SslMode toSslMode(String mode) {
    return switch (mode == null ? "disable" : mode.toLowerCase()) {
      case "disable" -> SslMode.DISABLE;
      case "allow" -> SslMode.ALLOW;
      case "prefer" -> SslMode.PREFER;
      case "require" -> SslMode.REQUIRE;
      case "verify-ca" -> SslMode.VERIFY_CA;
      case "verify-full" -> SslMode.VERIFY_FULL;
      default -> throw new IllegalArgumentException("Unknown db.sslMode: " + mode);
    };
  }

  /**
   * JDBC DataSource for Flyway. Intentionally tiny — migrations run once at startup and this
   * pool is closed immediately after.
   */
  public static DataSource jdbcDataSource(DbConfig db) {
    HikariConfig cfg = new HikariConfig();
    cfg.setJdbcUrl(db.jdbcUrl());
    cfg.setUsername(db.user());
    cfg.setPassword(db.password());
    cfg.setMaximumPoolSize(2);
    cfg.setMinimumIdle(0);
    cfg.setPoolName("openiv-flyway");
    cfg.setConnectionTimeout(10_000);
    return new HikariDataSource(cfg);
  }
}
