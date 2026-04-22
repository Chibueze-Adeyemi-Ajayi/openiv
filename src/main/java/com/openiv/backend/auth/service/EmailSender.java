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
}
