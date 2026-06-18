package com.openiv.backend.security;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Canonical mapping of each role to its permitted actions.
 *
 * <p>Roles match the DB constraint on {@code users.role}:
 * {@code admin}, {@code cco}, {@code analyst}, {@code developer}, {@code auditor}.
 */
public final class RolePermissions {

  private static final Set<Permission> ALL = EnumSet.allOf(Permission.class);

  private static final Map<String, Set<Permission>> MAP = Map.of(

      "admin", ALL,

      "cco", EnumSet.of(
          Permission.TRANSACTIONS_VIEW, Permission.TRANSACTIONS_FLAG, Permission.TRANSACTIONS_IMPORT,
          Permission.CASES_VIEW, Permission.CASES_CREATE, Permission.CASES_ASSIGN,
          Permission.CASES_CLOSE, Permission.CASES_NOTE, Permission.CASES_EVIDENCE,
          Permission.CUSTOMERS_VIEW, Permission.CUSTOMERS_EDIT,
          Permission.REPORTS_VIEW, Permission.REPORTS_CREATE,
          Permission.REPORTS_FILE, Permission.REPORTS_APPROVE,
          Permission.RULES_VIEW, Permission.RULES_MODIFY,
          Permission.WORKFLOWS_VIEW, Permission.WORKFLOWS_MODIFY,
          Permission.TEAM_VIEW,
          Permission.BILLING_VIEW,
          Permission.INTEGRATIONS_VIEW,
          Permission.KYC_VIEW, Permission.KYC_CONFIG,
          Permission.AML_SETTINGS,
          Permission.INSTITUTION_VIEW, Permission.INSTITUTION_MODIFY,
          Permission.DASHBOARD_VIEW,
          Permission.SETTINGS_VIEW
      ),

      "analyst", EnumSet.of(
          Permission.TRANSACTIONS_VIEW, Permission.TRANSACTIONS_FLAG,
          Permission.CASES_VIEW, Permission.CASES_CREATE, Permission.CASES_ASSIGN,
          Permission.CASES_NOTE, Permission.CASES_EVIDENCE,
          Permission.CUSTOMERS_VIEW, Permission.CUSTOMERS_EDIT,
          Permission.REPORTS_VIEW,
          Permission.RULES_VIEW,
          Permission.WORKFLOWS_VIEW,
          Permission.KYC_VIEW,
          Permission.INSTITUTION_VIEW,
          Permission.DASHBOARD_VIEW,
          Permission.SETTINGS_VIEW
      ),

      "developer", EnumSet.of(
          Permission.TRANSACTIONS_VIEW,
          Permission.CASES_VIEW,
          Permission.CUSTOMERS_VIEW,
          Permission.RULES_VIEW,
          Permission.WORKFLOWS_VIEW,
          Permission.INTEGRATIONS_VIEW, Permission.INTEGRATIONS_MODIFY,
          Permission.KYC_VIEW,
          Permission.INSTITUTION_VIEW,
          Permission.DASHBOARD_VIEW,
          Permission.SETTINGS_VIEW
      ),

      "auditor", EnumSet.of(
          Permission.TRANSACTIONS_VIEW,
          Permission.CASES_VIEW,
          Permission.CUSTOMERS_VIEW,
          Permission.REPORTS_VIEW,
          Permission.RULES_VIEW,
          Permission.WORKFLOWS_VIEW,
          Permission.TEAM_VIEW,
          Permission.BILLING_VIEW,
          Permission.INTEGRATIONS_VIEW,
          Permission.KYC_VIEW,
          Permission.INSTITUTION_VIEW,
          Permission.DASHBOARD_VIEW,
          Permission.SETTINGS_VIEW
      )
  );

  private RolePermissions() {}

  public static boolean has(String role, Permission permission) {
    if (role == null) return false;
    Set<Permission> perms = MAP.get(role);
    return perms != null && perms.contains(permission);
  }

  public static boolean hasAny(String role, Permission... permissions) {
    if (role == null) return false;
    Set<Permission> perms = MAP.get(role);
    if (perms == null) return false;
    return Arrays.stream(permissions).anyMatch(perms::contains);
  }
}
