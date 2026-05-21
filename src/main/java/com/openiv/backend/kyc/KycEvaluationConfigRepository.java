package com.openiv.backend.kyc;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.Optional;

public final class KycEvaluationConfigRepository {

  private final Pool pool;

  public KycEvaluationConfigRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Optional<KycEvaluationConfig>> findByInstitution(long institutionId) {
    return pool.preparedQuery(
            "SELECT id, institution_id, interval_days, enabled, created_at, updated_at"
            + " FROM kyc_evaluation_config WHERE institution_id = $1")
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapRow(it.next())) : Optional.<KycEvaluationConfig>empty();
        });
  }

  public Future<KycEvaluationConfig> upsert(long institutionId, int intervalDays, boolean enabled) {
    return pool.preparedQuery(
            "INSERT INTO kyc_evaluation_config (institution_id, interval_days, enabled)"
            + " VALUES ($1, $2, $3)"
            + " ON CONFLICT (institution_id) DO UPDATE SET"
            + "   interval_days = EXCLUDED.interval_days,"
            + "   enabled       = EXCLUDED.enabled,"
            + "   updated_at    = NOW()"
            + " RETURNING id, institution_id, interval_days, enabled, created_at, updated_at")
        .execute(Tuple.of(institutionId, intervalDays, enabled))
        .map(rs -> mapRow(rs.iterator().next()));
  }

  private static KycEvaluationConfig mapRow(Row r) {
    return new KycEvaluationConfig(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getInteger("interval_days"),
        Boolean.TRUE.equals(r.getBoolean("enabled")),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"));
  }
}
