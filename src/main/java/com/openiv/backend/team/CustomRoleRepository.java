package com.openiv.backend.team;

import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;

public final class CustomRoleRepository {

  private final Pool pool;

  public CustomRoleRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<List<JsonObject>> listByInstitution(long institutionId) {
    return pool.preparedQuery(
            "SELECT id, name, description, color, permissions FROM custom_roles WHERE institution_id = $1")
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          List<JsonObject> list = new ArrayList<>();
          rs.forEach(row -> list.add(map(row)));
          return list;
        });
  }

  public Future<Void> upsert(long institutionId, JsonObject role) {
    String sql = "INSERT INTO custom_roles (id, institution_id, name, description, color, permissions, updated_at) "
        + "VALUES ($1, $2, $3, $4, $5, $6, now()) "
        + "ON CONFLICT (id, institution_id) DO UPDATE SET "
        + "name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color, "
        + "permissions = EXCLUDED.permissions, updated_at = now()";
    
    return pool.preparedQuery(sql)
        .execute(Tuple.of(
            role.getString("id"),
            institutionId,
            role.getString("name"),
            role.getString("description"),
            role.getString("color"),
            role.getJsonObject("permissions")
        ))
        .mapEmpty();
  }

  public Future<Void> delete(long institutionId, String id) {
    return pool.preparedQuery("DELETE FROM custom_roles WHERE id = $1 AND institution_id = $2")
        .execute(Tuple.of(id, institutionId))
        .mapEmpty();
  }

  private JsonObject map(Row row) {
    return new JsonObject()
        .put("id", row.getString("id"))
        .put("name", row.getString("name"))
        .put("description", row.getString("description"))
        .put("color", row.getString("color"))
        .put("permissions", row.getJsonObject("permissions"));
  }
}
