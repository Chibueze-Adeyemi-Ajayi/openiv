package com.openiv.backend.waitlist;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;

public final class WaitlistRepository {

  private static final String COLS = "id, name, email, description, source, created_at";

  private final Pool pool;

  public WaitlistRepository(Pool pool) { this.pool = pool; }

  public Future<WaitlistEntry> save(String name, String email, String description, String source) {
    return pool.preparedQuery(
            "INSERT INTO waitlist (name, email, description, source) "
            + "VALUES ($1, $2, $3, $4) RETURNING " + COLS)
        .execute(Tuple.of(name, email, description, source))
        .map(rs -> map(rs.iterator().next()));
  }

  public Future<Integer> countRecentByEmail(String email, int withinMinutes) {
    return pool.preparedQuery(
            "SELECT COUNT(*)::int AS n FROM waitlist "
            + "WHERE email = $1 AND created_at > now() - ($2 || ' minutes')::interval")
        .execute(Tuple.of(email, Integer.toString(withinMinutes)))
        .map(rs -> rs.iterator().next().getInteger("n"));
  }

  public Future<List<WaitlistEntry>> listAll() {
    return pool.preparedQuery(
            "SELECT " + COLS + " FROM waitlist ORDER BY created_at DESC")
        .execute()
        .map(rs -> {
          var list = new ArrayList<WaitlistEntry>();
          rs.forEach(r -> list.add(map(r)));
          return list;
        });
  }

  private static WaitlistEntry map(Row r) {
    return new WaitlistEntry(
        r.getLong("id"),
        r.getString("name"),
        r.getString("email"),
        r.getString("description"),
        r.getString("source"),
        r.getOffsetDateTime("created_at"));
  }
}
