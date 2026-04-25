package com.openiv.backend.heatmap;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import io.vertx.core.Future;

import java.time.LocalDate;
import java.util.List;

public final class HeatmapService {

  private final HeatmapRepository repository;
  private final UserRepository     users;

  public HeatmapService(HeatmapRepository repository, UserRepository users) {
    this.repository = repository;
    this.users      = users;
  }

  /** Transaction heatmap for a date range (inclusive on both ends). */
  public Future<List<HeatmapCell>> transactions(Session session, boolean abnormal, LocalDate from, LocalDate to) {
    return resolveUser(session).compose(u ->
        repository.transactionCells(u.institutionId(), abnormal, from, to));
  }

  /** Login activity heatmap for a date range (inclusive on both ends). */
  public Future<List<HeatmapCell>> activity(Session session, boolean abnormal, LocalDate from, LocalDate to) {
    return resolveUser(session).compose(u ->
        repository.activityCells(u.institutionId(), abnormal, from, to));
  }

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")));
  }
}
