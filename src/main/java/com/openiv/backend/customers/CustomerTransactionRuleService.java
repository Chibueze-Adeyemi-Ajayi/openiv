package com.openiv.backend.customers;

import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;

import java.math.BigDecimal;
import java.util.List;

public final class CustomerTransactionRuleService {
  private final CustomerTransactionRuleRepository repo;

  public CustomerTransactionRuleService(CustomerTransactionRuleRepository repo) {
    this.repo = repo;
  }

  public Future<List<CustomerTransactionRule>> listByExternalCustomerId(long institutionId, String externalCustomerId) {
    return repo.listByExternalCustomerId(institutionId, externalCustomerId);
  }

  public Future<List<CustomerTransactionRule>> listActiveByExternalCustomerId(long institutionId, String externalCustomerId) {
    return repo.listActiveByExternalCustomerId(institutionId, externalCustomerId);
  }

  public Future<CustomerTransactionRule> create(
      long institutionId, String externalCustomerId,
      String ruleType, JsonObject params, String action, String description, Long createdBy, String direction) {
    return repo.create(institutionId, externalCustomerId, ruleType, params, action, description, createdBy, direction);
  }

  public Future<CustomerTransactionRule> update(
      long institutionId, long id,
      JsonObject params, String action, boolean isActive, String description, String direction) {
    return repo.update(institutionId, id, params, action, isActive, description, direction);
  }

  public Future<Void> delete(long institutionId, long id) {
    return repo.delete(institutionId, id);
  }

  public Future<Void> toggleActive(long institutionId, long id, boolean isActive) {
    return repo.toggleActive(institutionId, id, isActive);
  }

  public Future<BigDecimal> sumTodayAmount(long institutionId, String externalCustomerId) {
    return repo.sumTodayAmount(institutionId, externalCustomerId);
  }

  public Future<BigDecimal> sumMonthAmount(long institutionId, String externalCustomerId) {
    return repo.sumMonthAmount(institutionId, externalCustomerId);
  }

  public Future<Long> countInVelocityWindow(long institutionId, String externalCustomerId, int hours) {
    return repo.countInVelocityWindow(institutionId, externalCustomerId, hours);
  }
}
