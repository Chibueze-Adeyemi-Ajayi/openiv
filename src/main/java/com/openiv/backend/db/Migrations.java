package com.openiv.backend.db;

import com.zaxxer.hikari.HikariDataSource;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;

/**
 * Runs Flyway migrations once at startup on a worker thread. Flyway is JDBC-based and blocking;
 * it must never execute on a Vert.x event loop.
 */
public final class Migrations {

  private static final Logger log = LoggerFactory.getLogger(Migrations.class);

  private Migrations() {}

  public static Future<Void> run(Vertx vertx, DbConfig db) {
    return vertx.executeBlocking(() -> {
      DataSource ds = DataSources.jdbcDataSource(db);
      try {
        Flyway flyway = Flyway.configure()
            .dataSource(ds)
            .locations("classpath:db/migration")
            .baselineOnMigrate(true)
            .validateOnMigrate(true)
            .load();

        MigrateResult result = flyway.migrate();
        log.info("Flyway applied {} migration(s), schema now at version {}",
            result.migrationsExecuted, result.targetSchemaVersion);
        return null;
      } finally {
        if (ds instanceof HikariDataSource hds) {
          hds.close();
        }
      }
    }, false);
  }
}
