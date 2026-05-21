import { apiRequest, getBaseUrl } from './client'

export interface UserProfile {
  id: number
  email: string
  fullName: string | null
  jobTitle: string | null
  role: string
  accountType: string
  avatarUrl: string | null
  passwordUpdatedAt: string | null
  createdAt: string
}

export const profileApi = {
  get: () => apiRequest<UserProfile>('/api/v1/auth/profile'),
  update: (data: { fullName?: string; jobTitle?: string }) =>
    apiRequest<{ ok: boolean; fullName: string | null; jobTitle: string | null; avatarUrl: string | null }>(
      '/api/v1/auth/profile',
      { method: 'PUT', body: data }
    ),
  changePassword: (current: string, next: string) =>
    apiRequest<{ ok: boolean }>('/api/v1/auth/password/change', {
      method: 'POST',
      body: { currentPassword: current, newPassword: next },
    }),
  uploadAvatar: async (file: File): Promise<{ ok: boolean; avatarUrl: string }> => {
    const form = new FormData()
    form.append('avatar', file)
    const res = await fetch(`${getBaseUrl()}/api/v1/auth/profile/avatar`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { detail?: string }
      throw new Error(body.detail ?? 'Upload failed')
    }
    return res.json()
  },
}
