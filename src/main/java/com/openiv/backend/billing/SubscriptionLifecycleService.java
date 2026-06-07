package com.openiv.backend.billing;

import com.openiv.backend.auth.repository.UserRepository;
import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

public final class SubscriptionLifecycleService {

  private static final Logger log = LoggerFactory.getLogger(SubscriptionLifecycleService.class);

  private final SubscriptionRepository subscriptions;
  private final InvoiceRepository invoices;
  private final PaystackClient paystack;
  @SuppressWarnings("unused")
  private final UserRepository users;

  public SubscriptionLifecycleService(
      SubscriptionRepository subscriptions,
      InvoiceRepository invoices,
      PaystackClient paystack,
      UserRepository users) {
    this.subscriptions = subscriptions;
    this.invoices = invoices;
    this.paystack = paystack;
    this.users = users;
  }

  /** Result of initiating a payment. */
  public record InitiateResult(
      UUID invoiceId,
      String reference,
      String accessCode, // null in dev mode — triggers inline popup when present
      String authorizationUrl,
      BigDecimal amountNgn,
      BigDecimal discountedAmountNgn,
      BigDecimal discountPercent,
      String invoiceType) {
  }

  /**
   * Initiate an upgrade, downgrade, or renewal payment.
   *
   * @param institutionId the institution requesting the change
   * @param targetPlanId  the plan they want to switch to
   * @param userEmail     email used for Paystack transaction
   * @param couponCode    optional coupon from a previous reminder invoice
   */
  public Future<InitiateResult> initiate(
      long institutionId, String targetPlanId, String userEmail, String couponCode) {

    log.info("[billing] initiate payment — institution={} targetPlan={} paystackConfigured={}",
        institutionId, targetPlanId, paystack.isConfigured());

    return subscriptions.getByInstitution(institutionId)
        .compose(subOpt -> {
          if (subOpt.isEmpty()) {
            return Future.failedFuture("Subscription not found for institution");
          }
          InstitutionSubscription current = subOpt.get();

          return subscriptions.listPlans()
              .compose(allPlans -> {
                SubscriptionPlan targetPlan = allPlans.stream()
                    .filter(p -> p.id().equals(targetPlanId))
                    .findFirst()
                    .orElse(null);
                if (targetPlan == null) {
                  return Future.failedFuture("Plan not found: " + targetPlanId);
                }

                // Determine invoice type
                String invoiceType = determineType(current.plan(), targetPlan);
                log.info("[billing] invoiceType={} currentPlan={} targetPlan={}", invoiceType, current.plan().id(),
                    targetPlan.id());

                // Validate downgrade window
                if ("downgrade".equals(invoiceType)) {
                  validateDowngradeWindow(current);
                }

                // Calculate amount
                BigDecimal amount = calculateAmount(current, targetPlan, invoiceType);
                BigDecimal discountPct = BigDecimal.ZERO;
                BigDecimal discounted = amount;

                // Apply coupon discount for renewals if coupon provided and matches active
                // invoice
                if ("renewal".equals(invoiceType) && couponCode != null && !couponCode.isBlank()) {
                  // We'll fetch the active invoice to get the discount percent
                  return invoices.findActiveForInstitution(institutionId)
                      .compose(activeInvoiceOpt -> {
                        BigDecimal dPct = BigDecimal.ZERO;
                        if (activeInvoiceOpt.isPresent()) {
                          SubscriptionInvoice existing = activeInvoiceOpt.get();
                          if (couponCode.equals(existing.couponCode())
                              && (existing.couponExpiresAt() == null
                                  || existing.couponExpiresAt().isAfter(OffsetDateTime.now()))) {
                            dPct = existing.discountPercent();
                          }
                        }
                        BigDecimal finalDiscount = dPct;
                        BigDecimal finalDiscounted = applyDiscount(amount, dPct);
                        return createAndInitialize(institutionId, targetPlan, invoiceType,
                            amount, finalDiscount, finalDiscounted, userEmail);
                      });
                }

                return createAndInitialize(institutionId, targetPlan, invoiceType,
                    amount, discountPct, discounted, userEmail);
              });
        });
  }

  private Future<InitiateResult> createAndInitialize(
      long institutionId, SubscriptionPlan targetPlan, String invoiceType,
      BigDecimal amount, BigDecimal discountPct, BigDecimal discounted,
      String userEmail) {

    log.info("[billing] createAndInitialize — institution={} plan={} type={} amount={} discounted={}",
        institutionId, targetPlan.id(), invoiceType, amount, discounted);

    // Cancel existing pending invoices first
    return invoices.cancelPendingForInstitution(institutionId)
        .compose(v -> invoices.createInvoice(
            institutionId, targetPlan.id(), invoiceType,
            amount, discountPct, discounted,
            null, null))
        .compose(invoice -> {
          long amountKobo = discounted.multiply(BigDecimal.valueOf(100)).longValue();
          log.info("[billing] invoice created id={} amountKobo={} — calling Paystack initialize", invoice.id(),
              amountKobo);
          JsonObject metadata = new JsonObject()
              .put("institutionId", institutionId)
              .put("invoiceId", invoice.id().toString())
              .put("planId", targetPlan.id())
              .put("type", invoiceType);

          return paystack.initializeTransaction(userEmail, amountKobo, metadata)
              .compose(paystackData -> {
                String reference = paystackData.getString("reference");
                String accessCode = paystackData.getString("access_code");
                String authorizationUrl = paystackData.getString("authorization_url");
                log.info("[billing] Paystack initialized — reference={} accessCode={}", reference,
                    accessCode != null ? "present" : "null");
                // Store the reference on the invoice
                return invoices.updateReference(invoice.id(), reference)
                    .map(v2 -> new InitiateResult(
                        invoice.id(),
                        reference,
                        accessCode,
                        authorizationUrl,
                        amount,
                        discounted,
                        discountPct,
                        invoiceType));
              });
        });
  }

  /**
   * Verify Paystack payment and apply the plan change.
   *
   * @return the plan ID that was activated
   */
  public Future<String> verifyAndApply(long institutionId, String reference) {
    log.info("[billing] verifyAndApply — institution={} reference={}", institutionId, reference);
    return paystack.verifyTransaction(reference)
        .compose(data -> {
          log.info("[billing] Paystack verify OK — reference={} paidKobo={}", reference, data.getLong("amount"));
          return invoices.findByReference(reference)
              .compose(invoiceOpt -> {
                if (invoiceOpt.isEmpty()) {
                  log.warn("[billing] invoice not found for reference={}", reference);
                  return Future.failedFuture("Invoice not found for reference: " + reference);
                }
                SubscriptionInvoice invoice = invoiceOpt.get();
                log.info("[billing] invoice found id={} status={} institutionId={} planId={}",
                    invoice.id(), invoice.status(), invoice.institutionId(), invoice.planId());

                // Guard: invoice must be pending (not already paid or cancelled)
                if (!"pending".equals(invoice.status())) {
                  log.warn("[billing] invoice already {} — reference={}", invoice.status(), reference);
                  return Future.failedFuture("Invoice already " + invoice.status());
                }

                // Guard: invoice must belong to this institution (prevents cross-tenant replay)
                if (invoice.institutionId() != institutionId) {
                  log.warn("[billing] institution mismatch — invoice.institutionId={} caller={}",
                      invoice.institutionId(), institutionId);
                  return Future.failedFuture("Invoice does not belong to this institution");
                }

                // Guard: verify amount paid matches invoiced discounted amount (in kobo)
                // dev-mode transactions have amount=0; skip the check for those
                long paidKobo = data.getLong("amount") != null ? data.getLong("amount") : 0L;
                long expectedKobo = invoice.discountedAmountNgn()
                    .multiply(BigDecimal.valueOf(100)).longValue();
                log.info("[billing] amount check — paidKobo={} expectedKobo={}", paidKobo, expectedKobo);
                if (paidKobo > 0 && paidKobo < expectedKobo) {
                  return Future.failedFuture(
                      "Underpayment: paid ₦" + (paidKobo / 100) + " but expected ₦" + (expectedKobo / 100));
                }

                boolean isRenewal = "renewal".equals(invoice.invoiceType());
                String planId = invoice.planId();
                log.info("[billing] applying payment — institution={} planId={} isRenewal={}", institutionId, planId,
                    isRenewal);
                return invoices.markPaid(invoice.id(), reference)
                    .<String>compose(v -> subscriptions.applyPayment(institutionId, planId, isRenewal)
                        .map(v2 -> {
                          log.info("[billing] plan activated — institution={} planId={}", institutionId, planId);
                          return planId;
                        }));
              });
        })
        .onFailure(err -> log.error("[billing] verifyAndApply failed — institution={} reference={} error={}",
            institutionId, reference, err.getMessage()));
  }

  /**
   * Apply a payment that arrived via Paystack webhook (charge.success).
   * Skips the outbound Paystack re-verify because the webhook payload was already
   * validated by HMAC-SHA512 in the handler. Idempotent — silently ignores
   * unknown
   * or already-processed references.
   */
  public Future<Object> applyWebhookPayment(String reference) {
    log.info("[billing] applyWebhookPayment — reference={}", reference);
    return invoices.findByReference(reference)
        .compose(invoiceOpt -> {
          if (invoiceOpt.isEmpty()) {
            log.info("[billing] webhook: no invoice found for reference={} — ignoring", reference);
            return Future.succeededFuture();
          }
          SubscriptionInvoice invoice = invoiceOpt.get();
          if (!"pending".equals(invoice.status())) {
            log.info("[billing] webhook: invoice already {} for reference={} — ignoring", invoice.status(), reference);
            return Future.succeededFuture();
          }
          boolean isRenewal = "renewal".equals(invoice.invoiceType());
          log.info("[billing] webhook: applying payment — institution={} planId={} isRenewal={}",
              invoice.institutionId(), invoice.planId(), isRenewal);
          return invoices.markPaid(invoice.id(), reference)
              .compose(v -> subscriptions.applyPayment(
                  invoice.institutionId(), invoice.planId(), isRenewal)
                  .onSuccess(ignored -> log.info("[billing] webhook: plan activated — institution={} planId={}",
                      invoice.institutionId(), invoice.planId())))
              .mapEmpty();
        })
        .onFailure(err -> log.error("[billing] applyWebhookPayment failed — reference={} error={}", reference,
            err.getMessage()));
  }

  // ── Calculation helpers ──────────────────────────────────────────────────────

  /** Package-private for testing. */
  String determineType(SubscriptionPlan current, SubscriptionPlan target) {
    if (current.id().equals(target.id()))
      return "renewal";
    return target.sortOrder() > current.sortOrder() ? "upgrade" : "downgrade";
  }

  /** Package-private for testing. */
  void validateDowngradeWindow(InstitutionSubscription current) {
    OffsetDateTime renewsAt = current.renewsAt();
    if (renewsAt == null) {
      throw new IllegalStateException("No renewal date set; downgrade not allowed");
    }
    long daysDiff = Math.abs(ChronoUnit.DAYS.between(OffsetDateTime.now(), renewsAt));
    if (daysDiff > 3) {
      throw new IllegalStateException(
          "Downgrade is only available within 3 days of your plan renewal date.");
    }
  }

  BigDecimal calculateAmount(InstitutionSubscription current, SubscriptionPlan newPlan, String type) {
    if ("renewal".equals(type)) {
      return newPlan.monthlyPriceNgn();
    }
    if ("downgrade".equals(type)) {
      return newPlan.monthlyPriceNgn();
    }
    // Upgrade
    return calculateUpgradeAmount(current, newPlan);
  }

  BigDecimal calculateUpgradeAmount(InstitutionSubscription current, SubscriptionPlan newPlan) {
    OffsetDateTime startsAt = current.startsAt();
    long daysSinceStart = startsAt != null
        ? Math.max(0, ChronoUnit.DAYS.between(startsAt, OffsetDateTime.now()))
        : 99;

    if (daysSinceStart <= 7) {
      // Charge difference only
      BigDecimal diff = newPlan.monthlyPriceNgn().subtract(current.plan().monthlyPriceNgn());
      return diff.compareTo(BigDecimal.ZERO) > 0 ? diff : BigDecimal.ZERO;
    } else {
      // Full price
      return newPlan.monthlyPriceNgn();
    }
  }

  /** Package-private for testing. */
  static BigDecimal applyDiscount(BigDecimal amount, BigDecimal discountPct) {
    if (discountPct == null || discountPct.compareTo(BigDecimal.ZERO) == 0)
      return amount;
    BigDecimal factor = BigDecimal.ONE.subtract(discountPct.divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP));
    return amount.multiply(factor).setScale(2, RoundingMode.HALF_UP);
  }
}
