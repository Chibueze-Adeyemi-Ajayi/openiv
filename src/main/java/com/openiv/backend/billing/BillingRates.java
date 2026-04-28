package com.openiv.backend.billing;

public final class BillingRates {
  private BillingRates() {}

  public static final long UNITS_PER_NGN         = 10_000L;
  public static final long RATE_BEAM_INGEST       = 1_000L;          // ₦0.10     per ingest
  public static final long RATE_WEBHOOK           = 1L;              // ₦0.0001   per delivery
  public static final long RATE_KYC_LOOKUP        = 1_000_000L;      // ₦100.00   per lookup
  public static final long RATE_KYC_PEP_LOOKUP   = 25_000_000L;     // ₦2,500.00 per PEP lookup
  public static final long RATE_AI_TOKEN          = 500L;            // ₦0.05     per token
  public static final long RATE_DOCUMENT_UPLOAD   = 50_000L;         // ₦5.00     per upload
  public static final long RATE_TRANSACTION_IMPORT = 100L;           // ₦0.01     per row
  public static final long RATE_CASE_OPEN         = 100_000L;        // ₦10.00    per case
  public static final long RATE_NFIU_RETURN       = 100_000_000L;    // ₦10,000.00 per filing
  public static final long RATE_REPORT_EXPORT     = 50_000L;         // ₦5.00     per export
  public static final long WELCOME_CREDIT         = 5_000_000_000L;  // ₦500,000  one-time
}
