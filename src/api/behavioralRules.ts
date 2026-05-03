import { apiRequest } from './client'

export interface BehavioralRule {
  id: number
  ruleId: string
  name: string
  category: 'Geo' | 'Device' | 'Velocity' | 'Network' | 'Temporal'
  severity: 'critical' | 'high' | 'medium'
  description: string
  example: string
  matchedTypology: string
  isActive: boolean
  affected: number
  emergence: string
  params: Record<string, any>
  recommendedActions: { label: string; primary?: boolean }[]
  createdAt: string
  updatedAt: string
}

export const behavioralRuleApi = {
  list: () =>
    apiRequest<{ rules: BehavioralRule[] }>('/api/v1/behavioral-rules'),

  update: (id: number, data: { params?: Record<string, any>; isActive?: boolean }) =>
    apiRequest<{ ok: boolean; rule: BehavioralRule }>(`/api/v1/behavioral-rules/${id}`, {
      method: 'PATCH',
      body: data,
    }),
}
