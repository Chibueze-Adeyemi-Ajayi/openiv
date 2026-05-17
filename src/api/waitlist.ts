import { apiRequest } from './client'

export interface WaitlistEntry {
  id: number
  name: string
  email: string
  description: string | null
  source: string
  createdAt: string
}

export const waitlistApi = {
  join: (payload: { name: string; email: string; description?: string }) =>
    apiRequest<{ id: number; createdAt: string }>('/api/v1/waitlist', { body: payload }),

  list: () =>
    apiRequest<{ entries: WaitlistEntry[] }>('/api/v1/waitlist'),
}
