export type Role = 'admin' | 'cco' | 'analyst' | 'developer' | 'auditor'

export type Permission =
  | 'transactions.view'
  | 'transactions.flag'
  | 'transactions.import'
  | 'cases.view'
  | 'cases.create'
  | 'cases.assign'
  | 'cases.close'
  | 'cases.note'
  | 'cases.evidence'
  | 'customers.view'
  | 'customers.edit'
  | 'reports.view'
  | 'reports.create'
  | 'reports.file'
  | 'reports.approve'
  | 'rules.view'
  | 'rules.modify'
  | 'workflows.view'
  | 'workflows.modify'
  | 'cdd.view'
  | 'cdd.manage'
  | 'cdd.evaluate'
  | 'pipeline.view'
  | 'pipeline.modify'
  | 'team.view'
  | 'team.manage'
  | 'billing.view'
  | 'billing.manage'
  | 'integrations.view'
  | 'integrations.modify'
  | 'kyc.view'
  | 'kyc.config'
  | 'aml.settings'
  | 'institution.view'
  | 'institution.modify'
  | 'dashboard.view'
  | 'settings.view'
  | 'settings.modify'

const ALL: Permission[] = [
  'transactions.view', 'transactions.flag', 'transactions.import',
  'cases.view', 'cases.create', 'cases.assign', 'cases.close', 'cases.note', 'cases.evidence',
  'customers.view', 'customers.edit',
  'reports.view', 'reports.create', 'reports.file', 'reports.approve',
  'rules.view', 'rules.modify',
  'workflows.view', 'workflows.modify',
  'cdd.view', 'cdd.manage', 'cdd.evaluate',
  'pipeline.view', 'pipeline.modify',
  'team.view', 'team.manage',
  'billing.view', 'billing.manage',
  'integrations.view', 'integrations.modify',
  'kyc.view', 'kyc.config',
  'aml.settings',
  'institution.view', 'institution.modify',
  'dashboard.view',
  'settings.view', 'settings.modify',
]

export const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  admin: new Set(ALL),

  cco: new Set<Permission>([
    'transactions.view', 'transactions.flag', 'transactions.import',
    'cases.view', 'cases.create', 'cases.assign', 'cases.close', 'cases.note', 'cases.evidence',
    'customers.view', 'customers.edit',
    'reports.view', 'reports.create', 'reports.file', 'reports.approve',
    'rules.view', 'rules.modify',
    'workflows.view', 'workflows.modify',
    'cdd.view', 'cdd.manage', 'cdd.evaluate',
    'pipeline.view', 'pipeline.modify',
    'team.view',
    'billing.view',
    'integrations.view',
    'kyc.view', 'kyc.config',
    'aml.settings',
    'institution.view', 'institution.modify',
    'dashboard.view',
    'settings.view',
  ]),

  analyst: new Set<Permission>([
    'transactions.view', 'transactions.flag',
    'cases.view', 'cases.create', 'cases.assign', 'cases.note', 'cases.evidence',
    'customers.view', 'customers.edit',
    'reports.view',
    'rules.view',
    'workflows.view',
    'cdd.view', 'cdd.evaluate',
    'pipeline.view',
    'kyc.view',
    'institution.view',
    'dashboard.view',
    'settings.view',
  ]),

  developer: new Set<Permission>([
    'transactions.view',
    'cases.view',
    'customers.view',
    'rules.view',
    'workflows.view',
    'cdd.view',
    'pipeline.view', 'pipeline.modify',
    'integrations.view', 'integrations.modify',
    'kyc.view',
    'institution.view',
    'dashboard.view',
    'settings.view',
  ]),

  auditor: new Set<Permission>([
    'transactions.view',
    'cases.view',
    'customers.view',
    'reports.view',
    'rules.view',
    'workflows.view',
    'cdd.view',
    'pipeline.view',
    'team.view',
    'billing.view',
    'integrations.view',
    'kyc.view',
    'institution.view',
    'dashboard.view',
    'settings.view',
  ]),
}

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false
  const perms = ROLE_PERMISSIONS[role as Role]
  return perms ? perms.has(permission) : false
}
