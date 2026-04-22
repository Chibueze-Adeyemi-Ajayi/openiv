package com.openiv.backend.auth.model;

/**
 * Account type. Mandatory on every user and invitation.
 *
 * <ul>
 *   <li>{@code INDIVIDUAL} — retail customers, one-human-one-account.</li>
 *   <li>{@code COMPANY} — corporate / institutional customers.</li>
 *   <li>{@code REGULATOR} — supervisory / audit parties with special read access.</li>
 * </ul>
 *
 * <p>The DB stores the name as TEXT with a CHECK constraint; parse with {@link #fromDb}.
 */
public enum AccountType {
  INDIVIDUAL,
  COMPANY,
  REGULATOR;

  public String dbValue() {
    return name();
  }

  public static AccountType fromDb(String value) {
    if (value == null) {
      throw new IllegalArgumentException("account_type must not be null");
    }
    try {
      return AccountType.valueOf(value);
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException("Unknown account_type: " + value, e);
    }
  }
}
