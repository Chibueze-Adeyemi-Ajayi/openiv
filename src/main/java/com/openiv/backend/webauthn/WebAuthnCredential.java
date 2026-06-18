package com.openiv.backend.webauthn;

import java.time.OffsetDateTime;

public record WebAuthnCredential(
    long id,
    long userId,
    byte[] credentialId,
    byte[] publicKeyDer,
    long signCount,
    String aaguid,
    OffsetDateTime createdAt,
    OffsetDateTime lastUsedAt
) {}
