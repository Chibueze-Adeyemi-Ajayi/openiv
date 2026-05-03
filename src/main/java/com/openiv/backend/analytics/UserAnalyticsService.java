package com.openiv.backend.analytics;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.beam.BeamRepository;
import com.openiv.backend.transactions.TransactionRepository;
import io.vertx.core.Future;

public final class UserAnalyticsService {

  private final BeamRepository beamRepo;
  private final TransactionRepository txnRepo;
  private final UserRepository users;

  public UserAnalyticsService(BeamRepository beamRepo, TransactionRepository txnRepo, UserRepository users) {
    this.beamRepo = beamRepo;
    this.txnRepo = txnRepo;
    this.users = users;
  }

  public Future<UserHeatmaps> getUserHeatmaps(Session session, String userId, String range) {
    return users.findById(session.userId()).compose(opt -> {
      User u = opt.orElseThrow(() -> AuthException.invalid("session"));
      return getUserHeatmaps(u.institutionId(), userId, range);
    });
  }

  public Future<UserHeatmaps> getUserHeatmaps(long institutionId, String userId, String range) {
    var behavioralFuture = beamRepo.getHeatmap(institutionId, userId, range);
    var transactionFuture = txnRepo.getHeatmap(institutionId, userId, range);

    return Future.all(behavioralFuture, transactionFuture)
        .map(composite -> {
          double[][] behavioral = composite.resultAt(0);
          double[][] transactions = composite.resultAt(1);
          return new UserHeatmaps(behavioral, transactions);
        });
  }

  public record UserHeatmaps(double[][] behavioral, double[][] transactions) {}
}
