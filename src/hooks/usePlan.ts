import { useProfile } from '@/contexts/ProfileContext'
import type { UserProfile } from '@/api/profile'

export type PlanFeature =
  | 'kyc'
  | 'webhooks'
  | 'network'
  | 'behavioral'
  | 'reports_export'
  | 'ai'

export type PlanResource = 'cases' | 'transactions' | 'users'

export interface PlanInfo {
  slug: 'starter' | 'growth' | 'enterprise' | null
  name: string | null
  status: string | null
  trialEndsAt: string | null
  /** Returns true if the plan permits this feature */
  canUse: (feature: PlanFeature) => boolean
  /** -1 = unlimited */
  maxActiveCases: number
  maxMonthlyTransactions: number
  maxMonthlyKycLookups: number
  maxUsers: number
  maxAmlRules: number
  /** Current-period usage counts (reset every 30 days) */
  monthlyTxnUsed: number
  monthlyKycUsed: number
  usagePeriodStart: string | null
  isLoaded: boolean
}

function resolve(profile: UserProfile | null, key: keyof UserProfile, fallback: boolean): boolean {
  if (!profile) return fallback
  const v = profile[key]
  if (typeof v === 'boolean') return v
  return fallback
}

export function usePlan(): PlanInfo {
  const { profile } = useProfile()

  const slug = (profile?.planSlug ?? null) as PlanInfo['slug']
  const isLoaded = !!profile && !!slug

  // When no plan data is present yet, default permissively so UI doesn't flicker
  const canUse = (feature: PlanFeature): boolean => {
    if (!isLoaded) return true
    switch (feature) {
      case 'kyc':            return resolve(profile, 'featureKycEnabled',        true)
      case 'webhooks':       return resolve(profile, 'featureWebhooksEnabled',   true)
      case 'network':        return resolve(profile, 'featureNetworkEnabled',    true)
      case 'behavioral':     return resolve(profile, 'featureBehavioralEnabled', true)
      case 'reports_export': return resolve(profile, 'featureReportsExport',     true)
      case 'ai':             return resolve(profile, 'aiFeaturesEnabled',        false)
    }
  }

  return {
    slug,
    name:                   profile?.planName ?? null,
    status:                 profile?.subscriptionStatus ?? null,
    trialEndsAt:            profile?.trialEndsAt ?? null,
    canUse,
    maxActiveCases:         profile?.maxActiveCases         ?? -1,
    maxMonthlyTransactions: profile?.maxMonthlyTransactions ?? -1,
    maxMonthlyKycLookups:   profile?.maxMonthlyKycLookups   ?? -1,
    maxUsers:               profile?.maxUsers               ?? -1,
    maxAmlRules:            profile?.maxAmlRules            ?? 29,
    monthlyTxnUsed:         profile?.monthlyTxnUsed         ?? 0,
    monthlyKycUsed:         profile?.monthlyKycUsed         ?? 0,
    usagePeriodStart:       profile?.usagePeriodStart       ?? null,
    isLoaded,
  }
}
