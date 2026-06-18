package com.openiv.backend.customers;

import com.openiv.backend.kyc.KycPipelineResult;
import com.openiv.backend.kyc.KycPipelineResultRepository;
import io.vertx.core.Future;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public final class CustomerService {
  private static final Logger log = LoggerFactory.getLogger(CustomerService.class);

  private final CustomerRepository repository;
  private final KycPipelineResultRepository kycResults;

  public CustomerService(CustomerRepository repository) {
    this(repository, null);
  }

  public CustomerService(CustomerRepository repository, KycPipelineResultRepository kycResults) {
    this.repository = repository;
    this.kycResults = kycResults;
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

  public Future<List<Customer>> listCustomers(long institutionId, String q, int pageSize, int page) {
    int limit  = Math.min(Math.max(1, pageSize), 100);
    int offset = (Math.max(1, page) - 1) * limit;
    return repository.list(institutionId, q == null || q.isBlank() ? null : q.trim(), limit, offset);
  }

  public Future<Void> updateRiskScore(long institutionId, String externalId, int riskScore) {
    return repository.updateRiskScore(institutionId, externalId, riskScore);
  }

  public Future<Customer> updateProfile(long institutionId, String externalId,
      String bvn, String nin, String photo, String accountNumber, String subjectType,
      LocalDate dob, String address, Long photoDocumentId) {
    return repository.updateProfile(institutionId, externalId,
        blank(bvn), blank(nin), blank(photo), blank(accountNumber), blank(subjectType),
        dob, blank(address), photoDocumentId);
  }

  public Future<Customer> updateKycProfile(long institutionId, String externalId,
      String name, String bvn, String nin, String photo) {
    if (externalId == null || externalId.isBlank()) {
      return Future.failedFuture("External ID is required");
    }
    return repository.upsert(institutionId, externalId, name)
        .compose(c -> repository.updateProfile(institutionId, externalId,
            blank(bvn), blank(nin), blank(photo),
            c.accountNumber(), c.subjectType(), c.dob(), c.address(), null));
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

  /**
   * Fire-and-forget: refetch the latest KYC pipeline result for this customer and sync
   * the risk_score back onto the customers row. If no record exists, skips silently.
   */
  public void refreshRiskFromKyc(long institutionId, String externalId) {
    if (kycResults == null || externalId == null || externalId.isBlank()) return;
    kycResults.findLatestByCustomer(institutionId, externalId)
        .compose(opt -> {
          if (opt.isEmpty()) return Future.succeededFuture();
          KycPipelineResult latest = opt.get();
          return repository.updateRiskScore(institutionId, externalId, latest.overallRiskScore());
        })
        .onFailure(e -> log.warn("[Customer/KycRefresh] Failed for {}/{}: {}", institutionId, externalId, e.getMessage()));
  }

  public void refreshScore(long institutionId, String externalId) {
    if (externalId == null || externalId.isBlank()) return;
    repository.refreshScore(institutionId, externalId)
        .onFailure(e -> log.warn("[Customer] refreshScore failed for {}/{}: {}",
            institutionId, externalId, e.getMessage()));
  }

  public Future<Void> updateCddEvaluation(long institutionId, String externalId,
      int cddRiskScore, io.vertx.core.json.JsonArray concerns,
      io.vertx.core.json.JsonArray stepScores, String selfie, String idPhoto) {
    return repository.updateCddEvaluation(institutionId, externalId, cddRiskScore, concerns, stepScores, selfie, idPhoto);
  }

  public Future<java.util.Optional<com.openiv.backend.workflows.WorkflowRepository.DueCustomer>> findAsDueCustomer(
      long institutionId, String externalId) {
    return repository.findAsDueCustomer(institutionId, externalId);
  }

  public Future<Void> upsertFromWorkflow(long institutionId, String externalId,
      String name, String phone, String bvn, String nin, String dob) {
    return repository.upsertFromWorkflow(institutionId, externalId, name, phone, bvn, nin, dob);
  }

  public Future<java.util.Map<String, String[]>> findCredentialConflicts(long institutionId, java.util.List<String> externalIds) {
    return repository.findCredentialConflicts(institutionId, externalIds);
  }

  public Future<Void> updateLastEvaluated(long institutionId, String externalId, Long workflowDefinitionId) {
    return repository.updateLastEvaluated(institutionId, externalId, workflowDefinitionId);
  }

  public Future<Customer> resolveStep(long institutionId, String externalId,
      String stepType, boolean markPass, int score, String note) {
    return repository.resolveStep(institutionId, externalId, stepType, markPass, score, note);
  }

  public Future<Void> flagEnrichmentNeeded(long institutionId, long workflowDefinitionId) {
    return repository.flagEnrichmentNeeded(institutionId, workflowDefinitionId);
  }

  public Future<Void> rebindWorkflowCustomers(long institutionId, long fromWorkflowId, long toWorkflowId) {
    return repository.rebindWorkflowCustomers(institutionId, fromWorkflowId, toWorkflowId);
  }

  public Future<Long> countNeedsEnrichment(long institutionId) {
    return repository.countNeedsEnrichment(institutionId);
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
