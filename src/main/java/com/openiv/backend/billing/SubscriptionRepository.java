package com.openiv.backend.billing;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

public final class SubscriptionRepository {

  private final Pool db;

  public SubscriptionRepository(Pool db) {
    this.db = db;
  }

  public Future<List<SubscriptionPlan>> listPlans() {
    return db.query("""
        SELECT id, name, slug, monthly_price_ngn, max_users, max_monthly_transactions,
               max_active_cases, ai_features_enabled, api_rate_limit_per_min,
               included_transaction_units, features, sort_order,
               feature_kyc_enabled, feature_webhooks_enabled, feature_network_enabled,
               feature_behavioral_enabled, feature_reports_export, max_aml_rules,
               max_monthly_kyc_lookups
        FROM   subscription_plans
        WHERE  is_active = true
        ORDER  BY sort_order
        """).execute()
        .map(rs -> {
          var list = new ArrayList<SubscriptionPlan>();
          for (var row : rs) list.add(mapPlan(row));
          return list;
        });
  }

  public Future<Optional<InstitutionSubscription>> getByInstitution(long institutionId) {
    return db.preparedQuery("""
        SELECT sp.id, sp.name, sp.slug, sp.monthly_price_ngn, sp.max_users,
               sp.max_monthly_transactions, sp.max_active_cases, sp.ai_features_enabled,
               sp.api_rate_limit_per_min, sp.included_transaction_units,
               sp.features, sp.sort_order,
               sp.feature_kyc_enabled, sp.feature_webhooks_enabled, sp.feature_network_enabled,
               sp.feature_behavioral_enabled, sp.feature_reports_export, sp.max_aml_rules,
               sp.max_monthly_kyc_lookups,
               i.subscription_status, i.subscription_starts_at,
               i.trial_ends_at, i.subscription_renews_at
        FROM   institutions i
        JOIN   subscription_plans sp ON sp.id = i.plan_id
        WHERE  i.id = $1
        """).execute(Tuple.of(institutionId))
        .map(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) return Optional.empty();
          var row = it.next();
          var plan = mapPlan(row);
          return Optional.<InstitutionSubscription>of(new InstitutionSubscription(
              plan,
              row.getString("subscription_status"),
              row.getOffsetDateTime("subscription_starts_at"),
              row.getOffsetDateTime("trial_ends_at"),
              row.getOffsetDateTime("subscription_renews_at")
          ));
        });
  }

  public Future<Void> changePlan(long institutionId, String planId) {
    return db.preparedQuery("""
        UPDATE institutions SET
          plan_id                = $2::uuid,
          subscription_status    = 'active',
          subscription_starts_at = now(),
          subscription_renews_at = now() + INTERVAL '30 days'
        WHERE id = $1
        """).execute(Tuple.of(institutionId, planId))
        .mapEmpty();
  }

  /**
   * Apply a paid invoice: switch plan (or extend renewal), reset blocked status.
   * For renewals, extends subscription_renews_at by 30 days from its current value.
   * For upgrades/downgrades, resets the subscription cycle from now.
   */
  public Future<Void> applyPayment(long institutionId, String planId, boolean isRenewal) {
    if (isRenewal) {
      return db.preparedQuery("""
          UPDATE institutions SET
            plan_id                = $2::uuid,
            subscription_status    = 'active',
            subscription_blocked   = FALSE,
            subscription_renews_at = subscription_renews_at + INTERVAL '30 days'
          WHERE id = $1
          """).execute(Tuple.of(institutionId, planId))
          .mapEmpty();
    } else {
      return db.preparedQuery("""
          UPDATE institutions SET
            plan_id                = $2::uuid,
            subscription_status    = 'active',
            subscription_blocked   = FALSE,
            subscription_starts_at = now(),
            subscription_renews_at = now() + INTERVAL '30 days'
          WHERE id = $1
          """).execute(Tuple.of(institutionId, planId))
          .mapEmpty();
    }
  }

  /** Institutions that have passed renewal date, are not blocked, not cancelled. */
  public Future<List<Long>> findExpiredUnpaidInstitutions() {
    return db.query("""
        SELECT id FROM institutions
        WHERE subscription_renews_at < now()
          AND subscription_status IN ('active','trial')
          AND (subscription_blocked IS NULL OR subscription_blocked = FALSE)
        """).execute()
        .map(rs -> {
          var list = new ArrayList<Long>();
          rs.forEach(row -> list.add(row.getLong("id")));
          return list;
        });
  }

  /** Mark institution as past_due and blocked. */
  public Future<Void> blockInstitution(long institutionId) {
    return db.preparedQuery("""
        UPDATE institutions SET
          subscription_status  = 'past_due',
          subscription_blocked = TRUE
        WHERE id = $1
        """).execute(Tuple.of(institutionId))
        .mapEmpty();
  }

  public Future<Boolean> isBlocked(long institutionId) {
    return db.preparedQuery("""
        SELECT COALESCE(subscription_blocked, FALSE) AS blocked
        FROM institutions WHERE id = $1
        """).execute(Tuple.of(institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() && Boolean.TRUE.equals(it.next().getBoolean("blocked"));
        });
  }

  /** Admin/owner emails for an institution — used for sending renewal reminders. */
  public Future<List<String>> getAdminEmails(long institutionId) {
    return db.preparedQuery("""
        SELECT u.email::text
        FROM users u
        WHERE u.institution_id = $1
          AND u.role IN ('admin','owner','compliance_officer')
          AND u.status = 'active'
        """).execute(Tuple.of(institutionId))
        .map(rs -> {
          var list = new ArrayList<String>();
          rs.forEach(row -> list.add(row.getString("email")));
          return list;
        });
  }

  public Future<String> getInstitutionName(long institutionId) {
    return db.preparedQuery("""
        SELECT name FROM institutions WHERE id = $1
        """).execute(Tuple.of(institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? it.next().getString("name") : "Institution";
        });
  }

  private SubscriptionPlan mapPlan(Row row) {
    Object raw = row.getValue("features");
    List<String> features = List.of();
    if (raw instanceof String[] arr) {
      features = Arrays.asList(arr);
    } else if (raw != null) {
      features = List.of(raw.toString());
    }
    // Feature flag columns are nullable if the row predates V103 migration —
    // default to permissive (true) so existing Growth/Enterprise institutions
    // are not locked out before the migration runs.
    boolean featureKyc        = !Boolean.FALSE.equals(row.getBoolean("feature_kyc_enabled"));
    boolean featureWebhooks   = !Boolean.FALSE.equals(row.getBoolean("feature_webhooks_enabled"));
    boolean featureNetwork    = !Boolean.FALSE.equals(row.getBoolean("feature_network_enabled"));
    boolean featureBehavioral = !Boolean.FALSE.equals(row.getBoolean("feature_behavioral_enabled"));
    boolean featureReports    = !Boolean.FALSE.equals(row.getBoolean("feature_reports_export"));
    Integer maxAmlRules       = row.getInteger("max_aml_rules");
    Integer maxKycLookups     = row.getInteger("max_monthly_kyc_lookups");

    return new SubscriptionPlan(
        row.getUUID("id").toString(),
        row.getString("name"),
        row.getString("slug"),
        row.getBigDecimal("monthly_price_ngn"),
        row.getInteger("max_users"),
        row.getLong("max_monthly_transactions"),
        row.getInteger("max_active_cases"),
        row.getBoolean("ai_features_enabled"),
        row.getInteger("api_rate_limit_per_min"),
        row.getLong("included_transaction_units"),
        features,
        row.getInteger("sort_order"),
        featureKyc,
        featureWebhooks,
        featureNetwork,
        featureBehavioral,
        featureReports,
        maxAmlRules != null ? maxAmlRules : 29,
        maxKycLookups != null ? maxKycLookups : -1
    );
  }
}
