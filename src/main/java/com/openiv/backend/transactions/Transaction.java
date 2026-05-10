package com.openiv.backend.transactions;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record Transaction(
        String id,
        long institutionId,
        String customerId,
        String customerName,
        BigDecimal amount,
        String channel,
        String counterparty,
        int riskScore,
        String status,
        String flaggedStatus,
        String location,
        Double lat,
        Double lng,
        OffsetDateTime occurredAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        String senderAccount,
        String senderBank,
        String recipientName,
        String recipientAccount,
        String recipientBank,
        String currency,
        String narration,
        String deviceId,
        String ipAddress,
        boolean seen) {
}
