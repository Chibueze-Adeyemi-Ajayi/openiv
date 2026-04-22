package com.openiv.backend.auth.model;

import java.time.OffsetDateTime;

public record Invitation(
    long id,
    String codeHash,
    String email,
    String role,
    AccountType accountType,
    long institutionId,
    String status,
    OffsetDateTime expiresAt,
    OffsetDateTime acceptedAt,
    Long acceptedByUserId,
    OffsetDateTime createdAt
) {
  public boolean isUsable() {
    return "pending".equals(status)
        && expiresAt.isAfter(OffsetDateTime.now())
        && acceptedAt == null;
  }
}
