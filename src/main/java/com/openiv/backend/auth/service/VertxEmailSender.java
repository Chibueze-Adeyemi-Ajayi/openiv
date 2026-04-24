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
    MailConfig mailConfig = new MailConfig()
        .setHostname(config.host())
        .setPort(config.port())
        .setSsl(config.useSsl())
        .setStarttls(config.useSsl() ? StartTLSOptions.DISABLED : StartTLSOptions.REQUIRED);

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
}
