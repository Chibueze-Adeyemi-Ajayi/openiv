package com.openiv.backend.auth.service;

import com.openiv.backend.auth.crypto.Codes;
import com.openiv.backend.auth.crypto.PasswordHasher;
import com.openiv.backend.auth.crypto.Tokens;
import com.openiv.backend.auth.crypto.Totp;
import com.openiv.backend.auth.crypto.TotpCipher;
import com.openiv.backend.auth.model.Invitation;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.SessionState;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.BlockedDeviceRepository;
import com.openiv.backend.auth.repository.InvitationRepository;
import com.openiv.backend.auth.repository.SessionRepository;
import com.openiv.backend.auth.repository.SessionTransferRepository;
import com.openiv.backend.auth.repository.TotpSecretRepository;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.repository.VerificationCodeRepository;
import com.openiv.backend.geofence.GeoAccessRequest;
import com.openiv.backend.geofence.GeoFenceService;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonObject;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Orchestration for every onboarding / authentication flow.
 *
 * <p>Uniform-latency principle: failure paths {@link #login} take roughly the same time as
 * success. We always run a password hash (even on unknown email) to avoid user-enumeration
 * via response-time side channels.
 *
 * <p>Errors are signalled as {@link AuthException} with a category that handlers map to HTTP
 * codes. The category is safe to return to the client; detail strings are not.
 */
public final class AuthService {

  private static final int EMAIL_CODE_DIGITS = 6;
  private static final int EMAIL_CODE_TTL_MINUTES = 15;
  private static final int RESET_CODE_TTL_MINUTES = 30;
  private static final int FAILED_LOGIN_THRESHOLD = 5;
  private static final int LOGIN_LOCK_MINUTES = 15;
  private static final int SESSION_TTL_MINUTES = 24 * 60;
  /** Session idle timeout: if last_used_at is older than this, the session is treated as
   *  abandoned and silently revoked so the user can log in again without friction. */
  private static final int SESSION_IDLE_TIMEOUT_MINUTES = 30;
  private static final int RESET_TOKEN_TTL_MINUTES = 10;

  private final UserRepository users;
  private final InvitationRepository invitations;
  private final VerificationCodeRepository codes;
  private final TotpSecretRepository totp;
  private final SessionRepository sessions;
  private final EmailSender emailSender;
  private final TotpCipher totpCipher;
  private final BlockedDeviceRepository blockedDevices;
  private final SessionTransferRepository transfers;
  private final Vertx vertx;
  private GeoFenceService geoFence; // set after construction to avoid circular dep

  // Lazy-computed Argon2id hash of a throwaway password. Used only to equalize timing on the
  // unknown-email login path. Populated on first use; constant for the JVM's lifetime.
  private volatile String dummyHash;

  public AuthService(UserRepository users, InvitationRepository invitations,
      VerificationCodeRepository codes, TotpSecretRepository totp,
      SessionRepository sessions, EmailSender emailSender, TotpCipher totpCipher,
      BlockedDeviceRepository blockedDevices, SessionTransferRepository transfers, Vertx vertx) {
    this.users = users;
    this.invitations = invitations;
    this.codes = codes;
    this.totp = totp;
    this.sessions = sessions;
    this.emailSender = emailSender;
    this.totpCipher = totpCipher;
    this.blockedDevices = blockedDevices;
    this.transfers = transfers;
    this.vertx = vertx;
  }

  /** Called after construction once GeoFenceService is ready (avoids circular dependency). */
  public void setGeoFence(GeoFenceService geoFence) {
    this.geoFence = geoFence;
  }

  // --- Invite --------------------------------------------------------------

  /** Return the invited email (masked) and account type if the code is valid. */
  public Future<InviteInfo> verifyInvite(String inviteCode) {
    String codeHash = Codes.sha256(inviteCode.trim().toUpperCase());
    return invitations.findByCodeHash(codeHash)
        .compose(opt -> {
          Invitation inv = opt.orElseThrow(() -> AuthException.invalid("invite_code"));
          if (!inv.isUsable()) {
            throw AuthException.invalid("invite_code");
          }
          return Future.succeededFuture(
              new InviteInfo(inv.email(), maskEmail(inv.email()), inv.accountType()));
        });
  }

  // --- Login (with optional invite claim) ---------------------------------

  public Future<LoginResult> login(String email, String password, String inviteCode,
      String ip, String userAgent, Double lat, Double lon, Double accuracy, String deviceId) {
    String normalizedEmail = email.trim();
    if (inviteCode != null && !inviteCode.isBlank()) {
      return loginWithInvite(normalizedEmail, password, inviteCode, deviceId, ip, userAgent, lat, lon, accuracy);
    }
    return loginExisting(normalizedEmail, password, deviceId, ip, userAgent, lat, lon, accuracy);
  }

  private Future<LoginResult> loginWithInvite(String email, String password, String inviteCode,
      String deviceId, String ip, String userAgent, Double lat, Double lon, Double accuracy) {
    String codeHash = Codes.sha256(inviteCode.trim().toUpperCase());
    return invitations.findByCodeHash(codeHash).compose(opt -> {
      Invitation inv = opt.orElseThrow(() -> AuthException.invalid("invite_code"));
      if (!inv.isUsable()) throw AuthException.invalid("invite_code");
      if (!inv.email().equalsIgnoreCase(email)) throw AuthException.invalid("invite_email_mismatch");
      String hash = PasswordHasher.hash(password);
      return users.create(inv.email(), null, hash, false,
              inv.role(), inv.accountType(), inv.institutionId(), false)
          .compose(user -> invitations.markAccepted(inv.id(), user.id()).map(v -> user))
          .compose(user -> issueSessionAndSendEmailCode(user, deviceId, ip, userAgent, lat, lon, accuracy));
    });
  }

  private Future<LoginResult> loginExisting(String email, String password,
      String deviceId, String ip, String userAgent, Double lat, Double lon, Double accuracy) {
    return users.findByEmail(email).compose(opt -> {
      if (opt.isEmpty()) {
        PasswordHasher.verify(password, dummyHash());
        throw AuthException.invalid("credentials");
      }
      User user = opt.get();
      if (user.isLocked()) throw AuthException.locked();
      if (!PasswordHasher.verify(password, user.passwordHash())) {
        return users.recordFailedLogin(user.id(), FAILED_LOGIN_THRESHOLD, LOGIN_LOCK_MINUTES)
            .compose(v -> Future.<LoginResult>failedFuture(AuthException.invalid("credentials")));
      }
      return users.resetFailedLogins(user.id())
          .compose(v -> checkDeviceConflict(user, deviceId, ip, userAgent, lat, lon, accuracy));
    });
  }

  // ── Device / session conflict checks ────────────────────────────────────────

  private Future<LoginResult> checkDeviceConflict(User user, String deviceId,
      String ip, String userAgent, Double lat, Double lon, Double accuracy) {
    return blockedDevices.isBlocked(user.id(), deviceId).compose(blocked -> {
      if (blocked) throw AuthException.deviceBlocked();
      return sessions.findActiveAuthenticated(user.id()).compose(active -> {
        if (active.isEmpty()) {
          return afterPasswordOk(user, deviceId, ip, userAgent, lat, lon, accuracy);
        }
        Session existing = active.get(0);

        // Check if the session has an active WebSocket connection.
        // If socket_active = false (no connection), the session is dead — revoke and allow login.
        if (!existing.isSocketAlive()) {
          return sessions.revoke(existing.id())
              .compose(v -> afterPasswordOk(user, deviceId, ip, userAgent, lat, lon, accuracy));
        }

        boolean sameDevice = deviceId != null && deviceId.equals(existing.deviceId());

        if (sameDevice) {
          // Same browser profile on a different tab/window — offer session transfer.
          String token = Tokens.generate();
          String hash  = Tokens.hash(token);
          return transfers.create(user.id(), hash, 5)
              .compose(v -> Future.<LoginResult>failedFuture(
                  AuthException.conflict("active_session_same_device",
                      new JsonObject().put("transferRef", token))));
        } else {
          // Different machine/browser — block and push a real-time alert to the active session.
          vertx.eventBus().publish("user." + user.id() + ".security",
              new JsonObject()
                  .put("type",      "login_attempt")
                  .put("userId",    user.id())
                  .put("ip",        ip)
                  .put("userAgent", userAgent)
                  .put("deviceId",  deviceId)
                  .put("at",        Instant.now().toString()));
          throw AuthException.conflict("active_session_other_device", new JsonObject()
              .put("existingIp",        existing.ip())
              .put("existingUserAgent", existing.userAgent())
              .put("existingCreatedAt", existing.createdAt() != null ? existing.createdAt().toString() : null));
        }
      });
    });
  }

  /** Session transfer: verify the short-lived token + TOTP, revoke old sessions, issue new. */
  public Future<LoginResult> transferSession(String transferRef, String totpCode,
      String deviceId, String ip, String userAgent, Double lat, Double lon, Double accuracy) {
    String hash = Tokens.hash(transferRef.trim());
    return transfers.consume(hash).compose(opt -> {
      long userId = opt.orElseThrow(() -> AuthException.invalid("transfer_ref"));
      return users.findById(userId).compose(userOpt -> {
        User user = userOpt.orElseThrow(() -> AuthException.invalid("transfer_ref"));
        return totp.findEnabledSecret(user.id()).compose(secretOpt -> {
          String encrypted = secretOpt.orElseThrow(() -> AuthException.invalid("totp_not_enrolled"));
          String secret = totpCipher.decrypt(encrypted);
          if (!Totp.verify(secret, totpCode.trim())) throw AuthException.invalid("code");
          return sessions.revokeAllForUser(user.id())
              .compose(v -> issueSession(user, SessionState.AUTHENTICATED, deviceId, ip, userAgent, lat, lon, accuracy))
              .map(sess -> new LoginResult(sess.token(), SessionState.AUTHENTICATED, user.accountType(), user.displayName(), user.institutionId()));
        });
      });
    });
  }

  /** Block a device fingerprint — called by the active session owner from the alert popup. */
  public Future<Void> blockDevice(Session session, String deviceId, String ipAddress, String userAgent) {
    if (session.state() != SessionState.AUTHENTICATED) throw AuthException.wrongState();
    return users.findById(session.userId()).compose(opt -> {
      User user = opt.orElseThrow();
      return blockedDevices.block(user.institutionId(), user.id(), deviceId, ipAddress, userAgent, user.id());
    });
  }

  private Future<LoginResult> afterPasswordOk(User user, String deviceId, String ip,
      String userAgent, Double lat, Double lon, Double accuracy) {
    if (!user.emailVerified()) {
      return issueSessionAndSendEmailCode(user, deviceId, ip, userAgent, lat, lon, accuracy);
    }
    return totp.isEnabled(user.id()).compose(enabled -> {
      SessionState next = enabled ? SessionState.PENDING_TOTP_CHALLENGE : SessionState.PENDING_TOTP_SETUP;
      return issueSession(user, next, deviceId, ip, userAgent, lat, lon, accuracy)
          .map(sess -> new LoginResult(sess.token(), next, user.accountType(), user.displayName(), user.institutionId()));
    });
  }

  private Future<LoginResult> issueSessionAndSendEmailCode(User user, String deviceId,
      String ip, String userAgent, Double lat, Double lon, Double accuracy) {
    return issueSession(user, SessionState.PENDING_EMAIL_VERIFICATION, deviceId, ip, userAgent, lat, lon, accuracy)
        .compose(sess -> generateAndSendEmailCode(user).map(v -> new LoginResult(
            sess.token(), SessionState.PENDING_EMAIL_VERIFICATION, user.accountType(), user.displayName(), user.institutionId())));
  }

  // --- Email verification -------------------------------------------------

  public Future<Void> resendEmailCode(Session session) {
    assertState(session, SessionState.PENDING_EMAIL_VERIFICATION);
    return users.findById(session.userId())
        .compose(opt -> generateAndSendEmailCode(opt.orElseThrow()));
  }

  public Future<VerifyResult> verifyEmailCode(Session session, String code) {
    assertState(session, SessionState.PENDING_EMAIL_VERIFICATION);
    return users.findById(session.userId()).compose(opt -> {
      User user = opt.orElseThrow();
      String codeHash = Codes.sha256(code.trim());
      return codes.consume(user.email(), codeHash, "email_verification")
          .compose(consumed -> {
            if (consumed.isEmpty()) {
              throw AuthException.invalid("code");
            }
            return users.markEmailVerified(user.id())
                .compose(v -> totp.isEnabled(user.id()))
                .compose(enabled -> {
                  SessionState next = enabled
                      ? SessionState.AUTHENTICATED
                      : SessionState.PENDING_TOTP_SETUP;
                  return sessions.transitionState(session.id(), next)
                      .map(v -> new VerifyResult(next));
                });
          });
    });
  }

  // --- TOTP ---------------------------------------------------------------

  public Future<TotpEnrollment> enrollTotp(Session session) {
    assertState(session, SessionState.PENDING_TOTP_SETUP);
    return users.findById(session.userId()).compose(opt -> {
      User user = opt.orElseThrow();
      String secret = Totp.generateSecret();
      // Encrypt the secret at rest — the DB never sees plaintext TOTP material.
      String encrypted = totpCipher.encrypt(secret);
      return totp.upsertDisabled(user.id(), encrypted)
          .map(v -> new TotpEnrollment(secret, Totp.otpauthUri(secret, user.email())));
    });
  }

  public Future<VerifyResult> verifyTotp(Session session, String code) {
    SessionState state = session.state();
    if (state != SessionState.PENDING_TOTP_SETUP && state != SessionState.PENDING_TOTP_CHALLENGE) {
      throw AuthException.wrongState();
    }
    return (state == SessionState.PENDING_TOTP_SETUP
        ? totp.findAnySecret(session.userId())
        : totp.findEnabledSecret(session.userId())
    ).compose(opt -> {
      String encrypted = opt.orElseThrow(() -> AuthException.invalid("totp_not_enrolled"));
      String secret = totpCipher.decrypt(encrypted);
      if (!Totp.verify(secret, code.trim())) {
        throw AuthException.invalid("code");
      }
      Future<Void> activate = (state == SessionState.PENDING_TOTP_SETUP)
          ? totp.enable(session.userId())
          : Future.succeededFuture();
      // Geo fence gate — only on the normal login challenge path (not first-time TOTP setup)
      if (state == SessionState.PENDING_TOTP_CHALLENGE && geoFence != null) {
        return activate
            .compose(v -> geoFence.checkGate(session))
            .compose(geoOpt -> {
              if (geoOpt.isPresent()) {
                // Session already transitioned to GEO_BLOCKED inside checkGate
                return Future.succeededFuture(new VerifyResult(SessionState.GEO_BLOCKED, geoOpt.get()));
              }
              return sessions.transitionState(session.id(), SessionState.AUTHENTICATED)
                  .map(v -> new VerifyResult(SessionState.AUTHENTICATED, null));
            });
      }
      return activate.compose(v -> sessions.transitionState(session.id(), SessionState.AUTHENTICATED))
          .map(v -> new VerifyResult(SessionState.AUTHENTICATED, null));
    });
  }

  public Future<Void> verifyTotpStepUp(Session session, String code) {
    if (session.state() != SessionState.AUTHENTICATED) {
      throw AuthException.wrongState();
    }
    return totp.findEnabledSecret(session.userId()).compose(opt -> {
      String encrypted = opt.orElseThrow(() -> AuthException.invalid("totp_not_enrolled"));
      String secret = totpCipher.decrypt(encrypted);
      if (!Totp.verify(secret, code.trim())) {
        throw AuthException.invalid("code");
      }
      return Future.succeededFuture();
    });
  }

  public Future<Void> reportStepUpLockout(Session session) {
    if (session.state() != SessionState.AUTHENTICATED) {
      throw AuthException.wrongState();
    }
    String timestamp = Instant.now()
        .atOffset(ZoneOffset.UTC)
        .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    return users.findById(session.userId()).compose(opt -> {
      User user = opt.orElseThrow();
      Future<Void> notifyUser = emailSender.sendStepUpLockout(
          user.email(), user.displayName(), timestamp);
      Future<Void> notifyAdmins = users.listActiveByInstitution(user.institutionId())
          .compose(all -> {
            List<User> admins = all.stream()
                .filter(u -> u.id() != user.id()
                    && u.role() != null
                    && u.role().toLowerCase().contains("admin"))
                .collect(Collectors.toList());
            if (admins.isEmpty()) return Future.succeededFuture();
            List<Future<?>> futures = admins.stream()
                .map(admin -> (Future<?>) emailSender.sendStepUpLockoutAdmin(
                    admin.email(), admin.displayName(),
                    user.displayName(), user.email(), timestamp))
                .collect(Collectors.toList());
            return Future.all(futures).mapEmpty();
          });
      return Future.all(notifyUser, notifyAdmins).mapEmpty();
    });
  }

  // --- Password change / reset --------------------------------------------

  public Future<Void> changePassword(Session session, String currentPassword, String newPassword) {
    if (session.state() != SessionState.AUTHENTICATED) {
      throw AuthException.wrongState();
    }
    validatePasswordStrength(newPassword);
    return users.findById(session.userId()).compose(opt -> {
      User user = opt.orElseThrow();
      if (!PasswordHasher.verify(currentPassword, user.passwordHash())) {
        throw AuthException.invalid("credentials");
      }
      String newHash = PasswordHasher.hash(newPassword);
      return users.updatePassword(user.id(), newHash, false)
          .compose(v -> sessions.revokeAllForUser(user.id()));
    });
  }


  public Future<Void> requestPasswordReset(String email) {
    String normalized = email.trim();
    return users.findByEmail(normalized).compose(opt -> {
      if (opt.isEmpty()) {
        // Do not leak — always return success.
        return Future.succeededFuture();
      }
      User user = opt.get();
      String code = Codes.generateNumeric(EMAIL_CODE_DIGITS);
      return codes.replace(user.id(), user.email(), Codes.sha256(code),
              "password_reset", RESET_CODE_TTL_MINUTES)
          .compose(v -> emailSender.sendPasswordResetCode(user.email(), code));
    });
  }

  /**
   * Step 2 of reset: validate the emailed 6-digit code and issue a short-lived opaque reset
   * token that the frontend must present in step 3. Lets the UI give real feedback on bad codes
   * before the user types a new password.
   */
  public Future<ResetToken> verifyPasswordResetCode(String email, String code) {
    String normalized = email.trim();
    String codeHash = Codes.sha256(code.trim());
    return codes.consume(normalized, codeHash, "password_reset").compose(consumed -> {
      if (consumed.isEmpty() || consumed.get() == null) {
        throw AuthException.invalid("code");
      }
      Long userId = consumed.get();
      String token = Tokens.generate();
      String tokenHash = Tokens.hash(token);
      return codes.replace(userId, normalized, tokenHash,
              "password_reset_token", RESET_TOKEN_TTL_MINUTES)
          .map(v -> new ResetToken(token));
    });
  }

  public Future<Void> confirmPasswordReset(String email, String resetToken, String newPassword) {
    validatePasswordStrength(newPassword);
    String normalized = email.trim();
    String tokenHash = Tokens.hash(resetToken.trim());
    return codes.consume(normalized, tokenHash, "password_reset_token").compose(consumed -> {
      if (consumed.isEmpty() || consumed.get() == null) {
        throw AuthException.invalid("reset_token");
      }
      Long userId = consumed.get();
      String newHash = PasswordHasher.hash(newPassword);
      return users.updatePassword(userId, newHash, false)
          .compose(v -> sessions.revokeAllForUser(userId));
    });
  }

  // --- Session management -------------------------------------------------

  public Future<Session> resolve(String bearerToken) {
    String hash = Tokens.hash(bearerToken);
    return sessions.findByTokenHash(hash).compose(opt -> {
      Session s = opt.orElseThrow(() -> AuthException.invalid("session"));
      if (!s.isActive()) {
        throw AuthException.invalid("session");
      }
      return sessions.touch(s.id()).map(v -> s);
    });
  }

  public Future<Void> logout(Session session) {
    return sessions.revoke(session.id());
  }

  /** Convenience for the /session endpoint: hydrates the User behind a session in one call. */
  public Future<SessionInfo> sessionInfo(Session session) {
    return users.findById(session.userId())
        .map(opt -> new SessionInfo(session.state(),
            opt.map(User::accountType).orElse(null),
            opt.map(User::email).orElse(null),
            opt.map(User::role).orElse(null),
            opt.map(User::fullName).orElse(null),
            session.userId()));
  }

  // --- Helpers -------------------------------------------------------------

  private Future<IssuedSession> issueSession(User user, SessionState state, String deviceId,
      String ip, String userAgent, Double lat, Double lon, Double accuracy) {
    String token = Tokens.generate();
    String hash = Tokens.hash(token);
    return sessions.create(user.id(), hash, state, SESSION_TTL_MINUTES, deviceId, ip, userAgent, lat, lon, accuracy)
        .map(s -> new IssuedSession(token, s));
  }

  private Future<Void> generateAndSendEmailCode(User user) {
    String code = Codes.generateNumeric(EMAIL_CODE_DIGITS);
    return codes.replace(user.id(), user.email(), Codes.sha256(code),
            "email_verification", EMAIL_CODE_TTL_MINUTES)
        .compose(v -> emailSender.sendVerificationCode(user.email(), code));
  }

  private static void assertState(Session s, SessionState expected) {
    if (s.state() != expected) {
      throw AuthException.wrongState();
    }
  }

  private static void validatePasswordStrength(String password) {
    if (password == null || password.length() < 8) {
      throw AuthException.weakPassword("min_length");
    }
    boolean hasLetter = password.chars().anyMatch(Character::isLetter);
    boolean hasDigit = password.chars().anyMatch(Character::isDigit);
    if (!hasLetter || !hasDigit) {
      throw AuthException.weakPassword("must_contain_letter_and_digit");
    }
  }

  private String dummyHash() {
    String d = dummyHash;
    if (d == null) {
      synchronized (this) {
        d = dummyHash;
        if (d == null) {
          d = PasswordHasher.hash("x");
          dummyHash = d;
        }
      }
    }
    return d;
  }

  private static String maskEmail(String email) {
    int at = email.indexOf('@');
    if (at <= 1) return "***" + email.substring(at);
    return email.charAt(0) + "***" + email.substring(at);
  }

  // --- Result types -------------------------------------------------------

  public record InviteInfo(String email, String maskedEmail,
      com.openiv.backend.auth.model.AccountType accountType) {}

  public record LoginResult(String sessionToken, SessionState state,
      com.openiv.backend.auth.model.AccountType accountType, String fullName, long institutionId) {}

  public record VerifyResult(SessionState state, GeoAccessRequest geoRequest) {
    public VerifyResult(SessionState state) { this(state, null); }
  }

  public record SessionInfo(SessionState state,
      com.openiv.backend.auth.model.AccountType accountType,
      String email,
      String role,
      String fullName,
      long userId) {}

  public record TotpEnrollment(String secret, String otpauthUri) {}

  public record ResetToken(String token) {}

  private record IssuedSession(String token, Session session) {}
}
