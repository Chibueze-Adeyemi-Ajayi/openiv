package com.openiv.backend.billing;

import java.time.OffsetDateTime;

public record BillingWallet(
    long           id,
    long           institutionId,
    long           balanceUnits,
    OffsetDateTime creditExpiresAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
  public long balanceNgn() { return balanceUnits / BillingRates.UNITS_PER_NGN; }
}
