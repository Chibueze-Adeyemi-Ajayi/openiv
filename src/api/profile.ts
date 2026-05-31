import { apiRequest, getBaseUrl } from './client'

export interface UserProfile {
  id: number
  email: string
  fullName: string | null
  jobTitle: string | null
  role: string
  accountType: string
  avatarUrl: string | null
  theme?: 'light' | 'dark'
  passwordUpdatedAt: string | null
  createdAt: string
  institutionName: string | null
  // Subscription — populated once an institution has a plan assigned
  planSlug?: 'starter' | 'growth' | 'scale' | 'enterprise'
  planName?: string
  monthlyPriceNgn?: number
  subscriptionStatus?: 'trial' | 'active' | 'past_due' | 'cancelled'
  trialEndsAt?: string | null
  subscriptionRenewsAt?: string | null
  // Per-feature flags from the plan
  featureKycEnabled?: boolean
  featureWebhooksEnabled?: boolean
  featureNetworkEnabled?: boolean
  featureBehavioralEnabled?: boolean
  featureReportsExport?: boolean
  maxAmlRules?: number
  maxActiveCases?: number          // -1 = unlimited
  maxMonthlyTransactions?: number
  maxMonthlyKycLookups?: number    // -1 = unlimited
  maxMonthlyNfiuFilings?: number   // -1 = unlimited
  maxMonthlyCases?: number         // -1 = unlimited
  maxUsers?: number
  // Current-period usage (reset every 30 days)
  monthlyTxnUsed?: number
  monthlyKycUsed?: number
  monthlyNfiuUsed?: number
  monthlyCasesUsed?: number
  usagePeriodStart?: string | null
}

export const profileApi = {
  get: () => apiRequest<UserProfile>('/api/v1/auth/profile'),
  update: (data: { fullName?: string; jobTitle?: string }) =>
    apiRequest<{ ok: boolean; fullName: string | null; jobTitle: string | null; avatarUrl: string | null }>(
      '/api/v1/auth/profile',
      { method: 'PUT', body: data }
    ),
  updateTheme: (theme: 'light' | 'dark') =>
    apiRequest<{ ok: boolean; theme: string }>(
      '/api/v1/auth/profile/theme',
      { method: 'PATCH', body: { theme } }
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
