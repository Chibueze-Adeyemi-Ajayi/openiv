import { apiRequest, BASE_URL } from './client'

export type TransactionStatus = 'pending' | 'successful' | 'failed'
export type FlaggedStatus     = 'flagged' | 'blocked' | 'cleared' | 'review'

export interface Transaction {
  id: string
  customerId: string
  customer: string
  amount: number
  channel: string
  counterparty: string
  time: string
  risk: number
  status: TransactionStatus
  flaggedStatus?: FlaggedStatus
  location: string
  lat?: number
  lng?: number
  occurredAt?: string
  createdAt?: string
  updatedAt?: string
  senderAccount?: string
  senderBank?: string
  recipientName?: string
  recipientAccount?: string
  recipientBank?: string
  currency?: string
  narration?: string
  deviceId?: string
  ipAddress?: string
}

export interface TransactionPage {
  transactions: Transaction[]
  total: number
  page: number
  pageSize: number
}

export interface ImportRow {
  id: string
  customerId: string
  customerName: string
  amount: number
  channel: string
  counterparty: string
  riskScore?: number
  status?: TransactionStatus
  location?: string
  lat?: number
  lng?: number
  occurredAt: string
  senderAccount?: string
  senderBank?: string
  recipientName?: string
  recipientAccount?: string
  recipientBank?: string
  currency?: string
  narration?: string
  deviceId?: string
  ipAddress?: string
}

export interface TransactionListParams {
  status?: TransactionStatus
  flaggedStatus?: FlaggedStatus
  q?: string
  page?: number
  pageSize?: number
  range?: string
  channel?: string
  minRisk?: number
  maxRisk?: number
}

export const transactionApi = {
  list: (params: TransactionListParams = {}) => {
    const qs = new URLSearchParams()
    if (params.status)            qs.set('status',        params.status)
    if (params.flaggedStatus)     qs.set('flaggedStatus', params.flaggedStatus)
    if (params.q)                 qs.set('q',             params.q)
    if (params.page)              qs.set('page',          String(params.page))
    if (params.pageSize)          qs.set('pageSize',      String(params.pageSize))
    if (params.range)             qs.set('range',         params.range)
    if (params.channel)           qs.set('channel',       params.channel)
    if (params.minRisk != null)   qs.set('minRisk',       String(params.minRisk))
    if (params.maxRisk != null)   qs.set('maxRisk',       String(params.maxRisk))
    const query = qs.toString()
    return apiRequest<TransactionPage>(`/api/v1/transactions${query ? '?' + query : ''}`)
  },

  bulkFlaggedStatus: (ids: string[], flaggedStatus: FlaggedStatus, reason: string, documentId?: number) =>
    apiRequest<{ ok: boolean }>('/api/v1/transactions/bulk-status', {
      body: { ids, flaggedStatus, reason, ...(documentId != null ? { documentId } : {}) },
    }),

  importTransactions: (rows: ImportRow[]) =>
    apiRequest<{ imported: number }>('/api/v1/transactions/import', {
      body: { transactions: rows },
    }),

  exportCsv: async (params: TransactionListParams = {}) => {
    const qs = new URLSearchParams()
    if (params.status)          qs.set('status',        params.status)
    if (params.flaggedStatus)   qs.set('flaggedStatus', params.flaggedStatus)
    if (params.q)               qs.set('q',             params.q)
    if (params.range)           qs.set('range',         params.range)
    if (params.channel)         qs.set('channel',       params.channel)
    if (params.minRisk != null) qs.set('minRisk',       String(params.minRisk))
    if (params.maxRisk != null) qs.set('maxRisk',       String(params.maxRisk))
    const query = qs.toString()
    const url = `${BASE_URL}/api/v1/transactions/export${query ? '?' + query : ''}`
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) throw new Error(`Export failed: ${res.status}`)
    const blob = await res.blob()
    const link = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(blob),
      download: `transactions_${new Date().toISOString().slice(0, 10)}.csv`,
    })
    link.click()
    URL.revokeObjectURL(link.href)
  },
}
