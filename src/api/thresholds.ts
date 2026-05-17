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
  thresholdOutward: number | null
  thresholdInward: number | null
}

export interface KycTierRecord {
  id: number
  kycTier: number
  dailyLimitWire: number
  dailyLimitMobile: number
  dailyLimitUssd: number
  dailyLimitBdc: number
  dailyLimitOther: number
  singleTxnLimitWire: number
  singleTxnLimitMobile: number
  singleTxnLimitUssd: number
  singleTxnLimitBdc: number
  singleTxnLimitOther: number
  maxTxnsPerHour: number
  maxTxnsPerDay: number
  riskScoreBoost: number
  requiresAdditionalVerification: boolean
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
  ruleName?: string
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

  update: (id: number, data: { threshold?: number; isActive?: boolean; outwardThreshold?: number | null; inwardThreshold?: number | null }) =>
    apiRequest<{ ok: boolean; rule: ThresholdRule }>(`/api/v1/thresholds/${id}`, {
      method: 'PATCH',
      body: data,
    }),

  history: (id: number) =>
    apiRequest<{ changes: ThresholdChange[] }>(`/api/v1/thresholds/${id}/history`),

  allHistory: () =>
    apiRequest<{ changes: ThresholdChange[] }>('/api/v1/thresholds/history'),

  getKycStatus: () =>
    apiRequest<{ suppressed: boolean }>('/api/v1/thresholds/kyc-status'),

  suppressKyc: () =>
    apiRequest<{ ok: boolean }>('/api/v1/thresholds/kyc-suppress', { method: 'POST' }),

  listKycTiers: () =>
    apiRequest<{ tiers: KycTierRecord[] }>('/api/v1/thresholds/kyc-tiers'),

  updateKycTier: (tier: number, field: string, value: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/thresholds/kyc-tiers/${tier}`, {
      method: 'PATCH',
      body: { field, value },
    }),
}
