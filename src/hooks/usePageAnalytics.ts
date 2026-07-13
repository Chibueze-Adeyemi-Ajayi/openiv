import { useEffect } from 'react'
import { BASE_URL } from '@/api/client'

const DEVICE_ID_KEY = 'openiv_did'

function getOrCreateId(key: string, storage: Storage): string {
  let id = storage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    storage.setItem(key, id)
  }
  return id
}

function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile'
  if (/iPad|Tablet/i.test(ua))              return 'tablet'
  return 'desktop'
}

export function usePageAnalytics(page = '/') {
  useEffect(() => {
    const sessionId  = getOrCreateId('openiv_sid', sessionStorage)
    const deviceId   = getOrCreateId(DEVICE_ID_KEY, localStorage)
    const deviceType = detectDeviceType()
    const startMs    = Date.now()
    let   activeMs   = 0
    let   visibleAt  = document.visibilityState === 'visible' ? Date.now() : null

    // Fire visit event
    fetch(`${BASE_URL}/api/v1/analytics/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        deviceId,
        page,
        referrer:   document.referrer || '',
        userAgent:  navigator.userAgent,
        deviceType,
      }),
      keepalive: true,
    }).catch(() => { /* non-critical */ })

    // Track active (visible) time
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (visibleAt !== null) { activeMs += Date.now() - visibleAt; visibleAt = null }
        sendLeave()
      } else {
        visibleAt = Date.now()
      }
    }

    const sendLeave = () => {
      const elapsed = visibleAt !== null ? activeMs + (Date.now() - visibleAt) : activeMs
      const secs    = Math.round(elapsed / 1000)
      if (secs < 1) return
      navigator.sendBeacon(
        `${BASE_URL}/api/v1/analytics/leave`,
        JSON.stringify({ sessionId, timeSpentSeconds: secs }),
      )
    }

    const onUnload = () => {
      if (visibleAt !== null) activeMs += Date.now() - visibleAt
      sendLeave()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onUnload)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onUnload)
      // Final flush on SPA unmount
      if (visibleAt !== null) activeMs += Date.now() - visibleAt
      const secs = Math.round(activeMs / 1000)
      if (secs >= 1) {
        navigator.sendBeacon(
          `${BASE_URL}/api/v1/analytics/leave`,
          JSON.stringify({ sessionId, timeSpentSeconds: secs }),
        )
      }
    }
  }, [page])
}
