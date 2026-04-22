package com.openiv.backend.auth.model;

import java.time.OffsetDateTime;

public record Institution(
    long id,
    String name,
    AccountType type,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
  public boolean isActive() {
    return "active".equals(status);
  }
}
