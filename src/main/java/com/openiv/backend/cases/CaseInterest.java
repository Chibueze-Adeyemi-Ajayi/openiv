package com.openiv.backend.cases;

import java.time.OffsetDateTime;

public record CaseInterest(
    long id,
    String caseId,
    long institutionId,
    long userId,
    String userName,
    String status,
    OffsetDateTime createdAt
) {}
