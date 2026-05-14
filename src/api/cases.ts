import { apiRequest } from './client'
import type { Transaction } from './transactions'

export type CaseStatus     = 'open' | 'investigating' | 'escalated' | 'pending_review' | 'closed'
export type CasePriority   = 'low' | 'medium' | 'high' | 'critical'
export type CaseResolution = 'cleared' | 'sar_filed' | 'referred'

export interface Case {
  id: string
  title: string
  brief: string
  typology: string
  status: CaseStatus
  priority: CasePriority
  riskScore: number
  assignedTo?: number
  assigneeName?: string
  notes?: string
  resolution?: CaseResolution
  createdBy: number
  createdByName: string
  slaDeadline: string
  closedAt?: string
  createdAt: string
  updatedAt: string
  isAvailableForInvestigation: boolean
  seen: boolean
  linkedNfiuReportId?: number | null
  customerId?: string | null
  customerName?: string | null
}

export interface CaseActivityEntry {
  id: number
  actorId: number
  actorName: string
  actorRole: string
  action: string
  detail?: string
  createdAt: string
}

export type EvidenceCategory = 'transaction' | 'kyc' | 'behavior' | 'device' | 'otp' | 'document' | 'other'

export interface CaseEvidenceItem {
  id: number
  caseId: string
  addedBy: number
  addedByName: string
  category: EvidenceCategory
  title: string
  detail?: string
  refId?: string
  createdAt: string
}

export interface AddEvidenceInput {
  category: EvidenceCategory
  title: string
  detail?: string
  refId?: string
}

export interface CaseDetail {
  case: Case
  transactions: Transaction[]
  activity: CaseActivityEntry[]
  evidence: CaseEvidenceItem[]
}

export interface CaseMetrics {
  openCount: number
  escalatedCount: number
  closedToday: number
  avgCloseHours: number
}

export interface CasePage {
  cases: Case[]
  total: number
  page: number
  pageSize: number
}

export interface CreateCaseInput {
  title: string
  typology: string
  priority: CasePriority
  riskScore: number
  assignedTo?: number | null
  notes?: string
  transactionId?: string
  reason: string
  documentId: number
  customerId?: string
  customerName?: string
}

export const caseApi = {
  metrics: () =>
    apiRequest<CaseMetrics>('/api/v1/cases/metrics'),

  list: (params: { status?: string; priority?: string; q?: string; page?: number; pageSize?: number; sort?: string; range?: string; minRisk?: number; maxRisk?: number; assignedToMe?: boolean; assignedToUser?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.status)           qs.set('status',         params.status)
    if (params.priority)         qs.set('priority',       params.priority)
    if (params.q)                qs.set('q',              params.q)
    if (params.page)             qs.set('page',           String(params.page))
    if (params.pageSize)         qs.set('pageSize',       String(params.pageSize))
    if (params.sort)             qs.set('sort',           params.sort)
    if (params.range)            qs.set('range',          params.range)
    if (params.minRisk != null)  qs.set('minRisk',        String(params.minRisk))
    if (params.maxRisk != null)  qs.set('maxRisk',        String(params.maxRisk))
    if (params.assignedToMe)     qs.set('assignedToMe',   'true')
    if (params.assignedToUser != null) qs.set('assignedToUser', String(params.assignedToUser))
    const query = qs.toString()
    return apiRequest<CasePage>(`/api/v1/cases${query ? '?' + query : ''}`)
  },

  listPendingApproval: (params: { status?: string; priority?: string; q?: string; page?: number; pageSize?: number; sort?: string; range?: string; minRisk?: number; maxRisk?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.status)           qs.set('status',   params.status)
    if (params.priority)         qs.set('priority', params.priority)
    if (params.q)                qs.set('q',        params.q)
    if (params.page)             qs.set('page',     String(params.page))
    if (params.pageSize)         qs.set('pageSize', String(params.pageSize))
    if (params.sort)             qs.set('sort',     params.sort)
    if (params.range)            qs.set('range',    params.range)
    if (params.minRisk != null)  qs.set('minRisk',  String(params.minRisk))
    if (params.maxRisk != null)  qs.set('maxRisk',  String(params.maxRisk))
    const query = qs.toString()
    return apiRequest<CasePage>(`/api/v1/cases/pending-approval${query ? '?' + query : ''}`)
  },

  create: (data: CreateCaseInput) =>
    apiRequest<{ case: Case }>('/api/v1/cases', { body: data }),

  detail: (id: string) =>
    apiRequest<CaseDetail>(`/api/v1/cases/${id}`),

  updateStatus: (id: string, status: CaseStatus, resolution: CaseResolution | null | undefined,
      reason: string, documentId: number | null) =>
    apiRequest<{ ok: boolean }>(`/api/v1/cases/${id}/status`, {
      method: 'PATCH',
      body: { status, resolution: resolution ?? null, reason, documentId },
    }),

  linkTransaction: (id: string, transactionId: string) =>
    apiRequest<{ ok: boolean }>(`/api/v1/cases/${id}/transactions`, {
      body: { transactionId },
    }),

  addNote: (id: string, note: string) =>
    apiRequest<{ ok: boolean }>(`/api/v1/cases/${id}/notes`, {
      body: { note },
    }),

  addEvidence: (id: string, evidence: AddEvidenceInput) =>
    apiRequest<{ ok: boolean; id: number }>(`/api/v1/cases/${id}/evidence`, {
      body: evidence,
    }),

  forTransaction: (transactionId: string) =>
    apiRequest<{ case: Case | null }>(`/api/v1/transactions/${transactionId}/case`),

  assignCase: (id: string, toUserId?: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/cases/${id}/assign`, {
      body: { toUserId: toUserId ?? null },
    }),

  markSeen: (id: string) =>
    apiRequest<{ ok: boolean }>(`/api/v1/cases/${id}/seen`, { method: 'PATCH' }),

  unseenCount: () =>
    apiRequest<{ count: number }>('/api/v1/cases/unseen-count'),

  linkNfiuReport: (id: string, nfiuReportId: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/cases/${id}/link-nfiu-report`, {
      method: 'PATCH',
      body: { nfiuReportId },
    }),
}
