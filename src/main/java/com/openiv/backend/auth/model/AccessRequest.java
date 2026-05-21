package com.openiv.backend.auth.model;

import java.time.OffsetDateTime;

public record AccessRequest(
    long id,
    String institutionName,
    AccountType institutionType,
    String contactName,
    String contactEmail,
    String contactPhone,
    String jobTitle,
    String description,
    String status,
    String reviewNotes,
    OffsetDateTime reviewedAt,
    Long reviewedByUserId,
    OffsetDateTime createdAt
) {}
