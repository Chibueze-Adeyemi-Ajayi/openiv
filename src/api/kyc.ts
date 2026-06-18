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

export interface KycCustomer {
  customerId: string
  overallRiskScore: number
  totalRiskScore: number | null       // weighted: 20% kyc + 55% case history + 25% txn
  /** System-assessed knowledge level: "t1" (basic), "t2" (intermediate), "t3" (full KYC) */
  knowledgeLevel: 't1' | 't2' | 't3' | null
  /** Institution-provided KYC tier sent in the beam payload */
  institutionKycTier: number | null
  overallStatus: string               // "verified" | "partial" | "flagged"
  actionTaken: string                 // "clear" | "flagged" | "case_opened"
  runAt: string
  bvnNinStatus: string | null
  bvnNinScore: number | null
  bvnNinDetail: string | null
  phoneStatus: string | null
  phoneScore: number | null
  phoneDetail: string | null
  livenessStatus: string | null
  livenessScore: number | null
  livenessDetail: string | null
  pepStatus: string | null
  pepScore: number | null
  pepDetail: string | null
  identityPhoto: string | null
  firstName: string | null
  lastName: string | null
  name?: string | null
  phone: string | null
  dateOfBirth: string | null
  cddStepScores?: string | null
  selfiePhoto?: string | null
  hasActiveCase?: boolean
}

export interface KycEvaluationConfig {
  intervalDays: 7 | 14 | 21 | 31
  enabled: boolean
  updatedAt: string
}

export interface KycFetchConfig {
  lookupUrl: string | null
  lookupTimeout: number | null
}

export interface KycStepEvent {
  step: string
  status: string
  detail: string
  durationMs: number
  stepRiskScore: number
  runningScore: number
}

export interface KycStreamResult {
  customerId: string
  kycStatus: string
  /** System-assessed knowledge level returned from the pipeline */
  knowledgeLevel: 't1' | 't2' | 't3'
  institutionKycTier: number | null
  overallRiskScore: number
  action: string
  actionDetail: string
  processedAt: string
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

  listCustomers: (filter?: string, search?: string) => {
    const params = new URLSearchParams()
    if (filter) params.set('filter', filter)
    if (search) params.set('search', search)
    const qs = params.toString()
    return apiRequest<{ customers: KycCustomer[] }>(`/api/v1/kyc/customers${qs ? `?${qs}` : ''}`)
  },

  getStats: () =>
    apiRequest<{ total: number; highRisk: number; mediumRisk: number; lowRisk: number; verified: number; flagged: number }>(
      '/api/v1/kyc/customers/stats'),

  getCustomerKyc: (customerId: string) =>
    apiRequest<KycCustomer>(`/api/v1/kyc/customers/${encodeURIComponent(customerId)}`),

  getEvaluationConfig: () =>
    apiRequest<{ config: KycEvaluationConfig | null }>('/api/v1/kyc/evaluation-config'),

  saveEvaluationConfig: (intervalDays: number, enabled: boolean) =>
    apiRequest<{ config: KycEvaluationConfig }>('/api/v1/kyc/evaluation-config', {
      method: 'PUT',
      body: { intervalDays, enabled },
    }),

  getFetchConfig: () =>
    apiRequest<{ config: KycFetchConfig | null }>('/api/v1/kyc/config'),

  saveFetchConfig: (lookupUrl: string | null, lookupTimeout: number | null) =>
    apiRequest<{ config: KycFetchConfig }>('/api/v1/kyc/config', {
      method: 'PUT',
      body: { lookupUrl, lookupTimeout },
    }),
}

export async function streamKycBeam(
  payload: Record<string, unknown>,
  onStep: (event: KycStepEvent) => void,
  onResult: (result: KycStreamResult) => void,
  onError: (msg: string) => void,
): Promise<void> {
  const form = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'photo' || value == null) continue
    form.append(key, String(value))
  }
  if (typeof payload.photo === 'string' && payload.photo) {
    try {
      const b64 = payload.photo.includes(',') ? payload.photo.split(',')[1] : payload.photo
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      form.append('photo', new Blob([bytes], { type: 'image/jpeg' }), 'selfie.jpg')
    } catch { /* skip photo if undecodable — liveness falls back to identity photo */ }
  }

  let response: Response
  try {
    response = await fetch('/api/v1/beam/kyc/stream', {
      method: 'POST',
      credentials: 'include',
      body: form,  // browser sets Content-Type: multipart/form-data with boundary automatically
    })
  } catch (e) {
    onError(e instanceof Error ? e.message : 'Network error')
    return
  }

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => 'Unknown error')
    onError(`HTTP ${response.status}: ${text}`)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      let eventType = ''
      let dataLine = ''
      for (const line of part.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim()
        else if (line.startsWith('data: ')) dataLine = line.slice(6).trim()
      }
      if (!eventType || !dataLine) continue
      try {
        const data = JSON.parse(dataLine)
        if (eventType === 'step') onStep(data as KycStepEvent)
        else if (eventType === 'result') onResult(data as KycStreamResult)
        else if (eventType === 'error') onError((data as { message: string }).message ?? 'Unknown error')
      } catch { /* ignore parse errors */ }
    }
  }
}
