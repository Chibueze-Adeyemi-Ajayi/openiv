package com.openiv.backend.db;

import com.zaxxer.hikari.HikariDataSource;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Runs Flyway migrations once at startup on a worker thread. Flyway is
 * JDBC-based and blocking; it must never execute on a Vert.x event loop.
 */
public final class Migrations {

  private static final Logger log = LoggerFactory.getLogger(Migrations.class);

  // Must match the highest V-number in db/migration/
  private static final int LATEST_VERSION = 108;

  // Schema artifacts that must all exist before we'll trust the DB enough to
  // baseline at LATEST_VERSION. Each entry was added by an early migration that
  // has never been removed since — their presence proves V2 → V106 actually ran
  // against this DB (vs. someone restoring just a partial dump).
  private static final String[] PROOF_TABLES = {
      "users",                 // V2  — auth bootstrap
      "subscription_plans",    // V102 — billing core
      "subscription_invoices", // V106 — payments
  };

  private Migrations() {}

  public static Future<Void> run(Vertx vertx, DbConfig db) {
    return vertx.executeBlocking(() -> {
      DataSource ds = DataSources.jdbcDataSource(db);
      try {
        // Repair stale history before Flyway touches it (handles DB restores
        // where the schema exists but flyway_schema_history was wiped/reset).
        repairStaleHistory(ds);

        Flyway flyway = Flyway.configure()
            .dataSource(ds)
            .locations("classpath:db/migration")
            .baselineOnMigrate(true)   // handles brand-new empty DBs
            .validateOnMigrate(true)
            .load();

        flyway.repair();
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

  /**
   * If the DB schema is ahead of Flyway's history (e.g. after a history table
   * reset or a DB restore from a dump), replace the history with a single
   * BASELINE entry at LATEST_VERSION so Flyway won't re-run already-applied
   * migrations on the next deploy.
   *
   * <p>Conditions checked before acting:
   * <ol>
   *   <li>flyway_schema_history exists</li>
   *   <li>max applied version in that history is below LATEST_VERSION</li>
   *   <li>EVERY table in {@link #PROOF_TABLES} exists — proof that the migrations
   *       up to LATEST_VERSION genuinely ran (vs. someone restoring a partial dump
   *       that has {@code users} but is missing {@code subscription_plans}, which
   *       previously caused V108 to fail mid-deploy).</li>
   * </ol>
   */
  private static void repairStaleHistory(DataSource ds) throws SQLException {
    try (Connection conn = ds.getConnection()) {

      // 1. Does flyway_schema_history exist at all?
      boolean historyExists;
      try (ResultSet rs = conn.getMetaData().getTables(null, "public", "flyway_schema_history", null)) {
        historyExists = rs.next();
      }
      if (!historyExists) return; // fresh DB — let baselineOnMigrate handle it

      // 2. Highest successfully applied version in history
      int historyMax = 0;
      try (var stmt = conn.createStatement();
           var rs   = stmt.executeQuery(
               "SELECT COALESCE(MAX(CAST(version AS INTEGER)), 0) " +
               "FROM flyway_schema_history " +
               "WHERE success = TRUE AND version ~ '^[0-9]+$'")) {
        if (rs.next()) historyMax = rs.getInt(1);
      }
      if (historyMax >= LATEST_VERSION) return; // history is current, nothing to do

      // 3. Verify the schema was actually applied — every proof table must exist.
      // A partial DB with only `users` (V2) but missing later artifacts is NOT a
      // safe baseline target; let Flyway run the missing migrations instead.
      for (String t : PROOF_TABLES) {
        if (!tableExists(conn, t)) {
          log.info("Flyway history at v{} but proof table '{}' is missing — "
              + "skipping auto-baseline so Flyway can replay missing migrations.",
              historyMax, t);
          return;
        }
      }

      // History is stale — truncate and insert a single baseline at LATEST_VERSION
      log.warn(
          "Flyway history max={} but schema is fully applied (users table exists). " +
          "Re-baselining at V{} to avoid replaying applied migrations.",
          historyMax, LATEST_VERSION);

      conn.setAutoCommit(false);
      try {
        conn.createStatement().execute("TRUNCATE flyway_schema_history");
        conn.createStatement().execute(
            "INSERT INTO flyway_schema_history " +
            "(installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success) " +
            "VALUES (1, '" + LATEST_VERSION + "', '<< Flyway Baseline >>', 'BASELINE', " +
            "'<< Flyway Baseline >>', 0, 'auto-baseline', now(), 0, true)");
        conn.commit();
        log.info("Flyway schema history re-baselined at V{}.", LATEST_VERSION);
      } catch (SQLException e) {
        conn.rollback();
        throw e;
      } finally {
        conn.setAutoCommit(true);
      }
    }
  }

  private static boolean tableExists(Connection conn, String table) throws SQLException {
    try (ResultSet rs = conn.getMetaData().getTables(null, "public", table, new String[]{"TABLE"})) {
      return rs.next();
    }
  }
}
