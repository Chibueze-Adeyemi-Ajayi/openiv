package com.openiv.backend.cases;

import java.time.OffsetDateTime;

public record CaseActivity(
    long id,
    String caseId,
    long actorId,
    String actorName,
    String actorRole,
    String action,
    String detail,
    OffsetDateTime createdAt
) {}
