import { apiRequest } from './client'

export interface NetworkLogEntry {
  id: string
  source: 'beam' | 'webhook'
  method: string
  endpoint: string
  stream: string | null
  statusCode: number
  durationMs: number | null
  bytes: number | null
  ip: string | null
  reqHeaders: string
  reqBody: string | null
  resHeaders: string | null
  resBody: string | null
  errorMessage: string | null
  ts: string
}

export interface NetworkLogsResponse {
  entries: NetworkLogEntry[]
  total: number
}

export const networkApi = {
  getLogs: (params: {
    source?: string
    status?: string
    since?: string
    q?: string
    limit?: number
    offset?: number
  }) => {
    const search = new URLSearchParams()
    if (params.source) search.set('source', params.source)
    if (params.status) search.set('status', params.status)
    if (params.since)  search.set('since', params.since)
    if (params.q)      search.set('q', params.q)
    if (params.limit  != null) search.set('limit',  String(params.limit))
    if (params.offset != null) search.set('offset', String(params.offset))
    const qs = search.toString()
    return apiRequest<NetworkLogsResponse>(`/api/v1/network/logs${qs ? `?${qs}` : ''}`)
  },
}
