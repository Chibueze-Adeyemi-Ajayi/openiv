package com.openiv.backend.auth.service;

import com.openiv.backend.auth.crypto.PasswordHasher;
import com.openiv.backend.auth.model.AccountType;
import com.openiv.backend.auth.repository.UserRepository;
import io.vertx.core.Future;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Seeds the platform super-admin account on startup if it does not yet exist.
 *
 * <p>The account is tied to institution ID 1 (the built-in OpenIV platform institution seeded
 * by V5). The password is sourced from {@code superadmin.password} in application.json, which
 * can be overridden at runtime via the {@code SUPER_ADMIN_PASSWORD} env var.
 *
 * <p>Idempotent — subsequent startups are no-ops once the email exists.
 */
public final class SuperAdminSeeder {

  private static final Logger log = LoggerFactory.getLogger(SuperAdminSeeder.class);

  private static final String SUPER_ADMIN_EMAIL = "chibuezeadeyemi@gmail.com";
  private static final long PLATFORM_INSTITUTION_ID = 1L;

  private SuperAdminSeeder() {}

  public static Future<Void> run(UserRepository users, String password) {
    if (password == null || password.isBlank()) {
      log.warn("[super-admin-seed] No password configured — skipping super-admin seeding. "
          + "Set superadmin.password in application.json or SUPER_ADMIN_PASSWORD env var.");
      return Future.succeededFuture();
    }

    return users.findByEmail(SUPER_ADMIN_EMAIL).compose(existing -> {
      if (existing.isPresent()) {
        log.info("[super-admin-seed] {} already exists; skipping.", SUPER_ADMIN_EMAIL);
        return Future.<Void>succeededFuture();
      }

      String hash = PasswordHasher.hash(password);
      return users.create(
              SUPER_ADMIN_EMAIL,
              "Platform Owner",
              hash,
              /* mustChangePassword */ false,
              /* role               */ "admin",
              AccountType.COMPANY,
              PLATFORM_INSTITUTION_ID,
              /* emailVerified      */ true)
          .map(u -> {
            log.warn("====================================================================");
            log.warn("[super-admin-seed] SUPER ADMIN ACCOUNT CREATED");
            log.warn("[super-admin-seed]   email:       {}", SUPER_ADMIN_EMAIL);
            log.warn("[super-admin-seed]   institution: OpenIV (default) (id={})", PLATFORM_INSTITUTION_ID);
            log.warn("[super-admin-seed]   role:        admin");
            log.warn("[super-admin-seed] Email is pre-verified. Set up TOTP on first login.");
            log.warn("[super-admin-seed] Change the password via the profile settings after login.");
            log.warn("====================================================================");
            return (Void) null;
          });
    });
  }
}
