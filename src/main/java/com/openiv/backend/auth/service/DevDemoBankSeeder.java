package com.openiv.backend.auth.service;

import com.openiv.backend.auth.crypto.PasswordHasher;
import com.openiv.backend.auth.model.AccountType;
import com.openiv.backend.auth.model.Institution;
import com.openiv.backend.auth.repository.InstitutionRepository;
import com.openiv.backend.auth.repository.UserRepository;
import io.vertx.core.Future;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Dev-only seeder that creates a fully-formed demo bank + admin user so the login-as-admin
 * path is a one-keystroke out-of-the-box experience:
 *
 * <pre>
 *   email:    admin@demobank.local
 *   password: DemoBank2026!
 * </pre>
 *
 * <p>The admin's email is pre-verified. TOTP is <b>not</b> pre-enrolled on purpose — so the
 * first login walks through the TOTP setup screen and also exercises the RSA encryption
 * path end-to-end. To skip TOTP in dev, set an authenticator secret after first login.
 *
 * <p>Idempotent: re-runs are no-ops once the institution or user already exists.
 */
public final class DevDemoBankSeeder {

  private static final Logger log = LoggerFactory.getLogger(DevDemoBankSeeder.class);
  private static final String BANK_NAME = "Demo Bank Plc.";
  private static final String ADMIN_EMAIL = "admin@demobank.local";
  private static final String ADMIN_NAME = "Demo Bank Admin";
  private static final String ADMIN_PASSWORD = "DemoBank2026!";

  private DevDemoBankSeeder() {}

  public static Future<Void> runIfDev(boolean devMode, InstitutionRepository institutions,
      UserRepository users) {
    if (!devMode) {
      return Future.succeededFuture();
    }

    return users.findByEmail(ADMIN_EMAIL).compose(existing -> {
      if (existing.isPresent()) {
        log.info("[demo-seed] {} already exists; not regenerating.", ADMIN_EMAIL);
        return Future.succeededFuture();
      }
      return findOrCreateBank(institutions).compose(bank -> {
        String hash = PasswordHasher.hash(ADMIN_PASSWORD);
        return users.create(
                ADMIN_EMAIL,
                ADMIN_NAME,
                hash,
                /* mustChange    */ false,
                /* role          */ "admin",
                AccountType.COMPANY,
                bank.id(),
                /* emailVerified */ true)
            .map(u -> {
              log.warn("====================================================================");
              log.warn("[demo-seed] DEMO BANK + ADMIN CREATED");
              log.warn("[demo-seed]   institution: {} (id={})", BANK_NAME, bank.id());
              log.warn("[demo-seed]   email:       {}", ADMIN_EMAIL);
              log.warn("[demo-seed]   password:    {}", ADMIN_PASSWORD);
              log.warn("[demo-seed]   role:        admin");
              log.warn("[demo-seed] Email is pre-verified; first login goes to TOTP setup.");
              log.warn("====================================================================");
              return (Void) null;
            });
      });
    });
  }

  private static Future<Institution> findOrCreateBank(InstitutionRepository institutions) {
    return institutions.findByName(BANK_NAME).compose(opt -> {
      if (opt.isPresent()) return Future.succeededFuture(opt.get());
      return institutions.create(BANK_NAME, AccountType.COMPANY);
    });
  }
}
