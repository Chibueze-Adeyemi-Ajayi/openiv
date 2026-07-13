import { useCallback, useRef } from 'react'

/**
 * Debounces/guards an async submit handler against re-entry.
 *
 * Backstop for the `disabled={submitting}` pattern: React state updates are batched, so a fast
 * double- or triple-click can fire the same handler more than once before the button is
 * re-rendered as disabled. This hook uses a ref (synchronous) to short-circuit any call made
 * while the previous one is still in flight.
 *
 * Usage:
 * ```ts
 * const handleSubmit = useSubmitGuard(async (email: string, password: string) => {
 *   await authApi.login(email, password)
 *   navigate('/next')
 * })
 * ```
 *
 * Guarantees:
 * - If `fn` throws/rejects, the guard resets in `finally` so the user can retry.
 * - Returns `undefined` (silently dropped) when a call is suppressed — the caller does not
 *   need to distinguish a dropped call from a completed one.
 */
export function useSubmitGuard<Args extends unknown[]>(
  fn: (...args: Args) => Promise<unknown>,
): (...args: Args) => Promise<void> {
  const inFlightRef = useRef(false)
  return useCallback(
    async (...args: Args) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      try {
        await fn(...args)
      } finally {
        inFlightRef.current = false
      }
    },
    [fn],
  )
}
