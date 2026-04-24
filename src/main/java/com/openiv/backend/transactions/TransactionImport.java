package com.openiv.backend.transactions;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record TransactionImport(
    String id, String customerId, String customerName,
    BigDecimal amount, String channel, String counterparty,
    int riskScore, String status, String flaggedStatus, String location,
    Double lat, Double lng, OffsetDateTime occurredAt,
    String senderAccount, String senderBank,
    String recipientName, String recipientAccount, String recipientBank,
    String currency, String narration, String deviceId, String ipAddress
) {}
