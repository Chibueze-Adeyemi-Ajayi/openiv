import { apiRequest } from './client'

export type BehavioralRuleCategory = 'Geo' | 'Device' | 'Velocity' | 'Network' | 'Temporal' | 'Custom'
export type BehavioralRuleSeverity = 'critical' | 'high' | 'medium'

export type TemplateType =
  | 'ip_cluster'
  | 'geo_impossible'
  | 'device_shared'
  | 'off_hours_burst'
  | 'velocity_ring'

export const TEMPLATE_META: Record<TemplateType, {
  label: string
  category: BehavioralRuleCategory
  defaultParams: Record<string, any>
  paramDefs: { key: string; label: string; type: 'number' | 'text' }[]
}> = {
  ip_cluster:      { label: 'Same-IP cluster',           category: 'Network',  defaultParams: { ip_count: 4, timeframe_minutes: 30 },            paramDefs: [{ key: 'ip_count', label: 'Account count', type: 'number' }, { key: 'timeframe_minutes', label: 'Within (minutes)', type: 'number' }] },
  geo_impossible:  { label: 'Geographically impossible', category: 'Geo',      defaultParams: { distance_km: 500, timeframe_hours: 2 },           paramDefs: [{ key: 'distance_km', label: 'Min distance (km)', type: 'number' }, { key: 'timeframe_hours', label: 'Within (hours)', type: 'number' }] },
  device_shared:   { label: 'Device shared',             category: 'Device',   defaultParams: { user_count: 3, timeframe_hours: 24 },             paramDefs: [{ key: 'user_count', label: 'Customer count', type: 'number' }, { key: 'timeframe_hours', label: 'Within (hours)', type: 'number' }] },
  off_hours_burst: { label: 'Off-hours burst',           category: 'Temporal', defaultParams: { time_start: '02:00', time_end: '04:00', min_customers: 10, spike_ratio: 1.5 }, paramDefs: [{ key: 'time_start', label: 'Window start', type: 'text' }, { key: 'time_end', label: 'Window end', type: 'text' }, { key: 'min_customers', label: 'Min customers', type: 'number' }] },
  velocity_ring:   { label: 'Velocity ring',             category: 'Velocity', defaultParams: { customer_count: 5, timeframe_hours: 4 },          paramDefs: [{ key: 'customer_count', label: 'Sender count', type: 'number' }, { key: 'timeframe_hours', label: 'Within (hours)', type: 'number' }] },
}

export interface BehavioralRule {
  id: number
  ruleId: string
  name: string
  category: BehavioralRuleCategory
  severity: BehavioralRuleSeverity
  description: string
  example: string
  matchedTypology: string
  isActive: boolean
  affected: number
  emergence: string
  params: Record<string, any>
  recommendedActions: { label: string; primary?: boolean }[]
  templateType: TemplateType | ''
  policyStatement: string
  createdAt: string
  updatedAt: string
}

export interface CreateBehavioralRuleInput {
  templateType: TemplateType
  name: string
  category?: string
  severity?: BehavioralRuleSeverity
  description?: string
  policyStatement?: string
  example?: string
  matchedTypology?: string
  params?: Record<string, any>
  recommendedActions?: { label: string; primary?: boolean }[]
}

export const behavioralRuleApi = {
  list: () =>
    apiRequest<{ rules: BehavioralRule[] }>('/api/v1/behavioral-rules'),

  update: (id: number, data: {
    params?: Record<string, any>
    isActive?: boolean
    name?: string
    description?: string
    policyStatement?: string
  }) =>
    apiRequest<{ ok: boolean; rule: BehavioralRule }>(`/api/v1/behavioral-rules/${id}`, {
      method: 'PATCH',
      body: data,
    }),

  create: (data: CreateBehavioralRuleInput) =>
    apiRequest<{ rule: BehavioralRule }>('/api/v1/behavioral-rules', {
      method: 'POST',
      body: data,
    }),

  delete: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/behavioral-rules/${id}`, { method: 'DELETE' }),
}
