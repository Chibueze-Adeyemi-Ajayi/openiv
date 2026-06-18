// =============================================================================
// DEPRECATED — The network integration package is superseded by the Nomos rule
// engine. Cross-institution network signals are now consumed natively by Nomos
// rule functions rather than surfaced as a standalone integration surface.
//
// DO NOT delete — retained for institutions still using network feed endpoints.
// DO NOT build new features here. New rule logic belongs in com.openiv.backend.nomos.
// =============================================================================
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
