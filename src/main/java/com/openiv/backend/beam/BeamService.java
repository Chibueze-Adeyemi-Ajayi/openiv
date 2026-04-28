package com.openiv.backend.beam;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import io.vertx.core.Future;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public final class BeamService {

  private static final Set<String> VALID_STREAMS = Set.of(
      "transactions", "logins", "activity", "location", "devices", "otps");

  private final BeamRepository repository;
  private final UserRepository  users;
  private final OtpAnalyzer     otpAnalyzer;

  public BeamService(BeamRepository repository, UserRepository users, OtpAnalyzer otpAnalyzer) {
    this.repository  = repository;
    this.users       = users;
    this.otpAnalyzer = otpAnalyzer;
  }

  public Future<BeamRecord> ingest(long institutionId, String stream,
      String idempotencyKey, String payload,
      String ip, String userAgent, String requestHeaders, int bytes) {
    if (!VALID_STREAMS.contains(stream))
      return Future.failedFuture(new IllegalArgumentException("Unknown stream: " + stream));
    Future<BeamRecord> saved;
    if (idempotencyKey != null) {
      saved = repository.findByIdempotencyKey(institutionId, idempotencyKey)
          .compose(opt -> opt.isPresent()
              ? Future.succeededFuture(opt.get())
              : repository.saveRecord(institutionId, stream, idempotencyKey, payload,
                  ip, userAgent, requestHeaders, bytes));
    } else {
      saved = repository.saveRecord(institutionId, stream, null, payload,
          ip, userAgent, requestHeaders, bytes);
    }
    return saved.map(record -> {
      if ("otps".equals(stream) && otpAnalyzer != null) {
        otpAnalyzer.analyze(institutionId, OtpPayload.parse(payload));
      }
      return record;
    });
  }

  public Future<String> generateApiKey(Session session) {
    return resolveUser(session).compose(u -> {
      byte[] bytes = new byte[32];
      new SecureRandom().nextBytes(bytes);
      String key = "oivsk_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
      String prefix = key.substring(0, 12);
      String hash = sha256Hex(key);
      return repository.saveApiKey(u.institutionId(), hash, prefix).map(k -> key);
    });
  }

  public Future<Boolean> revokeApiKey(Session session) {
    return resolveUser(session).compose(u -> repository.deleteApiKey(u.institutionId()));
  }

  public Future<Optional<BeamApiKey>> getApiKeyInfo(Session session) {
    return resolveUser(session).compose(u -> repository.findApiKeyInfo(u.institutionId()));
  }

  public Future<List<BeamRecord>> listRecords(Session session, String stream) {
    return resolveUser(session).compose(u ->
        repository.listRecords(u.institutionId(), stream, 100));
  }

  public Future<Long> resolveInstitution(String bearerKey) {
    String hash = sha256Hex(bearerKey);
    return repository.findInstitutionByKeyHash(hash)
        .compose(opt -> {
          if (opt.isEmpty())
            return Future.failedFuture(new IllegalArgumentException("invalid key"));
          long institutionId = opt.get();
          repository.touchKeyLastUsed(institutionId);
          return Future.succeededFuture(institutionId);
        });
  }

  private Future<User> resolveUser(Session session) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")));
  }

  private static String sha256Hex(String input) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256")
          .digest(input.getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder(digest.length * 2);
      for (byte b : digest) sb.append(String.format("%02x", b));
      return sb.toString();
    } catch (Exception e) {
      throw new RuntimeException("SHA-256 failed", e);
    }
  }
}
