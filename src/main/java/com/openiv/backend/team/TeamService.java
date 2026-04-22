package com.openiv.backend.team;

import com.openiv.backend.auth.crypto.Codes;
import com.openiv.backend.auth.model.AccountType;
import com.openiv.backend.auth.model.Institution;
import com.openiv.backend.auth.model.Invitation;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.InstitutionRepository;
import com.openiv.backend.auth.repository.InvitationRepository;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.auth.service.EmailSender;
import io.vertx.core.Future;

import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Team management, scoped to the caller's institution. Every method resolves the caller's
 * session → institution_id and mutates only rows belonging there. No cross-tenant reads,
 * no cross-tenant writes.
 *
 * <p>Authorization: the caller's role must be {@code admin} or {@code cco} to mutate.
 */
public final class TeamService {

  private static final int INVITE_EXPIRY_DAYS = 7;
  private static final Set<String> MANAGER_ROLES = Set.of("admin", "cco");
  private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

  private final UserRepository users;
  private final InvitationRepository invitations;
  private final InstitutionRepository institutions;
  private final EmailSender emailSender;

  public TeamService(UserRepository users, InvitationRepository invitations,
      InstitutionRepository institutions, EmailSender emailSender) {
    this.users = users;
    this.invitations = invitations;
    this.institutions = institutions;
    this.emailSender = emailSender;
  }

  // --- Read ---------------------------------------------------------------

  public Future<TeamContext> context(Session session) {
    return users.findById(session.userId()).compose(opt -> {
      User u = opt.orElseThrow(() -> AuthException.invalid("session"));
      return institutions.findById(u.institutionId()).map(iopt ->
          new TeamContext(u, iopt.orElseThrow(() ->
              new IllegalStateException("institution missing for user " + u.id()))));
    });
  }

  public Future<List<User>> listMembers(TeamContext ctx) {
    return users.listActiveByInstitution(ctx.institution().id());
  }

  public Future<List<Invitation>> listPending(TeamContext ctx) {
    return invitations.listPendingByInstitution(ctx.institution().id());
  }

  // --- Mutate -------------------------------------------------------------

  public Future<Invitation> invite(TeamContext ctx, String email, String role) {
    requireManager(ctx);
    String normalized = normalizeEmail(email);
    if (!TeamRoles.isValid(role)) {
      return Future.failedFuture(AuthException.invalid("role"));
    }
    return invitations.existsPendingForEmailInInstitution(normalized, ctx.institution().id())
        .compose(exists -> {
          if (exists) {
            return Future.<Invitation>failedFuture(AuthException.invalid("already_invited"));
          }
          String code = Codes.generateInviteCode();
          String hash = Codes.sha256(code);
          AccountType accountType = ctx.institution().type();
          return invitations.create(hash, normalized, role, accountType,
                  ctx.institution().id(), INVITE_EXPIRY_DAYS)
              .compose(inv -> emailSender.sendVerificationCode(normalized,
                      "Invite code: " + code)
                  .map(v -> inv));
        });
  }

  public Future<Void> removeMember(TeamContext ctx, long userId) {
    requireManager(ctx);
    if (userId == ctx.caller().id()) {
      return Future.failedFuture(AuthException.invalid("cannot_remove_self"));
    }
    return users.disable(userId, ctx.institution().id());
  }

  public Future<Void> revokeInvitation(TeamContext ctx, long invitationId) {
    requireManager(ctx);
    return invitations.revoke(invitationId, ctx.institution().id());
  }

  public Future<Invitation> resendInvitation(TeamContext ctx, long invitationId) {
    requireManager(ctx);
    return invitations.findById(invitationId).compose(opt -> {
      Invitation inv = opt.orElseThrow(() -> AuthException.invalid("invitation_not_found"));
      if (inv.institutionId() != ctx.institution().id()) {
        return Future.failedFuture(AuthException.invalid("invitation_not_found"));
      }
      if (!"pending".equals(inv.status())) {
        return Future.failedFuture(AuthException.invalid("invitation_not_pending"));
      }
      String code = Codes.generateInviteCode();
      String hash = Codes.sha256(code);
      return invitations.rotateCode(inv.id(), hash, INVITE_EXPIRY_DAYS)
          .compose(v -> emailSender.sendVerificationCode(inv.email(), "Invite code: " + code))
          .compose(v -> invitations.findById(inv.id()))
          .map(updated -> updated.orElse(inv));
    });
  }

  // --- helpers ------------------------------------------------------------

  private static String normalizeEmail(String raw) {
    if (raw == null) throw AuthException.invalid("email");
    String trimmed = raw.trim().toLowerCase();
    if (!EMAIL.matcher(trimmed).matches()) throw AuthException.invalid("email");
    return trimmed;
  }

  private static void requireManager(TeamContext ctx) {
    if (!MANAGER_ROLES.contains(ctx.caller().role())) {
      throw AuthException.invalid("forbidden");
    }
  }

  public record TeamContext(User caller, Institution institution) {}
}
