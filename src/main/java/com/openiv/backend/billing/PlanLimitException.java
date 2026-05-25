package com.openiv.backend.billing;

/**
 * Thrown when an institution's subscription plan does not permit a feature or
 * when a metered resource cap has been reached. Maps to HTTP 402.
 */
public final class PlanLimitException extends RuntimeException {

  private final String feature;
  private final String currentPlan;
  private final String requiredPlan;

  public PlanLimitException(String feature, String currentPlan, String requiredPlan) {
    super("Plan limit reached: feature=" + feature
        + " currentPlan=" + currentPlan
        + " requiredPlan=" + requiredPlan);
    this.feature     = feature;
    this.currentPlan = currentPlan;
    this.requiredPlan = requiredPlan;
  }

  public String feature()      { return feature; }
  public String currentPlan()  { return currentPlan; }
  public String requiredPlan() { return requiredPlan; }
}
