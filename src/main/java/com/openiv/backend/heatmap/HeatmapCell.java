package com.openiv.backend.heatmap;

import java.time.LocalDate;

public record HeatmapCell(LocalDate date, int count, Double avgRisk) {}
