package com.openiv.backend.billing;

public record BillingLedgerEntry(
    String dayStr,            // "2026-04-19"
    String type,              // "debit" | "credit"
    long   totalAmountUnits,
    long   endingBalanceUnits,
    long   eventCount,
    String lastRef
) {}
