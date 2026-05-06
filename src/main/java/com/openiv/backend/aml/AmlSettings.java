package com.openiv.backend.aml;

import java.util.List;

public record AmlSettings(
    long id,
    long institutionId,
    boolean autoOpenCase,
    List<String> caseNotificationEmails,
    int riskScoreFlagThreshold,
    int riskScoreCaseThreshold,
    int behRiskScoreFlagThreshold,
    int behRiskScoreCaseThreshold,
    int riskScoreNormalThreshold,
    int behRiskScoreNormalThreshold
) {}
