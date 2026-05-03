package com.openiv.backend.customers;

import io.vertx.core.Future;
import java.util.Optional;

public final class CustomerService {
  private final CustomerRepository repository;

  public CustomerService(CustomerRepository repository) {
    this.repository = repository;
  }

  public Future<Customer> upsert(long institutionId, String externalId, String name) {
    if (externalId == null || externalId.isBlank()) {
      return Future.failedFuture("External ID is required");
    }
    return repository.upsert(institutionId, externalId, name);
  }

  public Future<Optional<Customer>> getCustomer(long institutionId, String externalId) {
    return repository.findByExternalId(institutionId, externalId);
  }

  public Future<Void> updateRiskScore(long institutionId, String externalId, int riskScore) {
    return repository.updateRiskScore(institutionId, externalId, riskScore);
  }
}
