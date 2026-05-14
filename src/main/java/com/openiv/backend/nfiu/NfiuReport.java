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
    // Subject
    String subjectName,
    String subjectAccount,
    String subjectBvn,
    String subjectType,
    LocalDate subjectDob,
    String subjectAddress,
    // Transaction
    Double amountNgn,
    int transactionCount,
    String transactionType,
    LocalDate transactionDate,
    // Transaction detail (sourced from linked transaction)
    String linkedTransactionId,
    String transactionLocation,
    Double transactionLat,
    Double transactionLng,
    String transactionSenderAccount,
    String transactionSenderBank,
    String transactionRecipientName,
    String transactionRecipientAccount,
    String transactionRecipientBank,
    String transactionCurrency,
    String transactionNarration,
    // Narrative
    String narrative,
    // Officer / filing
    Long officerUserId,
    String officerName,
    Long filedByUserId,
    String filedByName,
    String acknowledgementRef,
    String rejectionReason,
    OffsetDateTime createdAt,
    // Pending approval tracking
    Long submittedByUserId,
    String submittedByName,
    OffsetDateTime submittedAt
) {}
