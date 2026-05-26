package com.openiv.backend.auth.service;

import com.openiv.backend.config.AppConfig;
import io.mailtrap.client.MailtrapClient;
import io.mailtrap.config.MailtrapConfig;
import io.mailtrap.factory.MailtrapClientFactory;
import io.mailtrap.model.request.emails.Address;
import io.mailtrap.model.request.emails.MailtrapMail;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * Production email sender backed by the Mailtrap HTTP API.
 * The SDK call is synchronous so each send runs on a Vert.x worker thread
 * via executeBlocking — the event loop is never blocked.
 */
public final class VertxEmailSender implements EmailSender {

  private static final Logger log = LoggerFactory.getLogger(VertxEmailSender.class);

  private final MailtrapClient client;
  private final String from;
  private final Vertx vertx;

  public VertxEmailSender(Vertx vertx, AppConfig.EmailConfig config) {
    MailtrapConfig mailtrapConfig = new MailtrapConfig.Builder()
        .token(config.apiToken())
        .build();
    this.client = MailtrapClientFactory.createMailtrapClient(mailtrapConfig);
    this.from = config.from();
    this.vertx = vertx;
    log.info("Mailtrap EmailSender initialized: from={}", from);
  }

  @Override
  public Future<Void> sendVerificationCode(String toEmail, String code) {
    return send(toEmail,
        "OpenIV — Verification Code",
        "Your verification code is: " + code,
        EmailTemplates.verification(code));
  }

  @Override
  public Future<Void> sendPasswordResetCode(String toEmail, String code) {
    return send(toEmail,
        "OpenIV — Password Reset",
        "Your password reset code is: " + code,
        EmailTemplates.passwordReset(code));
  }

  @Override
  public Future<Void> sendStepUpLockout(String toEmail, String fullName, String timestamp) {
    return send(toEmail,
        "OpenIV — Suspicious Activity Detected on Your Account",
        "We detected 3 consecutive failed TOTP verification attempts at " + timestamp + " UTC.",
        EmailTemplates.stepUpLockoutUser(fullName, timestamp));
  }

  @Override
  public Future<Void> sendStepUpLockoutAdmin(String toEmail, String adminName,
      String userName, String userEmail, String timestamp) {
    return send(toEmail,
        "OpenIV — Account Security Alert: Step-Up Lockout",
        "User " + userName + " (" + userEmail + ") was locked out after 3 failed TOTP attempts at " + timestamp + " UTC.",
        EmailTemplates.stepUpLockoutAdmin(adminName, userName, userEmail, timestamp));
  }

  @Override
  public Future<Void> sendCaseNotification(String toEmail, String caseId, String caseTitle,
      String priority, String brief) {
    return send(toEmail,
        "OpenIV — Fraud Investigation Case Created: " + caseId,
        "A new fraud investigation case " + caseId + " has been created. Priority: " + priority + ". " + caseTitle,
        EmailTemplates.caseNotification(caseId, caseTitle, priority, brief));
  }

  @Override
  public Future<Void> sendDailyRiskReport(String toEmail, String recipientName, String htmlBody) {
    return send(toEmail,
        "OpenIV — Daily High-Risk Customer Report",
        "Your daily fraud monitoring report is ready. Please log in to the OpenIV dashboard to review high-risk customers.",
        EmailTemplates.dailyRiskReport(recipientName, htmlBody));
  }

  @Override
  public Future<Void> sendWaitlistNotification(String adminEmail, String userName,
      String userEmail, String expectation) {
    return send(adminEmail,
        "OpenIV Waitlist — New Signup from " + userName,
        "New Waitlist Signup\nName: " + userName + "\nEmail: " + userEmail + "\nExpectation: " + expectation,
        EmailTemplates.waitlistNotification(userName, userEmail, expectation));
  }

  @Override
  public Future<Void> sendInstitutionInvite(String toEmail, String contactName,
      String institutionName, String inviteCode, String invitePageUrl) {
    return send(toEmail,
        "You're invited to OpenIV — " + institutionName,
        "Hi " + contactName + ",\n\nYour institution (" + institutionName
            + ") has been approved on OpenIV.\n\nYour invitation code: " + inviteCode
            + "\n\nGo to: " + invitePageUrl,
        EmailTemplates.institutionInvite(contactName, institutionName, inviteCode, invitePageUrl));
  }

  @Override
  public Future<Void> sendTeamInvite(String toEmail, String recipientName,
      String institutionName, String tempPassword, String loginUrl) {
    return send(toEmail,
        "You've Been Invited to OpenIV — " + institutionName,
        "Hi " + recipientName + ",\n\nYou have been invited to join " + institutionName
            + " on OpenIV.\n\nYour temporary password: " + tempPassword
            + "\n\nLog in at: " + loginUrl,
        EmailTemplates.teamInvite(recipientName, institutionName, tempPassword, loginUrl));
  }

  @Override
  public Future<Void> sendWelcome(String toEmail, String recipientName, String institutionName) {
    return send(toEmail,
        "Welcome to OpenIV — Your Account Is Ready",
        "Hi " + recipientName + ",\n\nYour OpenIV account at " + institutionName
            + " is now fully set up. Welcome aboard!",
        EmailTemplates.welcome(recipientName, institutionName));
  }

  @Override
  public Future<Void> sendSubscriptionInvoice(String toEmail, String institutionName, String planName,
      String invoiceType, java.math.BigDecimal amountNgn, java.math.BigDecimal discountPct,
      String couponCode, String paymentUrl, int daysUntilRenewal) {
    String subject = "OpenIV — Subscription Renewal Reminder for " + institutionName;
    String text = "Your " + planName + " plan renews in " + daysUntilRenewal + " day(s).\n"
        + "Amount: ₦" + amountNgn + " (" + discountPct + "% discount applied)\n"
        + "Coupon: " + couponCode + "\n"
        + "Pay now: " + paymentUrl;
    String html = "<p>Your <strong>" + planName + "</strong> plan renews in "
        + "<strong>" + daysUntilRenewal + " day(s)</strong>.</p>"
        + "<p>Amount: <strong>₦" + amountNgn + "</strong> (" + discountPct + "% early-renewal discount)</p>"
        + "<p>Coupon code: <strong>" + couponCode + "</strong></p>"
        + "<p><a href=\"" + paymentUrl + "\">Pay now to keep your account active</a></p>"
        + "<p style='color:#6b7280;font-size:12px;'>Offer expires in 3 days.</p>";
    return send(toEmail, subject, text, html);
  }

  @Override
  public Future<Void> sendSubscriptionExpired(String toEmail, String institutionName, String planName) {
    String subject = "OpenIV — Your Subscription Expires in 24 Hours";
    String text = "Your " + planName + " plan for " + institutionName
        + " expires in less than 24 hours.\n"
        + "Please renew from your dashboard to avoid service interruption.";
    String html = "<p>Your <strong>" + planName + "</strong> plan for <strong>" + institutionName
        + "</strong> expires in less than <strong>24 hours</strong>.</p>"
        + "<p>Please <a href='https://app.openiv.ng/dashboard/subscription'>renew from your dashboard</a>"
        + " to avoid service interruption.</p>";
    return send(toEmail, subject, text, html);
  }

  @Override
  public Future<Void> sendAccessRequestConfirmation(String toEmail, String contactName, String institutionName) {
    return send(toEmail,
        "OpenIV — We've Received Your Access Request",
        "Hi " + contactName + ",\n\nThank you for requesting access to OpenIV for " + institutionName
            + ".\n\nOur compliance team will review your request and reach out within one business day.\n\n"
            + "Questions? Contact compliance@openiv.ng",
        EmailTemplates.accessRequestConfirmation(contactName, institutionName));
  }

  // -------------------------------------------------------------------------

  private Future<Void> send(String toEmail, String subject, String text, String html) {
    return vertx.<Void>executeBlocking(() -> {
      MailtrapMail mail = MailtrapMail.builder()
          .from(new Address(from, "OpenIV"))
          .to(List.of(new Address(toEmail)))
          .subject(subject)
          .text(text)
          .html(html)
          .build();
      client.send(mail);
      return null;
    }).onFailure(err -> log.error("Failed to send email to {}: {}", toEmail, err.getMessage()))
      .mapEmpty();
  }
}
