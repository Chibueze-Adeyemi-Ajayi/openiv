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
    List<CategoryUsage> categories          // all known categories, 0 when unused
) {
  public record CategoryUsage(
      String category,          // beam_ingest | kyc_lookup | webhook_delivery | ai_token
      long   eventCount,
      long   totalAmountUnits,
      long   rateUnitsEach
  ) {}
}
