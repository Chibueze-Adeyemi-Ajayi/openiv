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
}

export const beamApi = {
  getApiKeyInfo: () =>
    apiRequest<{ key: BeamApiKey | null }>('/api/v1/beam/api-key'),

  generateApiKey: () =>
    apiRequest<{ apiKey: string }>('/api/v1/beam/api-key', { method: 'POST' }),

  revokeApiKey: () =>
    apiRequest<{ ok: boolean }>('/api/v1/beam/api-key', { method: 'DELETE' }),

  listRecords: (stream?: string) =>
    apiRequest<{ records: BeamRecord[] }>(
      `/api/v1/beam/records${stream ? `?stream=${encodeURIComponent(stream)}` : ''}`,
    ),
}
