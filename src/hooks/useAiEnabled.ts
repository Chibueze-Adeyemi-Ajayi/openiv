import { isAiEnabled as buildFlagEnabled } from '@/utils/build'

/**
 * Gated by build flag only — Eureka AI backend is not yet shipped.
 * Re-wire to plan flag once subscription_plans.ai_features_enabled
 * (or equivalent) returns to the model.
 */
export function useAiEnabled(): boolean {
  return buildFlagEnabled
}
