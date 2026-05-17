package com.openiv.backend.customers;

import io.vertx.core.Future;

import java.time.LocalDate;
import java.util.List;
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

  public Future<Optional<Customer>> findByExternalId(long institutionId, String externalId) {
    return repository.findByExternalId(institutionId, externalId);
  }

  public Future<List<Customer>> listCustomers(long institutionId, String q, int pageSize) {
    int limit = Math.min(Math.max(1, pageSize), 100);
    return repository.list(institutionId, q == null || q.isBlank() ? null : q.trim(), limit);
  }

  public Future<Void> updateRiskScore(long institutionId, String externalId, int riskScore) {
    return repository.updateRiskScore(institutionId, externalId, riskScore);
  }

  public Future<Customer> updateProfile(long institutionId, String externalId,
      String bvn, String nin, String photo, String accountNumber, String subjectType,
      LocalDate dob, String address) {
    return repository.updateProfile(institutionId, externalId,
        blank(bvn), blank(nin), blank(photo), blank(accountNumber), blank(subjectType), dob, blank(address));
  }

  public Future<Customer> updateKycProfile(long institutionId, String externalId,
      String name, String bvn, String nin, String photo) {
    if (externalId == null || externalId.isBlank()) {
      return Future.failedFuture("External ID is required");
    }
    return repository.upsert(institutionId, externalId, name)
        .compose(c -> repository.updateProfile(institutionId, externalId,
            blank(bvn), blank(nin), blank(photo),
            c.accountNumber(), c.subjectType(), c.dob(), c.address()));
  }

  public Future<Customer> watchlist(long institutionId, String externalId, String reason) {
    return repository.watchlist(institutionId, externalId, reason);
  }

  public Future<Customer> unwatchlist(long institutionId, String externalId) {
    return repository.unwatchlist(institutionId, externalId);
  }

  public Future<Void> updateOverallRiskScore(long institutionId, String externalId, int score) {
    return repository.updateOverallRiskScore(institutionId, externalId, score);
  }

  public Future<Void> refreshAllScores(long institutionId) {
    return repository.refreshAllScores(institutionId);
  }

  public Future<List<Customer>> listHighRisk(long institutionId, int limit, int offset) {
    return repository.listHighRisk(institutionId, limit, offset);
  }

  public Future<Long> countHighRisk(long institutionId) {
    return repository.countHighRisk(institutionId);
  }

  public Future<List<Long>> distinctInstitutionIds() {
    return repository.distinctInstitutionIds();
  }

  private static String blank(String s) {
    return (s != null && !s.isBlank()) ? s.trim() : null;
  }
}
