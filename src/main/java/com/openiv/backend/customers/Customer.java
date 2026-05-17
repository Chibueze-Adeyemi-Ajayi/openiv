package com.openiv.backend.customers;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record Customer(
    long id,
    long institutionId,
    String externalId,
    String name,
    String email,
    String phone,
    int riskScore,
    int riskProfileScore,
    int transactionRiskScore,
    String bvn,
    String nin,
    String photo,
    String accountNumber,
    String subjectType,
    LocalDate dob,
    String address,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    boolean watchlisted,
    OffsetDateTime watchlistedAt,
    String watchlistedReason
) {}
