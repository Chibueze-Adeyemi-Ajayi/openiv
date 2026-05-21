package com.openiv.backend.documents;

import java.time.OffsetDateTime;

/** A row in the {@code documents} table — Cloudinary-backed file metadata. */
public record Document(
    long   id,
    long   institutionId,
    Long   uploadedBy,
    String cloudinaryPublicId,
    String url,
    String filename,
    String contentType,
    Long   sizeBytes,
    String resourceType,
    String format,
    Integer width,
    Integer height,
    String entityType,
    String entityId,
    OffsetDateTime createdAt
) {}
