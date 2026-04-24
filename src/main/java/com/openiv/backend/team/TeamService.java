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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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

  private static final Logger log = LoggerFactory.getLogger(TeamService.class);
  private static final int INVITE_EXPIRY_DAYS = 7;
  private static final Set<String> MANAGER_ROLES = Set.of("admin", "cco");
  private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

  private final UserRepository users;
  private final InvitationRepository invitations;
  private final InstitutionRepository institutions;
  private final CustomRoleRepository customRoles;
  private final EmailSender emailSender;

  public TeamService(UserRepository users, InvitationRepository invitations,
      InstitutionRepository institutions, CustomRoleRepository customRoles, EmailSender emailSender) {
    this.users = users;
    this.invitations = invitations;
    this.institutions = institutions;
    this.customRoles = customRoles;
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

  public Future<List<io.vertx.core.json.JsonObject>> listCustomRoles(TeamContext ctx) {
    return customRoles.listByInstitution(ctx.institution().id()).compose(list -> {
      if (list.isEmpty()) {
        // Auto-implement the standard app custom role: "Compliance Manager"
        io.vertx.core.json.JsonObject defaultRole = new io.vertx.core.json.JsonObject()
            .put("id", "custom-default-compliance")
            .put("name", "Compliance Manager")
            .put("description", "Dedicated custom role for overseeing institutional compliance workflows.")
            .put("color", "#1e40af")
            .put("permissions", new io.vertx.core.json.JsonObject()
                .put("monitor", new io.vertx.core.json.JsonObject().put("view", true).put("act", true))
                .put("cases", new io.vertx.core.json.JsonObject().put("view", true).put("assign", true).put("close", true))
                .put("reports", new io.vertx.core.json.JsonObject().put("view", true).put("file", true))
                .put("team", new io.vertx.core.json.JsonObject().put("view", true).put("manage", false))
            );
        return customRoles.upsert(ctx.institution().id(), defaultRole).map(v -> List.of(defaultRole));
      }
      return Future.succeededFuture(list);
    });
  }

  public Future<Void> saveCustomRole(TeamContext ctx, io.vertx.core.json.JsonObject role) {
    requireManager(ctx);
    String id = role.getString("id");
    String name = role.getString("name");
    
    if (id == null || !id.startsWith("custom-")) {
      return Future.failedFuture(AuthException.invalid("role_id"));
    }

    // CHECK FOR DUPLICATES: Check system roles first
    for (Object r : TeamRoles.catalog()) {
      if (((io.vertx.core.json.JsonObject)r).getString("name").equalsIgnoreCase(name)) {
        return Future.failedFuture(AuthException.invalid("duplicate_role_name"));
      }
    }

    return customRoles.listByInstitution(ctx.institution().id()).compose(list -> {
      for (io.vertx.core.json.JsonObject existing : list) {
        // PERMIT NEW ROLE CREATION, BLOCK UPDATES
        if (existing.getString("id").equals(id)) {
          return Future.failedFuture(AuthException.security("feature_locked"));
        }
        if (existing.getString("name").equalsIgnoreCase(name)) {
          return Future.failedFuture(AuthException.invalid("duplicate_role_name"));
        }
      }
      return customRoles.upsert(ctx.institution().id(), role);
    });
  }

  public Future<Void> deleteCustomRole(TeamContext ctx, String roleId) {
    return Future.failedFuture(AuthException.security("feature_locked"));
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
              .compose(inv -> emailSender.sendVerificationCode(normalized, "Invite code: " + code)
                  .recover(err -> {
                    log.warn("Invite email failed for {} (id={}); invitation created, admin can resend: {}",
                        normalized, inv.id(), err.getMessage());
                    return Future.succeededFuture();
                  })
                  .map(v -> inv));
        });
  }

  public Future<Void> removeMember(TeamContext ctx, long userId) {
    if (!"admin".equals(ctx.caller().role())) {
      return Future.failedFuture(AuthException.invalid("forbidden"));
    }
    if (userId == ctx.caller().id()) {
      return Future.failedFuture(AuthException.invalid("cannot_remove_self"));
    }
    return users.findById(userId).compose(opt -> {
      User target = opt.orElseThrow(() -> AuthException.invalid("user_not_found"));
      if ("admin".equals(target.role())) {
        return Future.failedFuture(AuthException.invalid("cannot_remove_admin"));
      }
      return users.disable(userId, ctx.institution().id());
    });
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
          .compose(v -> emailSender.sendVerificationCode(inv.email(), "Invite code: " + code)
              .recover(err -> {
                log.warn("Resend email failed for {} (id={}); code was rotated, admin can retry: {}",
                    inv.email(), inv.id(), err.getMessage());
                return Future.succeededFuture();
              }))
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
