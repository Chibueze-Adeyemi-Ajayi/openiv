import { apiRequest } from './client'

export type RuleType =
  | 'max_single_amount'
  | 'daily_amount_limit'
  | 'monthly_amount_limit'
  | 'transaction_velocity'
  | 'blocked_banks'
  | 'allowed_banks_only'
  | 'blocked_channels'
  | 'rapid_post_deposit_withdrawal'
  | 'sudden_withdrawal_after_deposit'
  | 'behavioral_pattern_deviation'

export type RuleAction = 'block' | 'flag' | 'alert'
export type RuleDirection = 'both' | 'inward' | 'outward'

export interface CustomerTransactionRule {
  id: number
  ruleType: RuleType
  params: Record<string, unknown>
  action: RuleAction
  isActive: boolean
  description: string | null
  direction: RuleDirection
  createdAt: string
  updatedAt: string
}

export interface CreateRulePayload {
  ruleType: RuleType
  params: Record<string, unknown>
  action: RuleAction
  description?: string
  direction?: RuleDirection
}

export const customerRulesApi = {
  list: (customerId: string) =>
    apiRequest<{ rules: CustomerTransactionRule[] }>(
      `/api/v1/customers/${encodeURIComponent(customerId)}/rules`
    ),

  create: (customerId: string, payload: CreateRulePayload) =>
    apiRequest<CustomerTransactionRule>(
      `/api/v1/customers/${encodeURIComponent(customerId)}/rules`,
      { method: 'POST', body: payload }
    ),

  update: (customerId: string, ruleId: number, payload: Partial<CreateRulePayload & { isActive: boolean }>) =>
    apiRequest<CustomerTransactionRule>(
      `/api/v1/customers/${encodeURIComponent(customerId)}/rules/${ruleId}`,
      { method: 'PUT', body: payload }
    ),

  delete: (customerId: string, ruleId: number) =>
    apiRequest<void>(
      `/api/v1/customers/${encodeURIComponent(customerId)}/rules/${ruleId}`,
      { method: 'DELETE' }
    ),

  toggle: (customerId: string, ruleId: number, isActive: boolean) =>
    apiRequest<{ ok: boolean }>(
      `/api/v1/customers/${encodeURIComponent(customerId)}/rules/${ruleId}/toggle`,
      { method: 'PATCH', body: { isActive } }
    ),
}
