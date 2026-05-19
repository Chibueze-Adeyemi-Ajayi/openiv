import { apiRequest } from './client'

export interface InstitutionAlert {
  id: number
  alertType: string
  title: string
  message: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'investigating' | 'resolved'
  metadata: {
    surgePct?: number
    todayCount?: number
    expectedCount?: number
  }
  createdAt: string
  updatedAt: string
}

export interface SuspectCustomer {
  customerId: number
  customerName: string
  overallRiskScore: number
  txnCount: number
  totalAmount: number
  avgRiskScore: number
  flaggedCount: number
  casedCount: number
}

export const institutionAlertsApi = {
  list: () =>
    apiRequest<{ alerts: InstitutionAlert[] }>('/api/v1/institution-alerts'),

  updateStatus: (id: number, status: 'open' | 'investigating' | 'resolved') =>
    apiRequest<{ alert: InstitutionAlert }>(`/api/v1/institution-alerts/${id}/status`, {
      method: 'PATCH',
      body: { status },
    }),

  investigate: (id: number) =>
    apiRequest<{ alert: InstitutionAlert; suspects: SuspectCustomer[]; analysedAt: string }>(
      `/api/v1/institution-alerts/${id}/investigate`
    ),
}
