package com.openiv.backend.kyc;

import java.time.OffsetDateTime;

public record KycPipelineResult(
    long           id,
    long           institutionId,
    String         customerId,
    OffsetDateTime runAt,
    int            overallRiskScore,
    int            kycTier,
    String         overallStatus,
    String         actionTaken,
    String         bvnNinStatus,  int bvnNinScore,  String bvnNinDetail,
    String         phoneStatus,   int phoneScore,   String phoneDetail,
    String         livenessStatus,int livenessScore, String livenessDetail,
    String         pepStatus,     int pepScore,     String pepDetail,
    long           durationMs,
    String         identityPhoto,
    String         firstName,
    String         lastName,
    String         phone,
    String         dateOfBirth,
    Long           monthlyInflow,
    Long           monthlyOutflow
) {}
