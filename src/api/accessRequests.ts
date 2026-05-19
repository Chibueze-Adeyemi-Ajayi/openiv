import { apiRequest } from './client'
import type { AccountType } from './auth'

export interface AccessRequestPayload {
  institutionName: string
  institutionType: AccountType
  contactName: string
  contactEmail: string
  contactPhone?: string
  jobTitle?: string
  description?: string
}

export interface AccessRequestAck {
  id: number
  status: string
}

export const accessRequestsApi = {
  submit: (payload: AccessRequestPayload) =>
    apiRequest<AccessRequestAck>('/api/v1/access-requests', { body: payload }),
}
