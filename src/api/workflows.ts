import { apiRequest } from './client'

export type WorkflowStatus = 'draft' | 'pending_approval' | 'active' | 'retired'

export interface WorkflowBlock {
  type: string
  weight?: number
  config?: Record<string, unknown>
}

export interface WorkflowSchedule {
  highDays: number
  mediumDays: number
  lowDays: number
}

export interface Workflow {
  id: number
  name: string
  version: number
  status: WorkflowStatus
  blocks: WorkflowBlock[]
  schedule: WorkflowSchedule
  scheduleEnabled: boolean
  rescheduleDays: number | null
  caseRiskThreshold: number
  createdBy: number
  approvedBy: number | null
  createdAt: string
  updatedAt: string
}

export interface WorkflowRun {
  id: number
  version: number
  trigger: 'scheduled' | 'manual' | 'import'
  status: 'running' | 'completed' | 'failed'
  totalCustomers: number
  clearCount: number
  matchCount: number
  errorCount: number
  startedAt: string
  finishedAt: string | null
}

export interface WorkflowRunItem {
  id: number
  customerId: string
  stepResults: {
     type: string; status: string; detail: string; ms: number; score?: number | null 
}[]
  outcome: 'clear' | 'match' | 'error' | 'skipped'
  error: string | null
  createdAt: string
}

export const workflowApi = {
  list: () =>
    apiRequest<{ workflows: Workflow[] }>('/api/v1/workflows'),

  get: (id: number) =>
    apiRequest<{ workflow: Workflow }>(`/api/v1/workflows/${id}`),

  create: (name: string, blocks: WorkflowBlock[], schedule?: WorkflowSchedule) =>
    apiRequest<{ workflow: Workflow }>('/api/v1/workflows', {
      method: 'POST',
      body: { name, blocks, schedule },
    }),

  update: (id: number, name: string, blocks: WorkflowBlock[], schedule: WorkflowSchedule, scheduleEnabled: boolean, rescheduleDays: number | null, caseRiskThreshold: number) =>
    apiRequest<{ workflow: Workflow }>(`/api/v1/workflows/${id}`, {
      method: 'PUT',
      body: { name, blocks, schedule, scheduleEnabled, rescheduleDays, caseRiskThreshold },
    }),

  submit: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/workflows/${id}/submit`, { method: 'POST' }),

  approve: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/workflows/${id}/approve`, { method: 'POST' }),

  retire: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/workflows/${id}/retire`, { method: 'POST' }),

  newVersion: (id: number) =>
    apiRequest<{ workflow: Workflow }>(`/api/v1/workflows/${id}/new-version`, { method: 'POST' }),

  runNow: (id: number) =>
    apiRequest<{ runId: number }>(`/api/v1/workflows/${id}/run`, { method: 'POST' }),

  payloadSchema: (id: number) =>
    apiRequest<{ schema: { type: string; required: string[] } }>(`/api/v1/workflows/${id}/payload-schema`),

  estimate: (id: number) =>
    apiRequest<{ tierCounts: { high: number; medium: number; low: number }; estimatedScreeningsPerMonth: number }>(
      `/api/v1/workflows/${id}/estimate`),

  listRuns: (id: number) =>
    apiRequest<{ runs: WorkflowRun[] }>(`/api/v1/workflows/${id}/runs`),

  listRunItems: (runId: number, limit = 50, offset = 0) =>
    apiRequest<{ items: WorkflowRunItem[] }>(
      `/api/v1/workflow-runs/${runId}/items?limit=${limit}&offset=${offset}`),

  delete: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/workflows/${id}`, { method: 'DELETE' }),

  enrichmentCount: () =>
    apiRequest<{ count: number }>('/api/v1/workflows/enrichment-count'),
}
