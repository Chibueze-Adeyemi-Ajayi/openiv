package com.openiv.backend.billing;

import java.time.OffsetDateTime;

public record InstitutionSubscription(
    SubscriptionPlan plan,
    String           status,          // trial | active | past_due | cancelled
    OffsetDateTime   startsAt,
    OffsetDateTime   trialEndsAt,
    OffsetDateTime   renewsAt
) {}
