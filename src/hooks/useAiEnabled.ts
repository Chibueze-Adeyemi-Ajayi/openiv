import { useProfile } from '@/contexts/ProfileContext'
import { isAiEnabled as buildFlagEnabled } from '@/utils/build'

/**
 * Returns true only when BOTH the build flag allows AI AND the institution's
 * subscription plan has aiFeaturesEnabled = true.
 *
 * Falls back to the build flag alone when the profile hasn't loaded yet
 * (plan field absent), so AI doesn't flash on then off.
 */
export function useAiEnabled(): boolean {
  const { profile } = useProfile()

  // Build flag is authoritative for dev/staging overrides
  if (!buildFlagEnabled) return false

  // Once profile has loaded, honour the plan's runtime flag
  if (profile && typeof profile.aiFeaturesEnabled === 'boolean') {
    return profile.aiFeaturesEnabled
  }

  // Profile not yet loaded — optimistic default matches build flag
  return buildFlagEnabled
}
