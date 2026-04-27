package com.openiv.backend.dashboard;

public record RiskPoint(double lat, double lng, int count, Double avgRisk, boolean hasFlag) {}
