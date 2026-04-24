package com.openiv.backend.auth.model;

import java.time.OffsetDateTime;

public record Session(
    long id,
    long userId,
    String tokenHash,
    SessionState state,
    OffsetDateTime expiresAt,
    OffsetDateTime revokedAt,
    OffsetDateTime lastUsedAt,
    OffsetDateTime createdAt,
    Double lat,
    Double lon,
    Double accuracy
) {
  public boolean isActive() {
    return revokedAt == null && expiresAt.isAfter(OffsetDateTime.now());
  }
}
