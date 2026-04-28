package com.openiv.backend.geofence;

import java.time.OffsetDateTime;
import java.util.List;

public record GeoFence(
    long id,
    long institutionId,
    boolean enabled,
    List<Point> polygon,
    double calLatOffset,
    double calLngOffset,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
  public record Point(double lat, double lng) {}
}
