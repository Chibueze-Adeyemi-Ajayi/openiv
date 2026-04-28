package com.openiv.backend.nfiu;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record NfiuSchedule(
    long id,
    long institutionId,
    String reportType,
    String name,
    String frequency,
    LocalDate nextDue,
    OffsetDateTime lastFiledAt,
    boolean isActive,
    boolean autoFile,
    Long createdBy,
    OffsetDateTime createdAt
) {}
