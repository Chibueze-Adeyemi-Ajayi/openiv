package com.openiv.backend.dashboard;

public record DashboardStats(
    int totalToday,
    int flaggedToday,
    int totalYesterday,
    int flaggedYesterday,
    int openCases,
    int openCasesToday
) {}
