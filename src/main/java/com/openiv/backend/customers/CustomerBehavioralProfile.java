package com.openiv.backend.customers;

import java.math.BigDecimal;
import java.util.List;

public record CustomerBehavioralProfile(
    long institutionId,
    String customerId,
    BigDecimal avgAmount,
    BigDecimal stddevAmount,
    List<String> typicalChannels,
    int typicalHourMin,
    int typicalHourMax,
    List<Integer> typicalDays,
    List<String> typicalBanks,
    List<String> typicalCategories,
    int transactionCount
) {}
