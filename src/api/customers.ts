import { apiRequest } from './client'

export interface Customer {
  id: number
  institutionId: number
  externalId: string
  name: string
  email: string | null
  phone: string | null
  riskScore: number
  riskProfileScore: number
  transactionRiskScore: number
  overallRiskScore: number
  bvn: string | null
  nin: string | null
  photo: string | null
  selfiePhoto: string | null
  identityPhoto: string | null
  accountNumber: string | null
  subjectType: 'individual' | 'corporate' | null
  dob: string | null
  address: string | null
  createdAt: string
  updatedAt: string
  watchlisted: boolean
  watchlistedAt: string | null
  watchlistedReason: string | null
  lastEvaluatedAt: string | null
  cddRiskScore: number | null
  cddConcerns: CddConcern[] | null
  cddStepScores: CddStepScore[] | null
}

export interface CddConcern {
  step: string
  type: 'not_found' | 'name_mismatch' | 'phone_name_mismatch' | 'fraud_signals'
  field: string
  message: string
  resolveAction: 'rescreen' | 'investigate'
}

export interface CddStepScore {
  type: string
  status: 'pass' | 'match' | 'not_found' | 'skipped' | 'error'
  detail: string
  score: number | null
  isConcern?: boolean
  dobMismatch?: boolean
  ms: number
}

export interface UpdateCustomerProfileRequest {
  bvn?: string
  nin?: string
  photo?: string
  accountNumber?: string
  subjectType?: 'individual' | 'corporate'
  dob?: string
  address?: string
}

export interface HighRiskPage {
  customers: Customer[]
  total: number
  page: number
  pageSize: number
}

export const customerApi = {
  list: (q?: string, pageSize = 10, page = 1) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    params.set('pageSize', String(pageSize))
    params.set('page', String(page))
    return apiRequest<{ customers: Customer[]; page: number; pageSize: number; hasMore: boolean }>(`/api/v1/customers?${params}`)
  },

  getCustomer: (externalId: string) =>
    apiRequest<Customer>(`/api/v1/customers/${externalId}`),

  updateProfile: (externalId: string, req: UpdateCustomerProfileRequest) =>
    apiRequest<Customer>(`/api/v1/customers/${externalId}/profile`, { method: 'PATCH', body: req }),

  watchlist: (externalId: string, reason: string) =>
    apiRequest<Customer>(`/api/v1/customers/${externalId}/watchlist`, { method: 'PATCH', body: { reason } }),

  unwatchlist: (externalId: string) =>
    apiRequest<Customer>(`/api/v1/customers/${externalId}/unwatchlist`, { method: 'PATCH' }),

  highRisk: (page = 1, pageSize = 20) =>
    apiRequest<HighRiskPage>(`/api/v1/customers/high-risk?page=${page}&pageSize=${pageSize}`),

  rescreen: (externalId: string) =>
    apiRequest<{ outcome: string }>(`/api/v1/customers/${externalId}/rescreen`, { method: 'POST' }),

  rescreenAll: () =>
    apiRequest<{ runId: number | null; totalCustomers: number; message: string }>(`/api/v1/customers/rescreen-all`, { method: 'POST' }),

  resolveStep: (externalId: string, req: { type: string; resolution: 'pass' | 'fail'; score?: number; note: string }) =>
    apiRequest<Customer>(`/api/v1/customers/${externalId}/resolve-step`, { method: 'POST', body: req }),
}
