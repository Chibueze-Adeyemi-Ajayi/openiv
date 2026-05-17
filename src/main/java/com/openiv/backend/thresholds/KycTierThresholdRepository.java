package com.openiv.backend.thresholds;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class KycTierThresholdRepository {

  private final Pool pool;

  public KycTierThresholdRepository(Pool pool) {
    this.pool = pool;
  }

  public record KycTierThreshold(
      long id,
      long institutionId,
      int kycTier,
      long dailyLimitWire,
      long dailyLimitMobile,
      long dailyLimitUssd,
      long dailyLimitBdc,
      long dailyLimitOther,
      Long dailyLimitWireInward,
      Long dailyLimitWireOutward,
      Long dailyLimitMobileInward,
      Long dailyLimitMobileOutward,
      Long dailyLimitUssdInward,
      Long dailyLimitUssdOutward,
      Long dailyLimitBdcInward,
      Long dailyLimitBdcOutward,
      Long dailyLimitOtherInward,
      Long dailyLimitOtherOutward,
      long singleTxnLimitWire,
      long singleTxnLimitMobile,
      long singleTxnLimitUssd,
      long singleTxnLimitBdc,
      long singleTxnLimitOther,
      int maxTxnsPerHour,
      int maxTxnsPerDay,
      int riskScoreBoost,
      boolean requiresAdditionalVerification,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt
  ) {
    public long getDailyLimit(String channel) {
      return switch (channel.toLowerCase()) {
        case "wire" -> dailyLimitWire;
        case "mobile", "momo" -> dailyLimitMobile;
        case "ussd" -> dailyLimitUssd;
        case "bdc" -> dailyLimitBdc;
        default -> dailyLimitOther;
      };
    }

    public long getDailyLimitDirectional(String channel, String direction) {
      boolean out = "outward".equalsIgnoreCase(direction);
      return switch (channel.toLowerCase()) {
        case "wire"           -> out ? safeL(dailyLimitWireOutward,   dailyLimitWire)   : safeL(dailyLimitWireInward,   dailyLimitWire);
        case "mobile", "momo" -> out ? safeL(dailyLimitMobileOutward, dailyLimitMobile) : safeL(dailyLimitMobileInward, dailyLimitMobile);
        case "ussd"           -> out ? safeL(dailyLimitUssdOutward,   dailyLimitUssd)   : safeL(dailyLimitUssdInward,   dailyLimitUssd);
        case "bdc"            -> out ? safeL(dailyLimitBdcOutward,    dailyLimitBdc)    : safeL(dailyLimitBdcInward,    dailyLimitBdc);
        default               -> out ? safeL(dailyLimitOtherOutward,  dailyLimitOther)  : safeL(dailyLimitOtherInward,  dailyLimitOther);
      };
    }

    private static long safeL(Long v, long fallback) { return v != null ? v : fallback; }

    public long getSingleTxnLimit(String channel) {
      return switch (channel.toLowerCase()) {
        case "wire" -> singleTxnLimitWire;
        case "mobile", "momo" -> singleTxnLimitMobile;
        case "ussd" -> singleTxnLimitUssd;
        case "bdc" -> singleTxnLimitBdc;
        default -> singleTxnLimitOther;
      };
    }
  }

  public Future<Optional<KycTierThreshold>> findByInstitutionAndTier(
      long institutionId, int kycTier) {
    return pool.preparedQuery(
        "SELECT id, institution_id, kyc_tier, daily_limit_wire, daily_limit_mobile, " +
        "daily_limit_ussd, daily_limit_bdc, daily_limit_other, " +
        "daily_limit_wire_inward, daily_limit_wire_outward, daily_limit_mobile_inward, daily_limit_mobile_outward, " +
        "daily_limit_ussd_inward, daily_limit_ussd_outward, daily_limit_bdc_inward, daily_limit_bdc_outward, " +
        "daily_limit_other_inward, daily_limit_other_outward, " +
        "single_txn_limit_wire, " +
        "single_txn_limit_mobile, single_txn_limit_ussd, single_txn_limit_bdc, " +
        "single_txn_limit_other, max_txns_per_hour, max_txns_per_day, risk_score_boost, " +
        "requires_additional_verification, created_at, updated_at " +
        "FROM threshold_by_kyc_tier " +
        "WHERE institution_id=$1 AND kyc_tier=$2")
        .execute(Tuple.of(institutionId, kycTier))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapRow(it.next())) : Optional.empty();
        });
  }

  public Future<List<KycTierThreshold>> findAllByInstitution(long institutionId) {
    return pool.preparedQuery(
        "SELECT id, institution_id, kyc_tier, daily_limit_wire, daily_limit_mobile, " +
        "daily_limit_ussd, daily_limit_bdc, daily_limit_other, " +
        "daily_limit_wire_inward, daily_limit_wire_outward, daily_limit_mobile_inward, daily_limit_mobile_outward, " +
        "daily_limit_ussd_inward, daily_limit_ussd_outward, daily_limit_bdc_inward, daily_limit_bdc_outward, " +
        "daily_limit_other_inward, daily_limit_other_outward, " +
        "single_txn_limit_wire, " +
        "single_txn_limit_mobile, single_txn_limit_ussd, single_txn_limit_bdc, " +
        "single_txn_limit_other, max_txns_per_hour, max_txns_per_day, risk_score_boost, " +
        "requires_additional_verification, created_at, updated_at " +
        "FROM threshold_by_kyc_tier " +
        "WHERE institution_id=$1 ORDER BY kyc_tier ASC")
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          var list = new ArrayList<KycTierThreshold>();
          rs.forEach(r -> list.add(mapRow(r)));
          return list;
        });
  }

  public Future<Boolean> update(long institutionId, int kycTier,
      long dailyLimitWire, long singleTxnLimitWire,
      int maxTxnsPerDay, int riskScoreBoost) {
    return pool.preparedQuery(
        "UPDATE threshold_by_kyc_tier " +
        "SET daily_limit_wire=$1, single_txn_limit_wire=$2, max_txns_per_day=$3, " +
        "risk_score_boost=$4, updated_at=now() " +
        "WHERE institution_id=$5 AND kyc_tier=$6")
        .execute(Tuple.of(dailyLimitWire, singleTxnLimitWire, maxTxnsPerDay,
            riskScoreBoost, institutionId, kycTier))
        .map(rs -> rs.rowCount() > 0);
  }

  private KycTierThreshold mapRow(Row r) {
    return new KycTierThreshold(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getInteger("kyc_tier"),
        r.getLong("daily_limit_wire"),
        r.getLong("daily_limit_mobile"),
        r.getLong("daily_limit_ussd"),
        r.getLong("daily_limit_bdc"),
        r.getLong("daily_limit_other"),
        r.getLong("daily_limit_wire_inward"),
        r.getLong("daily_limit_wire_outward"),
        r.getLong("daily_limit_mobile_inward"),
        r.getLong("daily_limit_mobile_outward"),
        r.getLong("daily_limit_ussd_inward"),
        r.getLong("daily_limit_ussd_outward"),
        r.getLong("daily_limit_bdc_inward"),
        r.getLong("daily_limit_bdc_outward"),
        r.getLong("daily_limit_other_inward"),
        r.getLong("daily_limit_other_outward"),
        r.getLong("single_txn_limit_wire"),
        r.getLong("single_txn_limit_mobile"),
        r.getLong("single_txn_limit_ussd"),
        r.getLong("single_txn_limit_bdc"),
        r.getLong("single_txn_limit_other"),
        r.getInteger("max_txns_per_hour"),
        r.getInteger("max_txns_per_day"),
        r.getInteger("risk_score_boost"),
        r.getBoolean("requires_additional_verification"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at")
    );
  }
}
