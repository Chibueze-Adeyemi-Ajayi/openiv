package com.openiv.backend.documents;

import java.time.OffsetDateTime;

public record DocumentRecord(
    long   id,
    long   institutionId,
    long   uploadedBy,
    String filename,
    String contentType,
    int    sizeBytes,
    byte[] data,           // null for new Cloudinary-backed uploads
    OffsetDateTime createdAt,
    String documentUrl     // Cloudinary URL; present when data is null
) {}
