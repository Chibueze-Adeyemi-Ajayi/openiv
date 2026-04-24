import { apiRequest } from './client'

export interface WebhookEndpoint {
  id: number
  url: string
  description: string | null
  events: string[]
  status: 'active' | 'paused'
  successCount: number
  failureCount: number
  lastDeliveredAt: string | null
  createdAt: string
  updatedAt: string
}

export interface WebhookSecret {
  id: number
  secret: string
  autoRotate: boolean
  nextRotation: string
  updatedAt: string
}

export interface WebhookSecurityRule {
  id: number
  endpointId: number
  hasApiKey: boolean
  ipAllowlist: string | null
  timeoutSeconds: number
  maxRetries: number
  requireAck: boolean
  updatedAt: string
}

export interface WebhookDelivery {
  id: number
  endpointId: number
  eventType: string
  status: 'pending' | 'delivered' | 'failed'
  responseCode: number | null
  attemptCount: number
  deliveredAt: string | null
  createdAt: string
  deliveryId: string | null
  requestHeaders: string | null
  requestBody: string | null
  responseHeaders: string | null
  responseBody: string | null
  durationMs: number | null
  errorMessage: string | null
}

export interface TestResult {
  ok: boolean
  delivery: WebhookDelivery
  payload: Record<string, unknown>
  signature: string
}

export const webhookApi = {
  getSecret: () =>
    apiRequest<{ secret: WebhookSecret }>('/api/v1/webhooks/secret'),

  rotateSecret: () =>
    apiRequest<{ secret: WebhookSecret }>('/api/v1/webhooks/secret/rotate', { method: 'POST' }),

  updateSecret: (autoRotate: boolean) =>
    apiRequest<{ secret: WebhookSecret }>('/api/v1/webhooks/secret', {
      method: 'PATCH',
      body: { autoRotate },
    }),

  list: () =>
    apiRequest<{ endpoints: WebhookEndpoint[] }>('/api/v1/webhooks'),

  create: (url: string, description: string, events: string[]) =>
    apiRequest<{ endpoint: WebhookEndpoint }>('/api/v1/webhooks', {
      method: 'POST',
      body: { url, description, events },
    }),

  update: (id: number, data: { status?: string; events?: string[]; description?: string }) =>
    apiRequest<{ endpoint: WebhookEndpoint }>(`/api/v1/webhooks/${id}`, {
      method: 'PATCH',
      body: data,
    }),

  delete: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/webhooks/${id}`, { method: 'DELETE' }),

  test: (id: number) =>
    apiRequest<TestResult>(`/api/v1/webhooks/${id}/test`, { method: 'POST' }),

  deliveries: (id: number) =>
    apiRequest<{ deliveries: WebhookDelivery[] }>(`/api/v1/webhooks/${id}/deliveries`),

  listAllDeliveries: () =>
    apiRequest<{ deliveries: WebhookDelivery[] }>('/api/v1/webhooks/deliveries'),

  getSecurityRule: (id: number) =>
    apiRequest<{ rule: WebhookSecurityRule | null }>(`/api/v1/webhooks/${id}/security`),

  upsertSecurityRule: (
    id: number,
    data: { ipAllowlist?: string | null; timeoutSeconds?: number; maxRetries?: number; requireAck?: boolean },
  ) =>
    apiRequest<{ rule: WebhookSecurityRule }>(`/api/v1/webhooks/${id}/security`, {
      method: 'PUT',
      body: data,
    }),

  generateApiKey: (id: number) =>
    apiRequest<{ apiKey: string }>(`/api/v1/webhooks/${id}/security/api-key`, { method: 'POST' }),
}
