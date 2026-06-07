package com.openiv.backend.billing;

/**
 * Wallet unit conversion + welcome credit amount.
 *
 * Per-feature rates were removed when the corresponding charge*Async
 * stubs were deleted. New per-call rates (e.g. for Dojah-passthrough
 * KYC steps) should be added here when they are wired through to
 * real {@link BillingRepository#debit} calls.
 */
public final class BillingRates {
  private BillingRates() {}

  /** 1 NGN = 10,000 wallet units (4-decimal-place precision). */
  public static final long UNITS_PER_NGN  = 10_000L;

  /** One-time ₦500,000 credit applied at wallet creation (30-day expiry). */
  public static final long WELCOME_CREDIT = 5_000_000_000L;
}
