package com.openiv.backend.auth.model;

/**
 * Session state machine.
 *
 * <pre>
 *   (new login — organic)
 *       |
 *       v
 *   PENDING_EMAIL_VERIFICATION  ---[verify email code]-->  PENDING_TOTP_SETUP
 *                                                               |
 *                                                               v
 *                                                         (enroll TOTP)
 *                                                               |
 *                                                               v
 *                                                          AUTHENTICATED
 *
 *   (team-invited user — first login)
 *       |
 *       v
 *   MUST_CHANGE_PASSWORD  ---[set new password]-->  PENDING_TOTP_SETUP  -->  AUTHENTICATED
 *
 *   (subsequent login, TOTP already enabled)
 *       |
 *       v
 *   PENDING_TOTP_CHALLENGE  ---[verify totp]-->  AUTHENTICATED
 * </pre>
 */
public enum SessionState {
  PENDING_EMAIL_VERIFICATION("pending_email_verification"),
  MUST_CHANGE_PASSWORD("must_change_password"),
  PENDING_TOTP_SETUP("pending_totp_setup"),
  PENDING_TOTP_CHALLENGE("pending_totp_challenge"),
  PENDING_BIOMETRIC_SETUP("pending_biometric_setup"),
  PENDING_BIOMETRIC_CHALLENGE("pending_biometric_challenge"),
  AUTHENTICATED("authenticated"),
  GEO_BLOCKED("geo_blocked");

  private final String dbValue;

  SessionState(String dbValue) {
    this.dbValue = dbValue;
  }

  public String dbValue() {
    return dbValue;
  }

  public static SessionState fromDb(String value) {
    for (SessionState s : values()) {
      if (s.dbValue.equals(value)) {
        return s;
      }
    }
    throw new IllegalArgumentException("Unknown session state: " + value);
  }
}
