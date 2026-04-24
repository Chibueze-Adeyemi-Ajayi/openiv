package com.openiv.backend.auth.service;

import com.openiv.backend.config.AppConfig;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.ext.mail.MailClient;
import io.vertx.ext.mail.MailConfig;
import io.vertx.ext.mail.MailMessage;
import io.vertx.ext.mail.StartTLSOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class VertxEmailSender implements EmailSender {

  private static final Logger log = LoggerFactory.getLogger(VertxEmailSender.class);

  private final MailClient client;
  private final String from;

  public VertxEmailSender(Vertx vertx, AppConfig.EmailConfig config) {
    // DISABLED: already wrapped in TLS (implicit/port-465).
    // OPTIONAL: plain connect first; upgrade to TLS if the server advertises it (STARTTLS / port-587, Mailpit, etc.)
    StartTLSOptions startTls = config.useSsl() ? StartTLSOptions.DISABLED : StartTLSOptions.OPTIONAL;
    MailConfig mailConfig = new MailConfig()
        .setHostname(config.host())
        .setPort(config.port())
        .setSsl(config.useSsl())
        .setStarttls(startTls);

    if (config.user() != null && config.password() != null) {
      mailConfig.setUsername(config.user()).setPassword(config.password());
    }

    this.client = MailClient.createShared(vertx, mailConfig);
    this.from = config.from();
    log.info("SMTP EmailSender initialized: host={}:{}, from={}", config.host(), config.port(), from);
  }

  @Override
  public Future<Void> sendVerificationCode(String toEmail, String code) {
    MailMessage message = new MailMessage()
        .setFrom(from)
        .setTo(toEmail)
        .setSubject("OpenIV Verification Code")
        .setText("Your verification code is: " + code)
        .setHtml(EmailTemplates.verification(code));

    return client.sendMail(message)
        .onFailure(err -> log.error("Failed to send verification email to {}: {}", toEmail, err.getMessage()))
        .mapEmpty();
  }

  @Override
  public Future<Void> sendPasswordResetCode(String toEmail, String code) {
    MailMessage message = new MailMessage()
        .setFrom(from)
        .setTo(toEmail)
        .setSubject("OpenIV Password Reset")
        .setText("Your password reset code is: " + code)
        .setHtml(EmailTemplates.passwordReset(code));

    return client.sendMail(message)
        .onFailure(err -> log.error("Failed to send password reset email to {}: {}", toEmail, err.getMessage()))
        .mapEmpty();
  }

  @Override
  public Future<Void> sendStepUpLockout(String toEmail, String fullName, String timestamp) {
    MailMessage message = new MailMessage()
        .setFrom(from)
        .setTo(toEmail)
        .setSubject("OpenIV — Suspicious Activity Detected on Your Account")
        .setText("We detected 3 consecutive failed TOTP verification attempts at " + timestamp + " UTC.")
        .setHtml(EmailTemplates.stepUpLockoutUser(fullName, timestamp));

    return client.sendMail(message)
        .onFailure(err -> log.error("Failed to send step-up lockout email to {}: {}", toEmail, err.getMessage()))
        .mapEmpty();
  }

  @Override
  public Future<Void> sendStepUpLockoutAdmin(String toEmail, String adminName,
      String userName, String userEmail, String timestamp) {
    MailMessage message = new MailMessage()
        .setFrom(from)
        .setTo(toEmail)
        .setSubject("OpenIV — Account Security Alert: Step-Up Lockout")
        .setText("User " + userName + " (" + userEmail + ") was locked out after 3 failed TOTP attempts at " + timestamp + " UTC.")
        .setHtml(EmailTemplates.stepUpLockoutAdmin(adminName, userName, userEmail, timestamp));

    return client.sendMail(message)
        .onFailure(err -> log.error("Failed to send step-up lockout admin email to {}: {}", toEmail, err.getMessage()))
        .mapEmpty();
  }
}
