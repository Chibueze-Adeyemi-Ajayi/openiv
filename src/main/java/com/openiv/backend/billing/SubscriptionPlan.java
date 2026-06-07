package com.openiv.backend.billing;

import java.math.BigDecimal;
import java.util.List;

public record SubscriptionPlan(
    String       id,
    String       name,
    String       slug,
    BigDecimal   monthlyPriceNgn,
    int          maxUsers,
    long         maxMonthlyTransactions,
    int          maxActiveCases,
    int          apiRateLimitPerMin,
    long         includedTransactionUnits,
    List<String> features,
    int          sortOrder,
    // feature flags
    boolean      featureKycEnabled,
    boolean      featureWebhooksEnabled,
    boolean      featureNetworkEnabled,
    boolean      featureBehavioralEnabled,
    boolean      featureReportsExport,
    int          maxAmlRules,
    // usage caps
    int          maxMonthlyKycLookups,
    int          maxMonthlyNfiuFilings,
    int          maxMonthlyCases
) {}
