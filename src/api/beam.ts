import { apiRequest } from './client'

export interface BeamApiKey {
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

export interface BeamRecord {
  id: number
  institutionId: number
  stream: string
  idempotencyKey: string | null
  payload: string
  status: string
  receivedAt: string
  riskScore?: number | null
  // Monitoring fields
  durationMs?: number | null
  ip?: string | null
  userAgent?: string | null
  responseCode?: number | null
  bytes?: number | null
}

export const beamApi = {
  getApiKeyInfo: () =>
    apiRequest<{ key: BeamApiKey | null }>('/api/v1/beam/api-key'),

  generateApiKey: () =>
    apiRequest<{ apiKey: string }>('/api/v1/beam/api-key', { method: 'POST' }),

  revokeApiKey: () =>
    apiRequest<{ ok: boolean }>('/api/v1/beam/api-key', { method: 'DELETE' }),

  listRecords: (params?: { stream?: string | null, q?: string, range?: string, page?: number, pageSize?: number }) => {
    const qs = new URLSearchParams()
    if (params?.stream) qs.append('stream', params.stream)
    if (params?.q) qs.append('q', params.q)
    if (params?.range) qs.append('range', params.range)
    if (params?.page) qs.append('page', params.page.toString())
    if (params?.pageSize) qs.append('pageSize', params.pageSize.toString())
    const qStr = qs.toString()
    return apiRequest<{ records: BeamRecord[], total: number }>(
      `/api/v1/beam/records${qStr ? `?${qStr}` : ''}`,
    )
  },

  sendTestPayload: (stream: string, payload: any) =>
    apiRequest<{ ok: boolean; recordId: number }>(`/api/v1/beam/${stream}`, {
      method: 'POST',
      body: payload,
      headers: {
        'X-Idempotency-Key': Math.floor(Math.random() * 10000000).toString(),
      },
    }),
}
