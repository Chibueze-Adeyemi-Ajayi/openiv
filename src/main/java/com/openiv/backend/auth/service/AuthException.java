package com.openiv.backend.auth.service;

/**
 * Typed auth failure. The {@code category} is safe to return to the client; the message is
 * operator-facing and MUST NOT be surfaced.
 */
public final class AuthException extends RuntimeException {

  public enum Category {
    INVALID,       // generic invalid input (bad code, bad creds)
    LOCKED,        // account temporarily locked
    WRONG_STATE,   // session in the wrong state for this operation
    WEAK_PASSWORD, // new password rejected by policy
    SECURITY       // permission or feature-lock failure
  }

  private final Category category;
  private final String detail;

  private AuthException(Category category, String detail) {
    super(category + ":" + detail);
    this.category = category;
    this.detail = detail;
  }

  public Category category() { return category; }
  public String detail() { return detail; }

  public static AuthException invalid(String detail) { return new AuthException(Category.INVALID, detail); }
  public static AuthException locked() { return new AuthException(Category.LOCKED, "account_locked"); }
  public static AuthException wrongState() { return new AuthException(Category.WRONG_STATE, "wrong_session_state"); }
  public static AuthException weakPassword(String detail) { return new AuthException(Category.WEAK_PASSWORD, detail); }
  public static AuthException security(String detail) { return new AuthException(Category.SECURITY, detail); }
}
