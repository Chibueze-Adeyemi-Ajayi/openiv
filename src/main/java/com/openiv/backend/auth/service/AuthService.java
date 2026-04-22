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
import com.openiv.backend.auth.repository.InvitationRepository;
import com.openiv.backend.auth.repository.SessionRepository;
import com.openiv.backend.auth.repository.TotpSecretRepository;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.repository.VerificationCodeRepository;
import io.vertx.core.Future;

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
  private static final int RESET_TOKEN_TTL_MINUTES = 10;

  private final UserRepository users;
  private final InvitationRepository invitations;
  private final VerificationCodeRepository codes;
  private final TotpSecretRepository totp;
  private final SessionRepository sessions;
  private final EmailSender emailSender;
  private final TotpCipher totpCipher;

  // Lazy-computed Argon2id hash of a throwaway password. Used only to equalize timing on the
  // unknown-email login path. Populated on first use; constant for the JVM's lifetime.
  private volatile String dummyHash;

  public AuthService(UserRepository users, InvitationRepository invitations,
      VerificationCodeRepository codes, TotpSecretRepository totp,
      SessionRepository sessions, EmailSender emailSender, TotpCipher totpCipher) {
    this.users = users;
    this.invitations = invitations;
    this.codes = codes;
    this.totp = totp;
    this.sessions = sessions;
    this.emailSender = emailSender;
    this.totpCipher = totpCipher;
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
      String ip, String userAgent) {
    String normalizedEmail = email.trim();
    if (inviteCode != null && !inviteCode.isBlank()) {
      return loginWithInvite(normalizedEmail, password, inviteCode, ip, userAgent);
    }
    return loginExisting(normalizedEmail, password, ip, userAgent);
  }

  private Future<LoginResult> loginWithInvite(String email, String password, String inviteCode,
      String ip, String userAgent) {
    String codeHash = Codes.sha256(inviteCode.trim().toUpperCase());
    return invitations.findByCodeHash(codeHash).compose(opt -> {
      Invitation inv = opt.orElseThrow(() -> AuthException.invalid("invite_code"));
      if (!inv.isUsable()) {
        throw AuthException.invalid("invite_code");
      }
      if (!inv.email().equalsIgnoreCase(email)) {
        throw AuthException.invalid("invite_email_mismatch");
      }
      // Claim the invite: create user (carry role, account_type and institution_id over from
      // the invitation), mark accepted, issue session, send email code.
      String hash = PasswordHasher.hash(password);
      return users.create(
              inv.email(),
              /* fullName        */ null,
              hash,
              /* mustChange      */ false,
              inv.role(),
              inv.accountType(),
              inv.institutionId(),
              /* emailVerified   */ false)
          .compose(user -> invitations.markAccepted(inv.id(), user.id())
              .map(v -> user))
          .compose(user -> issueSessionAndSendEmailCode(user, ip, userAgent));
    });
  }

  private Future<LoginResult> loginExisting(String email, String password,
      String ip, String userAgent) {
    return users.findByEmail(email).compose(opt -> {
      if (opt.isEmpty()) {
        // Burn CPU to equalize timing with the password-verify path.
        PasswordHasher.verify(password, dummyHash());
        throw AuthException.invalid("credentials");
      }
      User user = opt.get();
      if (user.isLocked()) {
        throw AuthException.locked();
      }
      if (!PasswordHasher.verify(password, user.passwordHash())) {
        return users.recordFailedLogin(user.id(), FAILED_LOGIN_THRESHOLD, LOGIN_LOCK_MINUTES)
            .compose(v -> Future.<LoginResult>failedFuture(AuthException.invalid("credentials")));
      }
      return users.resetFailedLogins(user.id())
          .compose(v -> afterPasswordOk(user, ip, userAgent));
    });
  }

  private Future<LoginResult> afterPasswordOk(User user, String ip, String userAgent) {
    if (!user.emailVerified()) {
      return issueSessionAndSendEmailCode(user, ip, userAgent);
    }
    return totp.isEnabled(user.id()).compose(enabled -> {
      SessionState next = enabled ? SessionState.PENDING_TOTP_CHALLENGE : SessionState.PENDING_TOTP_SETUP;
      return issueSession(user, next, ip, userAgent)
          .map(sess -> new LoginResult(sess.token(), next, user.accountType()));
    });
  }

  private Future<LoginResult> issueSessionAndSendEmailCode(User user, String ip, String userAgent) {
    return issueSession(user, SessionState.PENDING_EMAIL_VERIFICATION, ip, userAgent)
        .compose(sess -> generateAndSendEmailCode(user).map(v -> new LoginResult(
            sess.token(), SessionState.PENDING_EMAIL_VERIFICATION, user.accountType())));
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
      return activate.compose(v -> sessions.transitionState(session.id(), SessionState.AUTHENTICATED))
          .map(v -> new VerifyResult(SessionState.AUTHENTICATED));
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
            opt.map(User::email).orElse(null)));
  }

  // --- Helpers -------------------------------------------------------------

  private Future<IssuedSession> issueSession(User user, SessionState state, String ip, String userAgent) {
    String token = Tokens.generate();
    String hash = Tokens.hash(token);
    return sessions.create(user.id(), hash, state, SESSION_TTL_MINUTES, ip, userAgent)
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
      com.openiv.backend.auth.model.AccountType accountType) {}

  public record VerifyResult(SessionState state) {}

  public record SessionInfo(SessionState state,
      com.openiv.backend.auth.model.AccountType accountType,
      String email) {}

  public record TotpEnrollment(String secret, String otpauthUri) {}

  public record ResetToken(String token) {}

  private record IssuedSession(String token, Session session) {}
}
