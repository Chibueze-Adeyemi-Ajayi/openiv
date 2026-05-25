package com.openiv.backend.auth.service;

import io.vertx.core.Future;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Dev-only email sender. Logs the code to stdout so developers can complete the onboarding
 * flow locally without a real ESP. Production setups MUST replace this with a SendGrid / SES /
 * Postmark client — never ship this to production.
 */
public final class LogEmailSender implements EmailSender {

  private static final Logger log = LoggerFactory.getLogger(LogEmailSender.class);

  @Override
  public Future<Void> sendVerificationCode(String toEmail, String code) {
    log.warn("[DEV EMAIL] email-verification code for {}: {}", toEmail, code);
    return Future.succeededFuture();
  }

  @Override
  public Future<Void> sendPasswordResetCode(String toEmail, String code) {
    log.warn("[DEV EMAIL] password-reset code for {}: {}", toEmail, code);
    return Future.succeededFuture();
  }

  @Override
  public Future<Void> sendStepUpLockout(String toEmail, String fullName, String timestamp) {
    log.warn("[DEV EMAIL] step-up lockout alert for {} ({}) at {}", fullName, toEmail, timestamp);
    return Future.succeededFuture();
  }

  @Override
  public Future<Void> sendStepUpLockoutAdmin(String toEmail, String adminName,
      String userName, String userEmail, String timestamp) {
    log.warn("[DEV EMAIL] step-up lockout admin alert to {} for user {} ({}) at {}",
        adminName, userName, userEmail, timestamp);
    return Future.succeededFuture();
  }

  @Override
  public Future<Void> sendCaseNotification(String toEmail, String caseId, String caseTitle,
      String priority, String brief) {
    log.warn("[DEV EMAIL] case-notification to {}: {} [{}] {} - {}",
        toEmail, caseId, priority, caseTitle, brief);
    return Future.succeededFuture();
  }

  @Override
  public Future<Void> sendDailyRiskReport(String toEmail, String recipientName, String htmlBody) {
    log.warn("[DEV EMAIL] daily-risk-report to {} ({}): {} chars", recipientName, toEmail, htmlBody.length());
    return Future.succeededFuture();
  }

  @Override
  public Future<Void> sendWaitlistNotification(String adminEmail, String userName, String userEmail, String expectation) {
    log.warn("[DEV EMAIL] waitlist-notification to admin {}: New user {} ({}) Expectation: {}", adminEmail, userName, userEmail, expectation);
    return Future.succeededFuture();
  }

  @Override
  public Future<Void> sendInstitutionInvite(String toEmail, String contactName,
      String institutionName, String inviteCode, String invitePageUrl) {
    log.warn("[DEV EMAIL] institution-invite to {} ({}): institution={} code={} url={}",
        contactName, toEmail, institutionName, inviteCode, invitePageUrl);
    return Future.succeededFuture();
  }

  @Override
  public Future<Void> sendTeamInvite(String toEmail, String recipientName,
      String institutionName, String tempPassword, String loginUrl) {
    log.warn("[DEV EMAIL] team-invite to {} ({}): institution={} tempPassword={} url={}",
        recipientName, toEmail, institutionName, tempPassword, loginUrl);
    return Future.succeededFuture();
  }

  @Override
  public Future<Void> sendWelcome(String toEmail, String recipientName, String institutionName) {
    log.warn("[DEV EMAIL] welcome to {} ({}): institution={}", recipientName, toEmail, institutionName);
    return Future.succeededFuture();
  }

  @Override
  public Future<Void> sendSubscriptionInvoice(String toEmail, String institutionName, String planName,
      String invoiceType, java.math.BigDecimal amountNgn, java.math.BigDecimal discountPct,
      String couponCode, String paymentUrl, int daysUntilRenewal) {
    log.warn("[DEV EMAIL] subscription-invoice to {}: institution={} plan={} type={} amount=₦{} discount={}% coupon={} url={} daysUntil={}",
        toEmail, institutionName, planName, invoiceType, amountNgn, discountPct, couponCode, paymentUrl, daysUntilRenewal);
    return Future.succeededFuture();
  }

  @Override
  public Future<Void> sendSubscriptionExpired(String toEmail, String institutionName, String planName) {
    log.warn("[DEV EMAIL] subscription-expiry-warning to {}: institution={} plan={}", toEmail, institutionName, planName);
    return Future.succeededFuture();
  }
}
