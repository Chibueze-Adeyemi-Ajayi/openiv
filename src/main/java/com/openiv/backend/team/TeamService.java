package com.openiv.backend.team;

import com.openiv.backend.auth.crypto.Codes;
import com.openiv.backend.auth.crypto.PasswordHasher;
import com.openiv.backend.auth.model.AccountType;
import com.openiv.backend.auth.model.Institution;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.InstitutionRepository;
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
 * Team management, scoped to the caller's institution. Every method resolves
 * the caller's
 * session → institution_id and mutates only rows belonging there. No
 * cross-tenant reads,
 * no cross-tenant writes.
 *
 * <p>
 * The invite flow creates users directly with a temporary password and {@code
 * must_change_password=true}. On first login the session transitions to
 * MUST_CHANGE_PASSWORD →
 * PENDING_TOTP_SETUP → AUTHENTICATED. No invitation codes or secondary tables
 * are involved.
 */
public final class TeamService {

  private static final Logger log = LoggerFactory.getLogger(TeamService.class);
  private static final Set<String> MANAGER_ROLES = Set.of("admin", "cco");
  private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

  private final UserRepository users;
  private final InstitutionRepository institutions;
  private final CustomRoleRepository customRoles;
  private final EmailSender emailSender;
  private final String frontendUrl;

  public TeamService(UserRepository users, InstitutionRepository institutions,
      CustomRoleRepository customRoles, EmailSender emailSender) {
    this.users = users;
    this.institutions = institutions;
    this.customRoles = customRoles;
    this.emailSender = emailSender;
    this.frontendUrl = System.getenv().getOrDefault("FRONTEND_URL", "http://localhost:5173");
  }

  // --- Read from team record on
  // DB---------------------------------------------------------------

  public Future<TeamContext> context(Session session) {
    return users.findById(session.userId()).compose(opt -> {
      User u = opt.orElseThrow(() -> AuthException.invalid("session"));
      return institutions.findById(u.institutionId()).map(iopt -> new TeamContext(u,
          iopt.orElseThrow(() -> new IllegalStateException("institution missing for user " + u.id()))));
    });
  }

  public Future<List<User>> listMembers(TeamContext ctx) {
    return users.listActiveByInstitution(ctx.institution().id());
  }

  /**
   * Returns users who were directly invited but have not yet completed their
   * account setup.
   */
  public Future<List<User>> listPending(TeamContext ctx) {
    return users.listPendingByInstitution(ctx.institution().id());
  }

  public Future<List<io.vertx.core.json.JsonObject>> listCustomRoles(TeamContext ctx) {
    return customRoles.listByInstitution(ctx.institution().id()).compose(list -> {
      if (list.isEmpty()) {
        io.vertx.core.json.JsonObject defaultRole = new io.vertx.core.json.JsonObject()
            .put("id", "custom-default-compliance")
            .put("name", "Compliance Manager")
            .put("description", "Dedicated custom role for overseeing institutional compliance workflows.")
            .put("color", "#1e40af")
            .put("permissions", new io.vertx.core.json.JsonObject()
                .put("monitor", new io.vertx.core.json.JsonObject().put("view", true).put("act", true))
                .put("cases",
                    new io.vertx.core.json.JsonObject().put("view", true).put("assign", true).put("close", true))
                .put("reports", new io.vertx.core.json.JsonObject().put("view", true).put("file", true))
                .put("team", new io.vertx.core.json.JsonObject().put("view", true).put("manage", false)));
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

    for (Object r : TeamRoles.catalog()) {
      if (((io.vertx.core.json.JsonObject) r).getString("name").equalsIgnoreCase(name)) {
        return Future.failedFuture(AuthException.invalid("duplicate_role_name"));
      }
    }

    return customRoles.listByInstitution(ctx.institution().id()).compose(list -> {
      for (io.vertx.core.json.JsonObject existing : list) {
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

  /**
   * Directly creates a user with a temporary password and sends them a login
   * email.
   * The user must change their password on first login before they can use the
   * platform.
   */
  public Future<User> invite(TeamContext ctx, String email, String role) {
    requireManager(ctx);
    String normalized = normalizeEmail(email);
    if (!TeamRoles.isValid(role)) {
      return Future.failedFuture(AuthException.invalid("role"));
    }
    // Check if a user with this email already exists in this institution
    return users.findByEmail(normalized).compose(existing -> {
      if (existing.isPresent() && existing.get().institutionId() == ctx.institution().id()) {
        return Future.<User>failedFuture(AuthException.invalid("already_invited"));
      }
      String tempPassword = Codes.generateTempPassword();
      String hash = PasswordHasher.hash(tempPassword);
      AccountType accountType = ctx.institution().type();
      return users.createInvited(normalized, null, hash, role, accountType,
          ctx.institution().id(), ctx.caller().id())
          .map(user -> {
            String loginUrl = frontendUrl + "/auth/login";
            emailSender.sendTeamInvite(normalized, normalized, ctx.institution().name(),
                tempPassword, loginUrl)
                .onFailure(err -> log.warn(
                    "Team invite email failed for {} (userId={}); user created, admin can resend: {}",
                    normalized, user.id(), err.getMessage()));
            return user;
          });
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

  /** Revokes a pending invitation by disabling the user account. */
  public Future<Void> revokeInvitation(TeamContext ctx, long userId) {
    requireManager(ctx);
    return users.findById(userId).compose(opt -> {
      User target = opt.orElseThrow(() -> AuthException.invalid("invitation_not_found"));
      if (target.institutionId() != ctx.institution().id()) {
        return Future.failedFuture(AuthException.invalid("invitation_not_found"));
      }
      if (!target.mustChangePassword()) {
        return Future.failedFuture(AuthException.invalid("invitation_not_pending"));
      }
      return users.disable(userId, ctx.institution().id());
    });
  }

  /** Generates a new temporary password and resends the invite email. */
  public Future<User> resendInvitation(TeamContext ctx, long userId) {
    requireManager(ctx);
    return users.findById(userId).compose(opt -> {
      User target = opt.orElseThrow(() -> AuthException.invalid("invitation_not_found"));
      if (target.institutionId() != ctx.institution().id()) {
        return Future.failedFuture(AuthException.invalid("invitation_not_found"));
      }
      if (!target.mustChangePassword()) {
        return Future.failedFuture(AuthException.invalid("invitation_not_pending"));
      }
      String tempPassword = Codes.generateTempPassword();
      String hash = PasswordHasher.hash(tempPassword);
      return users.updatePassword(target.id(), hash, true)
          .map(v -> {
            String loginUrl = frontendUrl + "/auth/login";
            emailSender.sendTeamInvite(target.email(), target.email(),
                ctx.institution().name(), tempPassword, loginUrl)
                .onFailure(err -> log.warn(
                    "Resend invite email failed for {} (userId={}); password updated, admin can retry: {}",
                    target.email(), target.id(), err.getMessage()));
            return target;
          });
    });
  }

  // --- helpers ------------------------------------------------------------

  private static String normalizeEmail(String raw) {
    if (raw == null)
      throw AuthException.invalid("email");
    String trimmed = raw.trim().toLowerCase();
    if (!EMAIL.matcher(trimmed).matches())
      throw AuthException.invalid("email");
    return trimmed;
  }

  private static void requireManager(TeamContext ctx) {
    if (!MANAGER_ROLES.contains(ctx.caller().role())) {
      throw AuthException.invalid("forbidden");
    }
  }

  public record TeamContext(User caller, Institution institution) {
  }
}
