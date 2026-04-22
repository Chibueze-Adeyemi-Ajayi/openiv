/**
 * Database layer. Two paths, by design:
 * <ul>
 *   <li><b>Hot path</b> — reactive {@link io.vertx.sqlclient.Pool Pool} built by
 *       {@link com.openiv.backend.db.DataSources}. SQL is composed with jOOQ via
 *       {@link com.openiv.backend.db.Jooq} and executed non-blocking.</li>
 *   <li><b>Startup path</b> — JDBC {@link javax.sql.DataSource} used exclusively by Flyway in
 *       {@link com.openiv.backend.db.Migrations}. Runs on a worker thread, then closed.</li>
 * </ul>
 * <p>JDBC must never be used on an event loop.
 */
package com.openiv.backend.db;
