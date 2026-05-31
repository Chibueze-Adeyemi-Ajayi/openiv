package com.openiv.backend.billing;

import java.util.List;

public record BillingUsage(
    String              periodStart,        // "2026-04-01"
    String              periodEnd,          // "2026-04-30"
    int                 dayOfPeriod,
    int                 daysInPeriod,
    long                totalDebitUnits,
    String              creditExpiresAt,    // ISO-8601, null if no credit
    boolean             isInFreePeriod,     // true while welcome credit is active
    List<CategoryUsage> categories          // categories that had ledger activity this month
) {
  public record CategoryUsage(
      String category,
      long   eventCount,
      long   totalAmountUnits,
      long   rateUnitsEach     // derived: totalAmountUnits / eventCount (or 0 if no events)
  ) {}
}
