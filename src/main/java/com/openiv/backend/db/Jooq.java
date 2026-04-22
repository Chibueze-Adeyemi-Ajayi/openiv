package com.openiv.backend.db;

import io.vertx.core.Future;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.RowSet;
import io.vertx.sqlclient.SqlClient;
import io.vertx.sqlclient.Tuple;
import org.jooq.Configuration;
import org.jooq.DSLContext;
import org.jooq.Param;
import org.jooq.Query;
import org.jooq.SQLDialect;
import org.jooq.conf.ParamType;
import org.jooq.conf.RenderNameCase;
import org.jooq.conf.RenderQuotedNames;
import org.jooq.conf.Settings;
import org.jooq.impl.DSL;
import org.jooq.impl.DefaultConfiguration;

import java.util.function.Function;

/**
 * Bridges jOOQ (type-safe SQL builder) to Vert.x {@link SqlClient} (reactive, pipelined execution).
 *
 * <p>We deliberately do NOT let jOOQ execute queries via JDBC — JDBC is blocking and would destroy
 * the event loop model. jOOQ renders SQL and bind values; Vert.x pg-client executes the result.
 */
public final class Jooq {

  private static final Configuration CONFIGURATION = buildConfiguration();

  private Jooq() {}

  /**
   * Returns an unattached DSL context. "Unattached" means jOOQ never holds a JDBC connection —
   * queries are built only. Execute them via {@link #execute(SqlClient, Query, Function)}.
   */
  public static DSLContext dsl() {
    return DSL.using(CONFIGURATION);
  }

  /**
   * Execute a jOOQ-built query via the reactive Vert.x client, mapping each row with {@code mapper}.
   */
  public static <T> Future<RowSet<T>> execute(SqlClient client, Query query, Function<Row, T> mapper) {
    String sql = query.getSQL(ParamType.INDEXED);
    Tuple tuple = toTuple(query);
    return client.preparedQuery(sql)
        .mapping(mapper::apply)
        .execute(tuple);
  }

  /**
   * Execute a jOOQ-built query, returning raw rows (no mapping). Use for queries where you only
   * care about row count or will iterate the RowSet later.
   */
  public static Future<RowSet<Row>> execute(SqlClient client, Query query) {
    String sql = query.getSQL(ParamType.INDEXED);
    Tuple tuple = toTuple(query);
    return client.preparedQuery(sql).execute(tuple);
  }

  private static Tuple toTuple(Query query) {
    Tuple tuple = Tuple.tuple();
    for (Param<?> param : query.getParams().values()) {
      if (!param.isInline()) {
        tuple.addValue(param.getValue());
      }
    }
    return tuple;
  }

  private static Configuration buildConfiguration() {
    Settings settings = new Settings()
        .withRenderNameCase(RenderNameCase.LOWER)
        .withRenderQuotedNames(RenderQuotedNames.NEVER)
        .withRenderSchema(false)
        .withExecuteLogging(false);
    return new DefaultConfiguration()
        .set(SQLDialect.POSTGRES)
        .set(settings);
  }
}
