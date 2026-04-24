package com.openiv.backend.cases;

public record CaseMetrics(
    long openCount,
    long escalatedCount,
    long closedToday,
    double avgCloseHours
) {}
