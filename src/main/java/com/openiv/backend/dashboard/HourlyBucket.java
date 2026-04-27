package com.openiv.backend.dashboard;

public record HourlyBucket(int hour, int total, int flagged, int blocked) {}
