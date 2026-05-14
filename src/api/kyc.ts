import { apiRequest } from './client'

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

export interface KycBeamPayload {
  customer_id: string
  name?: string
  bvn?: string
  nin?: string
  photo?: string
  occurred_at: string
}

export const kycApi = {
  lookup: (customerRef: string, openCase = false) =>
    apiRequest<KycLookupResult>('/api/v1/kyc/lookup', {
      method: 'POST',
      body: { customerRef, openCase },
    }),

  listLogs: () =>
    apiRequest<{ logs: KycLookupLog[] }>('/api/v1/kyc/logs'),

  searchPEP: (name: string) =>
    apiRequest<{ results: any[] }>(`/api/v1/kyc/pep-search?name=${encodeURIComponent(name)}`),
}
