import { apiRequest } from './client'

export interface ThresholdRule {
  id: number
  ruleId: string
  name: string
  description: string
  tag: string
  thresholdValue: number
  unit: string
  minValue: number
  maxValue: number
  stepValue: number
  isActive: boolean
  firedCount: number
  createdAt: string
  updatedAt: string
}

export interface ThresholdChange {
  id: number
  thresholdId: number
  changedBy: number
  changedByName: string
  field: string
  oldValue: string | null
  newValue: string
  createdAt: string
}

export interface ThresholdMetrics {
  activeCount: number
  pausedCount: number
  totalFired: number
}

export const thresholdApi = {
  list: () =>
    apiRequest<{ rules: ThresholdRule[] }>('/api/v1/thresholds'),

  metrics: () =>
    apiRequest<ThresholdMetrics>('/api/v1/thresholds/metrics'),

  update: (id: number, data: { threshold?: number; isActive?: boolean }) =>
    apiRequest<{ ok: boolean; rule: ThresholdRule }>(`/api/v1/thresholds/${id}`, {
      method: 'PATCH',
      body: data,
    }),

  history: (id: number) =>
    apiRequest<{ changes: ThresholdChange[] }>(`/api/v1/thresholds/${id}/history`),
}
