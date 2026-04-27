package com.openiv.backend.auth.service;

import io.vertx.core.json.JsonObject;

/**
 * Typed auth failure. The {@code category} is safe to return to the client; the message is
 * operator-facing and MUST NOT be surfaced.
 */
public final class AuthException extends RuntimeException {

  public enum Category {
    INVALID,       // generic invalid input (bad code, bad creds)
    LOCKED,        // account or device temporarily / permanently locked
    WRONG_STATE,   // session in the wrong state for this operation
    WEAK_PASSWORD, // new password rejected by policy
    SECURITY,      // permission or feature-lock failure
    CONFLICT       // active session conflict (same device or different device)
  }

  private final Category category;
  private final String detail;
  private final JsonObject conflictData; // only populated for CONFLICT

  private AuthException(Category category, String detail, JsonObject conflictData) {
    super(category + ":" + detail);
    this.category = category;
    this.detail = detail;
    this.conflictData = conflictData;
  }

  public Category category()      { return category; }
  public String detail()          { return detail; }
  public JsonObject conflictData(){ return conflictData; }

  public static AuthException invalid(String detail)       { return new AuthException(Category.INVALID,       detail, null); }
  public static AuthException locked()                     { return new AuthException(Category.LOCKED,        "account_locked", null); }
  public static AuthException deviceBlocked()              { return new AuthException(Category.LOCKED,        "device_blocked", null); }
  public static AuthException wrongState()                 { return new AuthException(Category.WRONG_STATE,   "wrong_session_state", null); }
  public static AuthException weakPassword(String detail)  { return new AuthException(Category.WEAK_PASSWORD, detail, null); }
  public static AuthException security(String detail)      { return new AuthException(Category.SECURITY,      detail, null); }
  public static AuthException conflict(String detail, JsonObject data) {
    return new AuthException(Category.CONFLICT, detail, data);
  }
}
