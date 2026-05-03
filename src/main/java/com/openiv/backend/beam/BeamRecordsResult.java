package com.openiv.backend.beam;

import java.util.List;

public record BeamRecordsResult(List<BeamRecord> records, long total) {}
