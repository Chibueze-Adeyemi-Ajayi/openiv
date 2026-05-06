package com.openiv.backend.cases;

import java.time.OffsetDateTime;

public record CaseEvidence(
    long           id,
    String         caseId,
    Long           addedBy,
    String         addedByName,
    String         category,
    String         title,
    String         detail,
    String         refId,
    OffsetDateTime createdAt
) {}
