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
}
