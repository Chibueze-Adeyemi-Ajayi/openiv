package com.openiv.backend.auth.repository;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Tuple;

public final class BlockedDeviceRepository {

  private final Pool pool;

  public BlockedDeviceRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Boolean> isBlocked(long userId, String deviceId) {
    if (deviceId == null || deviceId.isBlank()) return Future.succeededFuture(false);
    return pool.preparedQuery(
            "SELECT 1 FROM blocked_devices WHERE user_id = $1 AND device_id = $2 LIMIT 1")
        .execute(Tuple.of(userId, deviceId))
        .map(rs -> rs.rowCount() > 0);
  }

  public Future<Void> block(long institutionId, long userId, String deviceId,
      String ipAddress, String userAgent, Long blockedByUserId) {
    String sql =
        "INSERT INTO blocked_devices (institution_id, user_id, device_id, ip_address, user_agent, blocked_by_user_id) "
            + "VALUES ($1, $2, $3, $4, $5, $6) "
            + "ON CONFLICT (user_id, device_id) DO UPDATE "
            + "  SET ip_address = EXCLUDED.ip_address, "
            + "      user_agent = EXCLUDED.user_agent, "
            + "      blocked_at = now(), "
            + "      blocked_by_user_id = EXCLUDED.blocked_by_user_id";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, userId, deviceId, ipAddress, userAgent, blockedByUserId))
        .mapEmpty();
  }
}
