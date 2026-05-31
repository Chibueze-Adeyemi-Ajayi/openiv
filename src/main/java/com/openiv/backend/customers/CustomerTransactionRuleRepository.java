package com.openiv.backend.customers;

import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public final class CustomerTransactionRuleRepository {
  private static final Logger log = LoggerFactory.getLogger(CustomerTransactionRuleRepository.class);
  private final Pool pool;

  public CustomerTransactionRuleRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<List<CustomerTransactionRule>> listByExternalCustomerId(long institutionId, String externalCustomerId) {
    return pool.preparedQuery(
        "SELECT r.* FROM customer_transaction_rules r " +
        "JOIN customers c ON c.id = r.customer_id " +
        "WHERE c.external_id = $1 AND r.institution_id = $2 " +
        "ORDER BY r.created_at DESC"
    ).execute(Tuple.of(externalCustomerId, institutionId))
    .map(rows -> {
      List<CustomerTransactionRule> list = new ArrayList<>();
      rows.forEach(r -> list.add(fromRow(r)));
      return list;
    })
    .onFailure(e -> log.error("[CustomerRuleRepo] listByExternalCustomerId failed: {}", e.getMessage()));
  }

  public Future<List<CustomerTransactionRule>> listActiveByExternalCustomerId(long institutionId, String externalCustomerId) {
    return pool.preparedQuery(
        "SELECT r.* FROM customer_transaction_rules r " +
        "JOIN customers c ON c.id = r.customer_id " +
        "WHERE c.external_id = $1 AND r.institution_id = $2 AND r.is_active = true " +
        "ORDER BY r.created_at DESC"
    ).execute(Tuple.of(externalCustomerId, institutionId))
    .map(rows -> {
      List<CustomerTransactionRule> list = new ArrayList<>();
      rows.forEach(r -> list.add(fromRow(r)));
      return list;
    })
    .onFailure(e -> log.error("[CustomerRuleRepo] listActiveByExternalCustomerId failed: {}", e.getMessage()));
  }

  public Future<CustomerTransactionRule> create(
      long institutionId, String externalCustomerId,
      String ruleType, JsonObject params, String action, String description, Long createdBy, String direction) {
    return pool.preparedQuery(
        "INSERT INTO customer_transaction_rules " +
        "(institution_id, customer_id, rule_type, params, action, description, created_by, direction) " +
        "SELECT $1, c.id, $2, $3::jsonb, $4, $5, $6, $7 " +
        "FROM customers c WHERE c.external_id = $8 AND c.institution_id = $1 " +
        "RETURNING *"
    ).execute(Tuple.of(institutionId, ruleType, params.encode(), action, description, createdBy, direction, externalCustomerId))
    .map(rows -> fromRow(rows.iterator().next()))
    .onFailure(e -> log.error("[CustomerRuleRepo] create failed: {}", e.getMessage()));
  }

  public Future<CustomerTransactionRule> update(
      long institutionId, long id,
      JsonObject params, String action, boolean isActive, String description, String direction) {
    return pool.preparedQuery(
        "UPDATE customer_transaction_rules " +
        "SET params = $1::jsonb, action = $2, is_active = $3, description = $4, direction = $5, updated_at = NOW() " +
        "WHERE id = $6 AND institution_id = $7 " +
        "RETURNING *"
    ).execute(Tuple.of(params.encode(), action, isActive, description, direction, id, institutionId))
    .map(rows -> {
      var it = rows.iterator();
      if (!it.hasNext()) throw new RuntimeException("rule_not_found");
      return fromRow(it.next());
    })
    .onFailure(e -> log.error("[CustomerRuleRepo] update failed: {}", e.getMessage()));
  }

  public Future<Void> delete(long institutionId, long id) {
    return pool.preparedQuery(
        "DELETE FROM customer_transaction_rules WHERE id = $1 AND institution_id = $2"
    ).execute(Tuple.of(id, institutionId))
    .<Void>mapEmpty()
    .onFailure(e -> log.error("[CustomerRuleRepo] delete failed: {}", e.getMessage()));
  }

  public Future<Void> toggleActive(long institutionId, long id, boolean isActive) {
    return pool.preparedQuery(
        "UPDATE customer_transaction_rules SET is_active = $1, updated_at = NOW() " +
        "WHERE id = $2 AND institution_id = $3"
    ).execute(Tuple.of(isActive, id, institutionId))
    .<Void>mapEmpty()
    .onFailure(e -> log.error("[CustomerRuleRepo] toggleActive failed: {}", e.getMessage()));
  }

  /**
   * Sums today's transactions for this customer in the given direction.
   * Pass {@code "outward"} for spending limits, {@code "inward"} for deposit limits,
   * or {@code "both"} for combined volume.
   */
  public Future<BigDecimal> sumTodayAmount(long institutionId, String externalCustomerId, String direction) {
    boolean both = direction == null || "both".equals(direction);
    String sql = "SELECT COALESCE(SUM(amount), 0) FROM transactions "
        + "WHERE institution_id = $1 AND customer_id = $2 "
        + "AND occurred_at::date = CURRENT_DATE"
        + (both ? "" : " AND direction = $3");
    Tuple args = both ? Tuple.of(institutionId, externalCustomerId)
                      : Tuple.of(institutionId, externalCustomerId, direction);
    return pool.preparedQuery(sql).execute(args)
        .map(rows -> {
          var n = rows.iterator().next().getNumeric(0);
          return n != null ? n.bigDecimalValue() : BigDecimal.ZERO;
        })
        .onFailure(e -> log.error("[CustomerRuleRepo] sumTodayAmount failed: {}", e.getMessage()));
  }

  /** Cumulative amount for a specific channel+direction today — used for KYC-tier daily limit enforcement. */
  public Future<BigDecimal> sumTodayAmountByChannelAndDirection(
      long institutionId, String externalCustomerId, String channel, String direction) {
    return pool.preparedQuery(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions " +
        "WHERE institution_id = $1 AND customer_id = $2 " +
        "AND LOWER(channel) LIKE '%' || LOWER($3) || '%' " +
        "AND direction = $4 " +
        "AND occurred_at::date = CURRENT_DATE"
    ).execute(Tuple.of(institutionId, externalCustomerId, channel, direction))
    .map(rows -> {
      var n = rows.iterator().next().getNumeric(0);
      return n != null ? n.bigDecimalValue() : BigDecimal.ZERO;
    })
    .onFailure(e -> log.error("[CustomerRuleRepo] sumTodayAmountByChannelAndDirection failed: {}", e.getMessage()));
  }

  /** Same direction-aware sum semantics as {@link #sumTodayAmount}, scoped to the current calendar month. */
  public Future<BigDecimal> sumMonthAmount(long institutionId, String externalCustomerId, String direction) {
    boolean both = direction == null || "both".equals(direction);
    String sql = "SELECT COALESCE(SUM(amount), 0) FROM transactions "
        + "WHERE institution_id = $1 AND customer_id = $2 "
        + "AND DATE_TRUNC('month', occurred_at) = DATE_TRUNC('month', NOW())"
        + (both ? "" : " AND direction = $3");
    Tuple args = both ? Tuple.of(institutionId, externalCustomerId)
                      : Tuple.of(institutionId, externalCustomerId, direction);
    return pool.preparedQuery(sql).execute(args)
        .map(rows -> {
          var n = rows.iterator().next().getNumeric(0);
          return n != null ? n.bigDecimalValue() : BigDecimal.ZERO;
        })
        .onFailure(e -> log.error("[CustomerRuleRepo] sumMonthAmount failed: {}", e.getMessage()));
  }

  public Future<Long> countInVelocityWindow(long institutionId, String externalCustomerId, int hours) {
    return pool.preparedQuery(
        "SELECT COUNT(*) FROM transactions " +
        "WHERE institution_id = $1 AND customer_id = $2 " +
        "AND occurred_at > NOW() - (CAST($3 AS INTEGER) * INTERVAL '1 hour')"
    ).execute(Tuple.of(institutionId, externalCustomerId, hours))
    .map(rows -> rows.iterator().next().getLong(0))
    .onFailure(e -> log.error("[CustomerRuleRepo] countInVelocityWindow failed: {}", e.getMessage()));
  }

  /** True if the customer received any inward transaction within the past N minutes. */
  public Future<Boolean> hasDepositInLastMinutes(long institutionId, String externalCustomerId, int minutes) {
    return pool.preparedQuery(
        "SELECT COUNT(*) FROM transactions " +
        "WHERE institution_id = $1 AND customer_id = $2 " +
        "AND direction = 'inward' " +
        "AND occurred_at > NOW() - (CAST($3 AS INTEGER) * INTERVAL '1 minute')"
    ).execute(Tuple.of(institutionId, externalCustomerId, minutes))
    .map(rows -> rows.iterator().next().getLong(0) > 0)
    .onFailure(e -> log.error("[CustomerRuleRepo] hasDepositInLastMinutes failed: {}", e.getMessage()));
  }

  /** Sum of inward (deposit) transactions for the customer within the past N hours. */
  public Future<BigDecimal> sumInwardAmountInWindow(long institutionId, String externalCustomerId, int hours) {
    return pool.preparedQuery(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions " +
        "WHERE institution_id = $1 AND customer_id = $2 " +
        "AND direction = 'inward' " +
        "AND occurred_at > NOW() - (CAST($3 AS INTEGER) * INTERVAL '1 hour')"
    ).execute(Tuple.of(institutionId, externalCustomerId, hours))
    .map(rows -> {
      var n = rows.iterator().next().getNumeric(0);
      return n != null ? n.bigDecimalValue() : BigDecimal.ZERO;
    })
    .onFailure(e -> log.error("[CustomerRuleRepo] sumInwardAmountInWindow failed: {}", e.getMessage()));
  }

  private CustomerTransactionRule fromRow(Row row) {
    // params is JSONB — Vert.x returns it as a JsonObject, not a String.
    JsonObject params = row.getJsonObject("params");
    if (params == null) params = new JsonObject();
    Long createdBy = row.getLong("created_by");
    String direction = row.getString("direction");
    return new CustomerTransactionRule(
        row.getLong("id"),
        row.getLong("institution_id"),
        row.getLong("customer_id"),
        row.getString("rule_type"),
        params,
        row.getString("action"),
        Boolean.TRUE.equals(row.getBoolean("is_active")),
        row.getString("description"),
        createdBy,
        row.getOffsetDateTime("created_at"),
        row.getOffsetDateTime("updated_at"),
        direction != null ? direction : "both"
    );
  }
}
