package com.openiv.backend.transactions;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.transactions.TransactionRepository.TransactionPage;
import io.vertx.core.Future;

import java.util.List;

public final class TransactionService {

  private final TransactionRepository repository;
  private final UserRepository users;

  public TransactionService(TransactionRepository repository, UserRepository users) {
    this.repository = repository;
    this.users = users;
  }

  public Future<TransactionPage> list(Session session, String status, String flaggedStatus,
      String q, int page, int pageSize, String range, String channel,
      Integer minRisk, Integer maxRisk) {
    return resolveInstitution(session)
        .compose(institutionId -> repository.list(
            institutionId, status, flaggedStatus, q, page, pageSize, range, channel, minRisk, maxRisk));
  }

  public Future<List<Transaction>> export(Session session, String status, String flaggedStatus,
      String q, String range, String channel, Integer minRisk, Integer maxRisk) {
    return resolveInstitution(session)
        .compose(institutionId -> repository.exportAll(
            institutionId, status, flaggedStatus, q, range, channel, minRisk, maxRisk));
  }

  public Future<Void> bulkUpdateFlaggedStatus(Session session, List<String> ids, String newFlaggedStatus) {
    return resolveInstitution(session)
        .compose(institutionId -> repository.bulkUpdateFlaggedStatus(ids, institutionId, newFlaggedStatus));
  }

  public Future<Integer> importTransactions(Session session, List<TransactionImport> rows) {
    return resolveInstitution(session)
        .compose(institutionId -> repository.importBatch(institutionId, rows));
  }

  private Future<Long> resolveInstitution(Session session) {
    return users.findById(session.userId()).map(opt -> {
      User u = opt.orElseThrow(() -> AuthException.invalid("session"));
      return u.institutionId();
    });
  }
}
