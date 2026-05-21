package com.openiv.backend.kyc;

import java.time.OffsetDateTime;

public record KycPipelineResult(
    long           id,
    long           institutionId,
    String         customerId,
    OffsetDateTime runAt,
    int            overallRiskScore,
    /** System-assessed knowledge level: "t1" (basic), "t2" (intermediate), "t3" (full KYC). */
    String         knowledgeLevel,
    /** Institution-provided KYC tier sent in the beam payload (1/2/3), or null if not supplied. */
    Integer        institutionKycTier,
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
