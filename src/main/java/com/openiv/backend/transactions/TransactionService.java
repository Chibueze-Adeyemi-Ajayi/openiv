package com.openiv.backend.transactions;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.transactions.TransactionRepository.TransactionPage;
import com.openiv.backend.customers.CustomerService;
import io.vertx.core.Future;

import java.util.List;
import java.util.Optional;

public final class TransactionService {

  private final TransactionRepository repository;
  private final UserRepository users;
  private final CustomerService customerService;

  public TransactionService(TransactionRepository repository, UserRepository users, CustomerService customerService) {
    this.repository = repository;
    this.users = users;
    this.customerService = customerService;
  }

  public Future<TransactionPage> list(Session session, String status, String flaggedStatus,
      String q, int page, int pageSize, String range, String channel,
      Integer minRisk, Integer maxRisk, String sort) {
    return resolveUser(session).compose(u -> repository.list(
        u.institutionId(), status, flaggedStatus, q, page, pageSize,
        range, channel, minRisk, maxRisk, sort, u.id()));
  }

  public Future<Optional<Transaction>> getById(Session session, String id) {
    return resolveUser(session).compose(u -> repository.findById(id, u.institutionId()));
  }

  public Future<Void> markSeen(Session session, String transactionId) {
    return resolveUser(session).compose(u ->
        repository.markSeen(transactionId, u.institutionId(), u.id()));
  }

  public Future<List<Transaction>> export(Session session, String status, String flaggedStatus,
      String q, String range, String channel, Integer minRisk, Integer maxRisk) {
    return resolveInstitution(session)
        .compose(institutionId -> repository.exportAll(
            institutionId, status, flaggedStatus, q, range, channel, minRisk, maxRisk));
  }

  public Future<Void> bulkUpdateFlaggedStatus(Session session, List<String> ids,
      String newFlaggedStatus, String reason, long documentId) {
    return resolveInstitution(session)
        .compose(institutionId -> repository.bulkUpdateFlaggedStatus(
            ids, institutionId, newFlaggedStatus, reason, documentId));
  }

  public Future<Integer> importTransactions(Session session, List<TransactionImport> rows) {
    return resolveInstitution(session)
        .compose(institutionId -> {
          if (customerService != null) {
            rows.forEach(r -> customerService.upsert(institutionId, r.customerId(), r.customerName()));
          }
          return repository.importBatch(institutionId, rows);
        });
  }

  public Future<Void> markFlagged(String transactionId, long institutionId) {
    return repository.markFlagged(transactionId, institutionId);
  }

  public Future<Void> markFlaggedWithRiskScore(String transactionId, long institutionId, int riskScore) {
    return repository.markFlaggedWithRiskScore(transactionId, institutionId, riskScore);
  }

  public Future<Void> ingestFromBeam(long institutionId, TransactionImport row) {
    if (customerService != null) {
      customerService.upsert(institutionId, row.customerId(), row.customerName());
    }
    return repository.importBatch(institutionId, List.of(row)).mapEmpty();
  }

  public Future<Long> getTodayCount(long institutionId, java.time.LocalDate today) {
    return repository.countByInstitutionAndDate(institutionId, today);
  }

  public Future<Long> getYesterdayCount(long institutionId, java.time.LocalDate yesterday) {
    return repository.countByInstitutionAndDate(institutionId, yesterday);
  }

  public Future<Long> getCustomerTxnCount24h(long institutionId, String customerId) {
    return repository.countByCustomerLast24h(institutionId, customerId);
  }

  public Future<Optional<Transaction>> getLastTransactionWithLocation(
      long institutionId, String customerId, String excludeId) {
    return repository.findLastWithLocation(institutionId, customerId, excludeId);
  }

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId()).map(opt ->
        opt.orElseThrow(() -> AuthException.invalid("session")));
  }

  private Future<Long> resolveInstitution(Session session) {
    return users.findById(session.userId()).map(opt -> {
      User u = opt.orElseThrow(() -> AuthException.invalid("session"));
      return u.institutionId();
    });
  }
}
