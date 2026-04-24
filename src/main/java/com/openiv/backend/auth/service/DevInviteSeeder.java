package com.openiv.backend.auth.service;

import com.openiv.backend.auth.crypto.Codes;
import com.openiv.backend.auth.model.AccountType;
import com.openiv.backend.auth.repository.InstitutionRepository;
import com.openiv.backend.auth.repository.InvitationRepository;
import io.vertx.core.Future;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * When {@code environment=development} and no invitations exist yet, seed one and log the
 * plaintext code so developers can complete the onboarding flow end-to-end locally.
 * No-op on every other environment and no-op once any invitation exists.
 */
public final class DevInviteSeeder {

  private static final Logger log = LoggerFactory.getLogger(DevInviteSeeder.class);
  private static final String SEED_EMAIL = "dev@openiv.local";

  private DevInviteSeeder() {}

  public static Future<Void> runIfDev(boolean devMode, InvitationRepository invitations,
      InstitutionRepository institutions) {
    if (!devMode) {
      return Future.succeededFuture();
    }
    return invitations.existsForEmail(SEED_EMAIL).compose(exists -> {
      if (exists) {
        log.info("[dev-seed] Invitation for {} already exists; not regenerating.", SEED_EMAIL);
        return Future.succeededFuture();
      }
      // Pin the dev invite to the default institution created by V5.
      return institutions.findDefault().compose(opt -> {
        long institutionId = opt
            .orElseThrow(() -> new IllegalStateException(
                "Default institution missing — V5 migration not applied?"))
            .id();
        String code = Codes.generateInviteCode();
        String hash = Codes.sha256(code);
        return invitations.create(hash, SEED_EMAIL, "analyst",
                AccountType.INDIVIDUAL, institutionId, 365)
            .map(inv -> {
              log.warn("====================================================================");
              log.warn("[dev-seed] DEV INVITE CREATED");
              log.warn("[dev-seed]   email:         {}", SEED_EMAIL);
              log.warn("[dev-seed]   accountType:   INDIVIDUAL");
              log.warn("[dev-seed]   institutionId: {}", institutionId);
              log.warn("[dev-seed]   code:          {}", code);
              log.warn("[dev-seed] Use this code on /auth/invite, then log in as {}", SEED_EMAIL);
              log.warn("[dev-seed] with whatever password you want. This account will be created");
              log.warn("[dev-seed] on first login.");
              log.warn("====================================================================");
              return (Void) null;
            });
      });
    });
  }
}
