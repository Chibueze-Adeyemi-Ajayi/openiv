import { apiRequest } from './client'
import type { AccountType } from './auth'

export type TeamRoleId = string // Support custom- prefixes

export interface TeamMember {
  id: number
  email: string
  name: string
  initials: string
  role: TeamRoleId
  status: 'pending' | 'active' | 'disabled' | 'locked'
  accountType?: AccountType
  emailVerified: boolean
  lastActive: string
  createdAt: string
}

export interface TeamPending {
  id: number
  email: string
  role: TeamRoleId
  invitedBy?: string
  invitedOn?: string
  expiresAt?: string
  status?: string
}

export interface TeamRole {
  id: TeamRoleId
  name: string
  description: string
  color: string
  members?: number
  permissions?: Record<string, boolean>
}

export const teamApi = {
  listMembers: () => apiRequest<{ members: TeamMember[] }>('/api/v1/team/members'),
  listPending: () => apiRequest<{ pending: TeamPending[] }>('/api/v1/team/pending'),
  listRoles: () => apiRequest<{ roles: TeamRole[] }>('/api/v1/team/roles'),

  invite: (email: string, role: TeamRoleId) =>
    apiRequest<TeamPending>('/api/v1/team/invite', { body: { email, role } }),

  removeMember: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/team/members/${id}`, { method: 'DELETE' }),

  revokePending: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/team/pending/${id}`, { method: 'DELETE' }),

  resendPending: (id: number) =>
    apiRequest<TeamPending>(`/api/v1/team/pending/${id}/resend`, { method: 'POST' }),

  saveRole: (role: TeamRole) =>
    apiRequest<{ ok: boolean }>('/api/v1/team/custom-roles', { method: 'POST', body: role }),

  deleteRole: (id: string) =>
    apiRequest<{ ok: boolean }>(`/api/v1/team/custom-roles/${id}`, { method: 'DELETE' }),
}
