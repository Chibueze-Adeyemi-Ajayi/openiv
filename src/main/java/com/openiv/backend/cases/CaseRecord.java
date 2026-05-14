package com.openiv.backend.cases;

import java.time.OffsetDateTime;

public record CaseRecord(
    String id,
    long institutionId,
    String title,
    String brief,
    String typology,
    String status,
    String priority,
    int riskScore,
    Long assignedTo,
    String assigneeName,
    String notes,
    String resolution,
    Long createdBy,
    String createdByName,
    OffsetDateTime slaDeadline,
    OffsetDateTime closedAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    boolean isAvailableForInvestigation,
    boolean seen,
    Long linkedNfiuReportId,
    String customerId,
    String customerName
) {}
