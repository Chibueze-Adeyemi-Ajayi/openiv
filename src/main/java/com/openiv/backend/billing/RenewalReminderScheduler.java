package com.openiv.backend.billing;

import com.openiv.backend.auth.service.EmailSender;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class RenewalReminderScheduler {

  private static final Logger log = LoggerFactory.getLogger(RenewalReminderScheduler.class);

  private final Vertx                  vertx;
  private final InvoiceRepository      invoices;
  private final SubscriptionRepository subscriptions;
  private final EmailSender            emailSender;
  private final PaystackClient         paystack;
  private final String                 appBaseUrl;

  public RenewalReminderScheduler(
      Vertx vertx,
      InvoiceRepository invoices,
      SubscriptionRepository subscriptions,
      EmailSender emailSender,
      PaystackClient paystack,
      String appBaseUrl) {
    this.vertx         = vertx;
    this.invoices      = invoices;
    this.subscriptions = subscriptions;
    this.emailSender   = emailSender;
    this.paystack      = paystack;
    this.appBaseUrl    = appBaseUrl;
  }

  public void start() {
    run();
    vertx.setPeriodic(3_600_000L, id -> run());
  }

  private void run() {
    expireStaleInvoices();
    blockExpiredAccounts();
    sendReminders(7, "7d", 5.0);
    sendReminders(3, "3d", 2.5);
    send24hWarnings();
  }

  private void expireStaleInvoices() {
    invoices.expireStaleInvoices()
        .onSuccess(n -> { if (n > 0) log.info("[Scheduler] Expired {} stale invoice(s)", n); })
        .onFailure(err -> log.error("[Scheduler] Failed to expire stale invoices", err));
  }

  private void blockExpiredAccounts() {
    subscriptions.findExpiredUnpaidInstitutions()
        .onSuccess(ids -> ids.forEach(id ->
            invoices.hasPaidRenewalSince(id, OffsetDateTime.now().minusDays(35))
                .onSuccess(hasPaid -> {
                  if (!hasPaid) {
                    subscriptions.blockInstitution(id)
                        .onSuccess(v -> log.warn("[Scheduler] Blocked institution {} (past_due)", id))
                        .onFailure(err -> log.error("[Scheduler] Failed to block institution {}", id, err));
                  }
                })
                .onFailure(err -> log.error("[Scheduler] Error checking paid renewal for {}", id, err))
        ))
        .onFailure(err -> log.error("[Scheduler] Failed to find expired institutions", err));
  }

  private void sendReminders(int daysAhead, String reminderType, double discountPctDouble) {
    BigDecimal discountPct = BigDecimal.valueOf(discountPctDouble);

    invoices.findInstitutionsForReminder(daysAhead)
        .onSuccess(institutionIds -> institutionIds.forEach(institutionId ->
            processReminder(institutionId, reminderType, discountPct)
        ))
        .onFailure(err -> log.error("[Scheduler] Failed to find institutions for {} reminder", reminderType, err));
  }

  private void processReminder(long institutionId, String reminderType, BigDecimal discountPct) {
    subscriptions.getByInstitution(institutionId)
        .onSuccess(subOpt -> {
          if (subOpt.isEmpty()) return;
          InstitutionSubscription sub = subOpt.get();
          if (sub.renewsAt() == null) return;

          LocalDate renewalDate = sub.renewsAt().toLocalDate();

          invoices.hasReminderBeenSent(institutionId, reminderType, renewalDate)
              .onSuccess(alreadySent -> {
                if (alreadySent) return;

                BigDecimal planPrice = sub.plan().monthlyPriceNgn();
                BigDecimal discounted = applyDiscount(planPrice, discountPct);
                String couponCode = "RENEW-" + reminderType.toUpperCase() + "-" + institutionId + "-" + renewalDate;
                OffsetDateTime couponExpires = OffsetDateTime.now().plusDays(3);

                invoices.cancelPendingForInstitution(institutionId)
                    .compose(v -> invoices.createInvoice(
                        institutionId, sub.plan().id(), "renewal",
                        planPrice, discountPct, discounted,
                        couponCode, couponExpires))
                    .onSuccess(invoice -> {
                      String paymentUrl = appBaseUrl + "/dashboard/subscription?coupon=" + couponCode;
                      int daysUntil = (int) java.time.temporal.ChronoUnit.DAYS.between(
                          LocalDate.now(), renewalDate);

                      subscriptions.getAdminEmails(institutionId)
                          .onSuccess(emails -> {
                            subscriptions.getInstitutionName(institutionId)
                                .onSuccess(institutionName -> {
                                  emails.forEach(email ->
                                      emailSender.sendSubscriptionInvoice(
                                          email, institutionName, sub.plan().name(),
                                          "renewal", planPrice, discountPct,
                                          couponCode, paymentUrl, daysUntil)
                                          .onFailure(err -> log.error(
                                              "[Scheduler] Failed to send {} reminder email to {}",
                                              reminderType, email, err))
                                  );
                                  invoices.logReminder(institutionId, reminderType, renewalDate, invoice.id())
                                      .onFailure(err -> log.error("[Scheduler] Failed to log reminder", err));
                                  log.info("[Scheduler] Sent {} reminder to institution {} ({} emails)",
                                      reminderType, institutionId, emails.size());
                                })
                                .onFailure(err -> log.error("[Scheduler] Failed to get institution name for {}", institutionId, err));
                          })
                          .onFailure(err -> log.error("[Scheduler] Failed to get admin emails for {}", institutionId, err));
                    })
                    .onFailure(err -> log.error("[Scheduler] Failed to create reminder invoice for {}", institutionId, err));
              })
              .onFailure(err -> log.error("[Scheduler] Failed to check reminder sent for {}", institutionId, err));
        })
        .onFailure(err -> log.error("[Scheduler] Failed to get subscription for {}", institutionId, err));
  }

  private void send24hWarnings() {
    invoices.findInstitutionsForReminder(1)
        .onSuccess(institutionIds -> institutionIds.forEach(institutionId ->
            subscriptions.getByInstitution(institutionId)
                .onSuccess(subOpt -> {
                  if (subOpt.isEmpty()) return;
                  InstitutionSubscription sub = subOpt.get();
                  if (sub.renewsAt() == null) return;

                  LocalDate renewalDate = sub.renewsAt().toLocalDate();

                  invoices.hasReminderBeenSent(institutionId, "24h", renewalDate)
                      .onSuccess(alreadySent -> {
                        if (alreadySent) return;
                        subscriptions.getAdminEmails(institutionId)
                            .onSuccess(emails -> {
                              subscriptions.getInstitutionName(institutionId)
                                  .onSuccess(institutionName -> {
                                    emails.forEach(email ->
                                        emailSender.sendSubscriptionExpired(
                                            email, institutionName, sub.plan().name())
                                            .onFailure(err -> log.error(
                                                "[Scheduler] Failed to send 24h warning to {}", email, err))
                                    );
                                    invoices.logReminder(institutionId, "24h", renewalDate, null)
                                        .onFailure(err -> log.error("[Scheduler] Failed to log 24h reminder", err));
                                    log.info("[Scheduler] Sent 24h warning to institution {} ({} emails)",
                                        institutionId, emails.size());
                                  })
                                  .onFailure(err -> log.error("[Scheduler] Failed to get name for {}", institutionId, err));
                            })
                            .onFailure(err -> log.error("[Scheduler] Failed to get emails for {}", institutionId, err));
                      })
                      .onFailure(err -> log.error("[Scheduler] Failed to check 24h reminder for {}", institutionId, err));
                })
                .onFailure(err -> log.error("[Scheduler] Failed to get sub for {}", institutionId, err))
        ))
        .onFailure(err -> log.error("[Scheduler] Failed to find institutions for 24h warning", err));
  }

  private static BigDecimal applyDiscount(BigDecimal amount, BigDecimal discountPct) {
    if (discountPct == null || discountPct.compareTo(BigDecimal.ZERO) == 0) return amount;
    BigDecimal factor = BigDecimal.ONE.subtract(
        discountPct.divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP));
    return amount.multiply(factor).setScale(2, RoundingMode.HALF_UP);
  }
}
