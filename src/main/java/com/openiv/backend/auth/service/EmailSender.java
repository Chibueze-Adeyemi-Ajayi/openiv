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
}
