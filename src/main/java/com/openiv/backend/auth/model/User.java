package com.openiv.backend.auth.model;

import java.time.OffsetDateTime;

public record User(
    long id,
    String email,
    String fullName,
    boolean emailVerified,
    String passwordHash,
    OffsetDateTime passwordUpdatedAt,
    boolean mustChangePassword,
    String status,
    String role,
    AccountType accountType,
    long institutionId,
    int failedLoginAttempts,
    OffsetDateTime lockedUntil,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    boolean eurekaCompanionEnabled,
    String timezone
) {
  public boolean isLocked() {
    return lockedUntil != null && lockedUntil.isAfter(OffsetDateTime.now());
  }

  /** Returns the display name (full_name), falling back to the local-part of the email. */
  public String displayName() {
    if (fullName != null && !fullName.isBlank()) return fullName;
    int at = email.indexOf('@');
    return at > 0 ? email.substring(0, at) : email;
  }
}
