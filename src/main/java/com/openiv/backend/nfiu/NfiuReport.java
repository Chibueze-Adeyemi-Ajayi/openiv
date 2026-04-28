package com.openiv.backend.nfiu;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record NfiuReport(
    long id,
    long institutionId,
    String reportType,
    String reference,
    String title,
    LocalDate periodStart,
    LocalDate periodEnd,
    String status,
    String priority,
    OffsetDateTime filingDate,
    String subjectName,
    String subjectAccount,
    String subjectBvn,
    String subjectType,
    Double amountNgn,
    int transactionCount,
    String narrative,
    Long filedByUserId,
    String filedByName,
    String acknowledgementRef,
    String rejectionReason,
    OffsetDateTime createdAt
) {}
