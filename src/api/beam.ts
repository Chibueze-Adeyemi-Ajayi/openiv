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
  occurredAt?: string | null
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
    apiRequest<{
      ok: boolean;
      record_id: number;
      stream?: string;
      status?: string;
      analysis?: {
        // transaction stream (KYC-verified path)
        transaction_id?: string;
        risk_score?: number;
        kyc_risk_score?: number;
        risk_level?: string;
        recommended_action?: string;
        case_id?: string | null;
        priority?: string | null;
        account_conflict?: boolean;
        conflicting_customer_id?: string | null;
        processed_at?: string;
        // transaction stream (no-KYC path only)
        kyc_required?: boolean;
        notification_id?: number | null;
        message?: string | null;
        // institution_kyc_tier echoed back on transaction stream
        institution_kyc_tier?: number | null;
        // kyc stream
        customer_id?: string;
        kyc_status?: string;
        /** System-assessed knowledge level: "t1" | "t2" | "t3" */
        knowledge_level?: string;
        bvn_received?: boolean;
        nin_received?: boolean;
        photo_received?: boolean;
        pipeline_ms?: number;
      };
    }>(`/api/v1/beam/${stream}`, {
      method: 'POST',
      body: payload,
      headers: {
        'X-Idempotency-Key': Math.floor(Math.random() * 10000000).toString(),
      },
    }),
}
