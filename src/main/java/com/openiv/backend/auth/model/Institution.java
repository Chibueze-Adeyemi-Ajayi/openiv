package com.openiv.backend.auth.model;

import java.time.OffsetDateTime;

public record Institution(
    long id,
    String name,
    AccountType type,
    String status,
    String cbnCode,
    String address,
    String contactPhone,
    String officialStamp,
    String officialSignature,
    Long stampDocumentId,
    Long signatureDocumentId,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
  public boolean isActive() {
    return "active".equals(status);
  }
}
