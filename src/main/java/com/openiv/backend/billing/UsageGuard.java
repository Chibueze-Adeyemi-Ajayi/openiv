package com.openiv.backend.billing;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.beam.BeamApiKeyHandler;
import io.vertx.core.Handler;
import io.vertx.ext.web.RoutingContext;

/**
 * Route middleware that enforces monthly usage caps for transactions and KYC lookups.
 *
 * <p>Each guard atomically checks and increments the institution's monthly counter.
 * If the cap is reached, a 402 {@code plan_limit} response is returned and the
 * request chain is terminated before the actual handler runs.
 *
 * <p>Unlimited plans (cap = -1) always pass through. Institutions without a plan
 * assigned are also allowed through (permissive default).
 */
public final class UsageGuard {

  private UsageGuard() {}

  /**
   * Guard for beam ingest routes. Institution ID is read from the routing context
   * (set by {@link BeamApiKeyHandler}), so no session resolution is needed.
   */
  public static Handler<RoutingContext> transactionForBeam(UsageRepository usage) {
    return ctx -> {
      long institutionId = ctx.get(BeamApiKeyHandler.INSTITUTION_ID_KEY);
      usage.checkAndIncrementTxn(institutionId)
          .onSuccess(result -> {
            if (result.allowed()) {
              ctx.next();
            } else {
              String detail = result.limit() == -1
                  ? "Monthly transaction cap reached."
                  : "Your institution has used all " + result.limit()
                    + " monthly transactions. Usage resets after 30 days.";
              PlanGuard.planLimitResponse(ctx, "txn_cap",
                  result.planSlug(), nextPlan(result.planSlug()), detail);
            }
          })
          .onFailure(ctx::fail);
    };
  }

  /**
   * Guard for session-authenticated KYC lookup routes.
   * Resolves institution ID from the session user.
   */
  public static Handler<RoutingContext> kycLookup(UsageRepository usage, UserRepository users) {
    return sessionCheckAndIncrement(usage, users, "kyc_cap",
        "monthly KYC lookups", UsageRepository::checkAndIncrementKyc);
  }

  /** Guard for session-authenticated NFIU filing routes (file + approve). */
  public static Handler<RoutingContext> nfiuFiling(UsageRepository usage, UserRepository users) {
    return sessionCheckAndIncrement(usage, users, "nfiu_cap",
        "monthly NFIU filings", UsageRepository::checkAndIncrementNfiu);
  }

  /** Guard for session-authenticated case-open routes. */
  public static Handler<RoutingContext> caseOpen(UsageRepository usage, UserRepository users) {
    return sessionCheckAndIncrement(usage, users, "case_cap",
        "monthly cases", UsageRepository::checkAndIncrementCase);
  }

  // ── Shared session-resolution + 402-on-cap-reached pattern ────────────────

  @FunctionalInterface
  private interface CounterFn {
    io.vertx.core.Future<UsageRepository.UsageResult> apply(UsageRepository usage, long institutionId);
  }

  private static Handler<RoutingContext> sessionCheckAndIncrement(
      UsageRepository usage, UserRepository users,
      String feature, String unitLabel, CounterFn counter) {
    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      users.findById(session.userId())
          .compose(opt -> {
            long institutionId = opt
                .orElseThrow(() -> AuthException.invalid("session"))
                .institutionId();
            return counter.apply(usage, institutionId);
          })
          .onSuccess(result -> {
            if (result.allowed()) {
              ctx.next();
            } else {
              String detail = result.limit() == -1
                  ? "Monthly cap reached."
                  : "Your institution has used all " + result.limit()
                    + " " + unitLabel + " for this month. Usage resets after 30 days.";
              PlanGuard.planLimitResponse(ctx, feature,
                  result.planSlug(), nextPlan(result.planSlug()), detail);
            }
          })
          .onFailure(ctx::fail);
    };
  }

  private static String nextPlan(String current) {
    return switch (current) {
      case "starter" -> "growth";
      case "growth"  -> "scale";
      case "scale"   -> "enterprise";
      default        -> "enterprise";
    };
  }
}
