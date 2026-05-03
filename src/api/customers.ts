import { apiRequest } from './client'

export interface Customer {
  id: number
  institutionId: number
  externalId: string
  name: string
  email: string | null
  phone: string | null
  riskScore: number
  createdAt: string
  updatedAt: string
}

export const customerApi = {
  getCustomer: (externalId: string) =>
    apiRequest<Customer>(`/api/v1/customers/${externalId}`),
}
