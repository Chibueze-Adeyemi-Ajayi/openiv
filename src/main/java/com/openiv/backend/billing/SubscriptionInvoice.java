package com.openiv.backend.billing;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record SubscriptionInvoice(
    UUID           id,
    long           institutionId,
    String         planId,
    String         invoiceType,          // upgrade | downgrade | renewal
    BigDecimal     amountNgn,
    BigDecimal     discountPercent,
    BigDecimal     discountedAmountNgn,
    String         couponCode,
    OffsetDateTime couponExpiresAt,
    String         paystackReference,
    String         status,               // pending | paid | expired | cancelled
    OffsetDateTime createdAt,
    OffsetDateTime paidAt
) {}
