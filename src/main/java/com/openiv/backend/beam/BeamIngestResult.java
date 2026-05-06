package com.openiv.backend.beam;

import com.openiv.backend.transactions.TransactionProcessingOrchestrator.ProcessingResult;

public record BeamIngestResult(
    BeamRecord record,
    ProcessingResult analysisResult
) {}
