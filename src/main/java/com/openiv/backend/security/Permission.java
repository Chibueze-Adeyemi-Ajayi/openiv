package com.openiv.backend.security;

/**
 * Granular permissions that map to specific API operations.
 * Used by {@link RolePermissions} and {@link RoleAuthHandler} for RBAC enforcement.
 */
public enum Permission {
  // Transactions
  TRANSACTIONS_VIEW,
  TRANSACTIONS_FLAG,
  TRANSACTIONS_IMPORT,

  // Cases
  CASES_VIEW,
  CASES_CREATE,
  CASES_ASSIGN,
  CASES_CLOSE,
  CASES_NOTE,
  CASES_EVIDENCE,

  // Customers
  CUSTOMERS_VIEW,
  CUSTOMERS_EDIT,

  // Reports / NFIU
  REPORTS_VIEW,
  REPORTS_CREATE,
  REPORTS_FILE,
  REPORTS_APPROVE,

  // Rules and thresholds
  RULES_VIEW,
  RULES_MODIFY,

  // CDD workflows — separate from threshold rules; only admin/CCO may modify
  WORKFLOWS_VIEW,
  WORKFLOWS_MODIFY,

  // Team management
  TEAM_VIEW,
  TEAM_MANAGE,

  // Billing
  BILLING_VIEW,
  BILLING_MANAGE,

  // Integrations: webhooks, beam, network, KYC config
  INTEGRATIONS_VIEW,
  INTEGRATIONS_MODIFY,

  // KYC
  KYC_VIEW,
  KYC_CONFIG,

  // AML settings
  AML_SETTINGS,

  // Institution
  INSTITUTION_VIEW,
  INSTITUTION_MODIFY,

  // Dashboard / general access
  DASHBOARD_VIEW,

  // Settings
  SETTINGS_VIEW,
  SETTINGS_MODIFY,
}
