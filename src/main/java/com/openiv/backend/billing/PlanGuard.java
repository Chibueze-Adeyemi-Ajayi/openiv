package com.openiv.backend.billing;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.repository.UserRepository;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

/**
 * Route-level middleware that blocks access based on the institution's
 * subscription plan. Returns HTTP 402 with a machine-readable body so the
 * frontend can surface a contextual upgrade prompt.
 *
 * <p>Usage in V1Router:
 * <pre>
 *   Handler&lt;RoutingContext&gt; requireKyc =
 *       PlanGuard.feature(subscriptionRepo, users, "kyc", "growth");
 *   router.post("/kyc/lookup")
 *       .handler(kycAuth).handler(requireKyc).handler(kycHandlers.lookup());
 * </pre>
 */
public final class PlanGuard {

  private PlanGuard() {}

  /**
   * @param feature      machine-readable feature name (e.g. "kyc")
   * @param requiredPlan minimum slug required (e.g. "growth")
   */
  public static Handler<RoutingContext> feature(
      SubscriptionRepository subscriptions,
      UserRepository users,
      String feature,
      String requiredPlan) {

    return ctx -> {
      var session = SessionAuthHandler.require(ctx);
      users.findById(session.userId())
          .compose(opt -> {
            if (opt.isEmpty()) return io.vertx.core.Future.failedFuture("user not found");
            return subscriptions.getByInstitution(opt.get().institutionId());
          })
          .onSuccess(subOpt -> {
            if (subOpt.isEmpty()) {
              ctx.next(); // no plan assigned yet — allow gracefully
              return;
            }
            var plan = subOpt.get().plan();
            boolean allowed = switch (feature) {
              case "kyc"            -> plan.featureKycEnabled();
              case "webhooks"       -> plan.featureWebhooksEnabled();
              case "network"        -> plan.featureNetworkEnabled();
              case "behavioral"     -> plan.featureBehavioralEnabled();
              case "reports_export" -> plan.featureReportsExport();
              default               -> true;
            };
            if (allowed) {
              ctx.next();
            } else {
              planLimitResponse(ctx, feature, plan.slug(), requiredPlan,
                  featureLabel(feature) + " requires the "
                      + capitalize(requiredPlan) + " plan or higher.");
            }
          })
          .onFailure(ctx::fail);
    };
  }

  /** Builds and sends the 402 response. Also used by service-layer callers. */
  public static void planLimitResponse(RoutingContext ctx, String feature,
      String currentPlan, String requiredPlan, String detail) {
    ctx.response().setStatusCode(402)
        .putHeader("Content-Type", "application/json")
        .end(new JsonObject()
            .put("error",        "plan_limit")
            .put("feature",      feature)
            .put("currentPlan",  currentPlan)
            .put("requiredPlan", requiredPlan)
            .put("detail",       detail)
            .encode());
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private static String featureLabel(String feature) {
    return switch (feature) {
      case "kyc"            -> "KYC Lookup";
      case "webhooks"       -> "Webhooks";
      case "network"        -> "Network Logs";
      case "behavioral"     -> "Behavioral Patterns";
      case "reports_export" -> "Report Export";
      case "active_cases"   -> "Opening new cases";
      default               -> capitalize(feature);
    };
  }

  private static String capitalize(String s) {
    if (s == null || s.isEmpty()) return s;
    return Character.toUpperCase(s.charAt(0)) + s.substring(1);
  }
}
