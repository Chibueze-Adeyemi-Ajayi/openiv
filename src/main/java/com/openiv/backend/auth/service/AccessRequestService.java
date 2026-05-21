package com.openiv.backend.auth.service;

import com.openiv.backend.auth.model.AccessRequest;
import com.openiv.backend.auth.model.AccountType;
import com.openiv.backend.auth.repository.AccessRequestRepository;
import io.vertx.core.Future;

import java.util.regex.Pattern;

/**
 * Public self-service onboarding requests. An institution (or its admin) submits intent to
 * onboard; an internal admin reviews and either creates an Institution + Invitation or rejects.
 *
 * <p>Throttling: a single contact email can submit at most {@link #MAX_PER_WINDOW} requests
 * in {@link #WINDOW_MINUTES} minutes. Belt-and-braces alongside the per-IP rate limiter.
 */
public final class AccessRequestService {

  private static final int MAX_PER_WINDOW = 3;
  private static final int WINDOW_MINUTES = 60;

  // Conservative server-side validation. The client-side regex is friendlier; this catches
  // obvious garbage and prevents oversized payloads from polluting the table.
  private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

  private final AccessRequestRepository repo;
  private final EmailSender emailSender;

  public AccessRequestService(AccessRequestRepository repo, EmailSender emailSender) {
    this.repo = repo;
    this.emailSender = emailSender;
  }

  public Future<AccessRequest> submit(SubmitInput input) {
    InvalidField bad = validate(input);
    if (bad != null) {
      return Future.failedFuture(AuthException.invalid(bad.field()));
    }
    String normalizedEmail = input.contactEmail().trim().toLowerCase();
    return repo.countRecentByEmail(normalizedEmail, WINDOW_MINUTES).compose(count -> {
      if (count >= MAX_PER_WINDOW) {
        return Future.failedFuture(AuthException.invalid("rate_limited_for_email"));
      }
      return repo.create(
          input.institutionName().trim(),
          input.institutionType(),
          input.contactName().trim(),
          normalizedEmail,
          blankToNull(input.contactPhone()),
          blankToNull(input.jobTitle()),
          blankToNull(input.description()))
        .onSuccess(request -> {
          emailSender.sendWaitlistNotification(
              "chibuezeadeyemi@gmail.com",
              input.contactName().trim(),
              normalizedEmail,
              input.description() != null ? input.description().trim() : "N/A"
          );
        });
    });
  }

  private static InvalidField validate(SubmitInput in) {
    if (isBlank(in.institutionName()) || in.institutionName().length() > 200) {
      return new InvalidField("institutionName");
    }
    if (in.institutionType() == null) return new InvalidField("institutionType");
    if (isBlank(in.contactName()) || in.contactName().length() > 200) {
      return new InvalidField("contactName");
    }
    if (isBlank(in.contactEmail()) || in.contactEmail().length() > 320
        || !EMAIL.matcher(in.contactEmail().trim()).matches()) {
      return new InvalidField("contactEmail");
    }
    if (in.contactPhone() != null && in.contactPhone().length() > 40) {
      return new InvalidField("contactPhone");
    }
    if (in.jobTitle() != null && in.jobTitle().length() > 200) {
      return new InvalidField("jobTitle");
    }
    if (in.description() != null && in.description().length() > 2000) {
      return new InvalidField("description");
    }
    return null;
  }

  private static boolean isBlank(String s) { return s == null || s.isBlank(); }

  private static String blankToNull(String s) {
    return (s == null || s.isBlank()) ? null : s.trim();
  }

  public record SubmitInput(
      String institutionName,
      AccountType institutionType,
      String contactName,
      String contactEmail,
      String contactPhone,
      String jobTitle,
      String description
  ) {}

  private record InvalidField(String field) {}
}
