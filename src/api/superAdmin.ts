import { apiRequest } from './client'

export interface AccessRequestItem {
  id: number
  institutionName: string
  institutionType: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  jobTitle?: string
  description?: string
  status: 'pending' | 'approved' | 'rejected'
  reviewNotes?: string
  reviewedAt?: string
  createdAt: string
}

export interface InstitutionItem {
  id: number
  name: string
  type: string
  status: 'active' | 'suspended'
  cbnCode?: string
  address?: string
  contactPhone?: string
  createdAt: string
}

export interface ApproveResult {
  institutionId: number
  institutionName: string
  invitationId: number
}

export const superAdminApi = {
  listRequests: (status?: string) =>
    apiRequest<{ requests: AccessRequestItem[] }>(
      `/api/v1/superadmin/access-requests${status ? `?status=${status}` : ''}`
    ),

  getRequest: (id: number) =>
    apiRequest<AccessRequestItem>(`/api/v1/superadmin/access-requests/${id}`),

  approveRequest: (id: number, notes?: string) =>
    apiRequest<ApproveResult>(`/api/v1/superadmin/access-requests/${id}/approve`, {
      method: 'POST',
      body: { notes: notes ?? null },
    }),

  rejectRequest: (id: number, notes?: string) =>
    apiRequest<AccessRequestItem>(`/api/v1/superadmin/access-requests/${id}/reject`, {
      method: 'POST',
      body: { notes: notes ?? null },
    }),

  listInstitutions: () =>
    apiRequest<{ institutions: InstitutionItem[] }>('/api/v1/superadmin/institutions'),

  getInstitution: (id: number) =>
    apiRequest<InstitutionItem>(`/api/v1/superadmin/institutions/${id}`),

  updateInstitutionStatus: (id: number, status: 'active' | 'suspended') =>
    apiRequest<InstitutionItem>(`/api/v1/superadmin/institutions/${id}/status`, {
      method: 'PATCH',
      body: { status },
    }),
}
