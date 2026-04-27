package com.openiv.backend.dashboard;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record NfiuReturn(
    long           id,
    String         reference,
    LocalDate      periodFrom,
    LocalDate      periodTo,
    long           totalTransactions,
    int            flaggedCount,
    BigDecimal     totalFlaggedAmount,
    String         status,
    OffsetDateTime submittedAt
) {}
