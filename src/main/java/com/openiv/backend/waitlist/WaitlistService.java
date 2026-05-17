package com.openiv.backend.waitlist;

import io.vertx.core.Future;

import java.util.List;
import java.util.regex.Pattern;

public final class WaitlistService {

  private static final int    MAX_PER_WINDOW = 2;
  private static final int    WINDOW_MINUTES = 60;
  private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

  private final WaitlistRepository repo;

  public WaitlistService(WaitlistRepository repo) { this.repo = repo; }

  public Future<WaitlistEntry> join(String name, String email, String description) {
    if (name == null || name.isBlank() || name.length() > 200)
      return Future.failedFuture(new IllegalArgumentException("invalid_name"));
    if (email == null || email.isBlank() || email.length() > 320
        || !EMAIL.matcher(email.trim()).matches())
      return Future.failedFuture(new IllegalArgumentException("invalid_email"));
    if (description != null && description.length() > 2000)
      return Future.failedFuture(new IllegalArgumentException("invalid_description"));

    String normEmail = email.trim().toLowerCase();
    return repo.countRecentByEmail(normEmail, WINDOW_MINUTES).compose(count -> {
      if (count >= MAX_PER_WINDOW)
        return Future.failedFuture(new IllegalArgumentException("rate_limited"));
      return repo.save(name.trim(), normEmail,
          description != null ? description.trim() : null,
          "landing_page");
    });
  }

  public Future<List<WaitlistEntry>> listAll() {
    return repo.listAll();
  }
}
