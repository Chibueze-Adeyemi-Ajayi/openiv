import { useCallback, useEffect, useRef } from 'react'
import { authApi } from '@/api/auth'
import { clearOnboardingState } from '@/onboarding/state'

const IDLE_MS      = 120 * 1000  // 2 min idle → logout
const CHANNEL_NAME = 'openiv_session'

type ChannelMsg = { type: 'logout' }

export default function InactivityGuard() {
  const idleTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const channelRef = useRef<BroadcastChannel | null>(null)

  const doLogout = useCallback(async () => {
    clearTimeout(idleTimer.current)
    try { await authApi.logout() } catch { /* ignore */ }
    clearOnboardingState()
    channelRef.current?.postMessage({ type: 'logout' } as ChannelMsg)
    window.location.replace('/auth/login?expired=1')
  }, [])

  const resetIdle = useCallback(() => {
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(doLogout, IDLE_MS)
  }, [doLogout])

  // Sync logout across tabs
  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL_NAME)
    channelRef.current = ch
    ch.onmessage = (evt: MessageEvent<ChannelMsg>) => {
      if (evt.data.type === 'logout') window.location.replace('/auth/login?expired=1')
    }
    return () => { ch.close(); channelRef.current = null }
  }, [])

  // Wire activity events + start idle timer
  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }))
    resetIdle()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdle))
      clearTimeout(idleTimer.current)
    }
  }, [resetIdle])

  return null
}
