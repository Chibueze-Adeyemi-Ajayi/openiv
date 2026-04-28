package com.openiv.backend.network;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import io.vertx.core.Future;

import java.util.List;

public final class NetworkService {

  private final NetworkRepository repository;
  private final UserRepository    users;

  public NetworkService(NetworkRepository repository, UserRepository users) {
    this.repository = repository;
    this.users      = users;
  }

  public Future<List<NetworkEntry>> listLogs(Session session, NetworkFilter filter) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")))
        .compose(u -> repository.listLogs(u.institutionId(), filter));
  }
}
