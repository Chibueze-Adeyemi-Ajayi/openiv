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
    String watchlistedReason,
    OffsetDateTime lastEvaluatedAt,
    Integer cddRiskScore,    // null = never CDD-evaluated
    String cddConcerns,      // JSON array: 404 gaps + suspicious-field warnings
    String cddStepScores,    // JSON array: enriched per-step results with authenticity scores
    String selfiePhoto,      // base64 selfie submitted during CDD import (for manual resolution)
    String identityPhoto     // base64 NIN/BVN record photo from identity lookup
) {}
