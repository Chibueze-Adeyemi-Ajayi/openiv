import { apiRequest } from './client'

export interface KycConfig {
  lookupUrl: string | null
  hasLookupApiKey: boolean
  lookupTimeout: number
  listenerUrl: string | null
  hasListenerApiKey: boolean
  updatedAt: string | null
}

export interface KycLookupLog {
  id: number
  customerRef: string
  triggerSource: string
  status: 'success' | 'failed' | 'timeout'
  responseCode: number | null
  durationMs: number | null
  kycTier: number | null
  kycStatus: string | null
  errorMessage: string | null
  performedAt: string
}

export interface KycOpenedCase {
  id: string
  title: string
  status: string
  priority: string
  riskScore: number
  slaDeadline: string
  createdAt: string
}

export interface KycLookupResult {
  customerId: string
  kyc: Record<string, unknown>
  case?: KycOpenedCase
}

export interface KycConfigInput {
  lookupUrl?: string | null
  lookupApiKey?: string | null
  lookupTimeout?: number
}

export const kycApi = {
  getConfig: () =>
    apiRequest<{ config: KycConfig | null }>('/api/v1/kyc/config'),

  saveConfig: (data: KycConfigInput) =>
    apiRequest<{ config: KycConfig }>('/api/v1/kyc/config', {
      method: 'PUT',
      body: data,
    }),

  lookup: (customerRef: string, openCase = false) =>
    apiRequest<KycLookupResult>('/api/v1/kyc/lookup', {
      method: 'POST',
      body: { customerRef, openCase },
    }),

  listLogs: () =>
    apiRequest<{ logs: KycLookupLog[] }>('/api/v1/kyc/logs'),
}
