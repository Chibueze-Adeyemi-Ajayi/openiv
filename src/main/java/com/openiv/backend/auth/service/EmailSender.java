package com.openiv.backend.auth.service;

import io.vertx.core.Future;

/**
 * Transactional email abstraction. Production implementations wrap a managed ESP (SendGrid,
 * SES, Postmark). The stub implementation {@link LogEmailSender} just logs the message — useful
 * for local dev, never acceptable for production.
 */
public interface EmailSender {

  Future<Void> sendVerificationCode(String toEmail, String code);

  Future<Void> sendPasswordResetCode(String toEmail, String code);

  Future<Void> sendStepUpLockout(String toEmail, String fullName, String timestamp);

  Future<Void> sendStepUpLockoutAdmin(String toEmail, String adminName,
      String userName, String userEmail, String timestamp);

  Future<Void> sendCaseNotification(String toEmail, String caseId, String caseTitle,
      String priority, String brief);

  Future<Void> sendDailyRiskReport(String toEmail, String recipientName, String htmlBody);

  Future<Void> sendWaitlistNotification(String adminEmail, String userName, String userEmail, String expectation);

  Future<Void> sendInstitutionInvite(String toEmail, String contactName,
      String institutionName, String inviteCode, String invitePageUrl);

  /** Sent when a team admin directly invites a colleague — includes their temporary password. */
  Future<Void> sendTeamInvite(String toEmail, String recipientName,
      String institutionName, String tempPassword, String loginUrl);

  /** Sent when a team-invited user completes TOTP setup and their account is fully active. */
  Future<Void> sendWelcome(String toEmail, String recipientName, String institutionName);

  /** Sent with a renewal invoice — includes discount coupon and payment URL. */
  Future<Void> sendSubscriptionInvoice(String toEmail, String institutionName, String planName,
      String invoiceType, java.math.BigDecimal amountNgn, java.math.BigDecimal discountPct,
      String couponCode, String paymentUrl, int daysUntilRenewal);

  /** Sent as a 24h warning that the subscription is about to expire (no new discount). */
  Future<Void> sendSubscriptionExpired(String toEmail, String institutionName, String planName);

  /** Sent to the applicant immediately after a self-service access request is submitted. */
  Future<Void> sendAccessRequestConfirmation(String toEmail, String contactName, String institutionName);
}
