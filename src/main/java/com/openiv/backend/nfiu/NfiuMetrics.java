package com.openiv.backend.nfiu;

public record NfiuMetrics(
    int totalFiled,
    int totalDraft,
    int totalAcknowledged,
    int totalRejected,
    int dueThisWeek,
    int filedThisMonth
) {}
