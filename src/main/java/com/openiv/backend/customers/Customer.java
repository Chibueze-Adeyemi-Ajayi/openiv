package com.openiv.backend.customers;

import java.time.OffsetDateTime;

public record Customer(
    long id,
    long institutionId,
    String externalId,
    String name,
    String email,
    String phone,
    int riskScore,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
