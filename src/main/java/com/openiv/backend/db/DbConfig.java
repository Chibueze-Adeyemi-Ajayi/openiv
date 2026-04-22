package com.openiv.backend.db;

import io.vertx.core.json.JsonObject;

/**
 * Database configuration. The reactive Vert.x PgPool is the hot path; the JDBC URL is used
 * only at startup by Flyway for schema migrations.
 *
 * @param host              Postgres host.
 * @param port              Postgres port.
 * @param database          Database name.
 * @param user              Database user.
 * @param password          Database password.
 * @param reactivePoolSize  Max reactive connections <b>per verticle instance</b>. With N verticle
 *                          instances the effective pool size is {@code reactivePoolSize * N}.
 * @param pipeliningLimit   Max concurrent in-flight queries per connection (Postgres pipelining).
 *                          Values of 64-256 dramatically improve throughput under load.
 * @param migrate           Whether to run Flyway migrations at startup.
 * @param sslMode           Postgres SSL mode. One of {@code disable}, {@code require},
 *                          {@code verify-ca}, {@code verify-full}. Production should be
 *                          {@code verify-full}; local dev typically uses {@code disable}.
 */
public record DbConfig(
    String host,
    int port,
    String database,
    String user,
    String password,
    int reactivePoolSize,
    int pipeliningLimit,
    boolean migrate,
    String sslMode
) {

  public static DbConfig from(JsonObject json) {
    JsonObject db = json == null ? new JsonObject() : json;
    return new DbConfig(
        db.getString("host", "localhost"),
        db.getInteger("port", 5432),
        db.getString("database", "openiv"),
        db.getString("user", "openiv"),
        db.getString("password", "openiv"),
        db.getInteger("reactivePoolSize", 16),
        db.getInteger("pipeliningLimit", 256),
        db.getBoolean("migrate", true),
        db.getString("sslMode", "disable")
    );
  }

  public String jdbcUrl() {
    String base = "jdbc:postgresql://" + host + ":" + port + "/" + database;
    if (!"disable".equals(sslMode)) {
      return base + "?ssl=true&sslmode=" + sslMode;
    }
    return base;
  }
}
