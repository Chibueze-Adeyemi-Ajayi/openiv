import { useEffect, useState, useCallback } from 'react'
import type { DashboardStats } from '@/api/dashboard'
import { getBaseUrl } from '@/api/client'

const DEMO_STATS: DashboardStats = {
  totalToday:       4_827,
  flaggedToday:     94,
  totalYesterday:   4_312,   // +12% trend shown on card
  flaggedYesterday: 71,      // +32% trend shown on card
  openCases:        23,
  openCasesToday:   7,       // vs 4 yesterday implied by openCases delta
}

export interface OtpAlert {
  id: number
  rule: 'FAILED_CASCADE' | 'OTP_BOMBING' | 'VELOCITY_SPIKE' | 'NEW_DEVICE_SUSPICIOUS'
  severity: 'critical' | 'warning'
  customerId: string | null
  deviceId: string | null
  channel: string | null
  otpType: string | null
  eventCount: number
  detail: string
  firedAt: string
  riskScore: number
  reasons: string[]
}

export interface ActivityEvent {
  id: number
  source: string
  severity: 'critical' | 'warning' | 'info' | 'resolved'
  title: string
  detail: string | null
  entityId: string | null
  entityType: string | null
  actor: string
  occurredAt: string
}

export interface DashboardData {
  stats: DashboardStats | null
  activity: ActivityEvent[]
  otpAlerts: OtpAlert[]
  beamEvents: ActivityEvent[]
  caseEvents: ActivityEvent[]
  connected: boolean
  error: string | null
}

const INITIAL_STATE: DashboardData = {
  stats: DEMO_STATS,   // show demo numbers immediately; real non-zero stats override below
  activity: [],
  otpAlerts: [],
  beamEvents: [],
  caseEvents: [],
  connected: false,
  error: null,
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>(INITIAL_STATE)

  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let retryDelay = 3000
    const maxRetryDelay = 30000

    function connect() {
      if (reconnectTimer) clearTimeout(reconnectTimer)

      const url = `${getBaseUrl()}/api/v1/dashboard/events`
      console.log('[useDashboardData] Connecting to SSE:', url)

      es = new EventSource(url, { withCredentials: true })

      es.onopen = () => {
        console.log('[useDashboardData] SSE connected')
        setData(prev => ({ ...prev, connected: true, error: null }))
        retryDelay = 3000
      }

      es.addEventListener('stats', (e: MessageEvent) => {
        try {
          const stats: DashboardStats = JSON.parse(e.data)
          console.log('[useDashboardData] stats received:', stats)
          // Only replace demo stats when the tenant has real transactions today
          const hasRealData = stats.totalToday > 0
          setData(prev => ({
            ...prev,
            stats: hasRealData ? stats : prev.stats,
            connected: true,
          }))
        } catch (err) {
          console.error('[useDashboardData] stats parse error:', err)
        }
      })

      es.addEventListener('activityInit', (e: MessageEvent) => {
        try {
          const activity = JSON.parse(e.data)
          console.log('[useDashboardData] activityInit:', activity.length, 'events')
          setData(prev => ({ ...prev, activity }))
        } catch (err) {
          console.error('[useDashboardData] activityInit parse error:', err)
        }
      })

      es.addEventListener('activityUpdate', (e: MessageEvent) => {
        try {
          const newEvents = JSON.parse(e.data)
          console.log('[useDashboardData] activityUpdate:', newEvents.length, 'new events')
          setData(prev => ({
            ...prev,
            activity: [...newEvents, ...prev.activity].slice(0, 50),
          }))
        } catch (err) {
          console.error('[useDashboardData] activityUpdate parse error:', err)
        }
      })

      es.addEventListener('otpInit', (e: MessageEvent) => {
        try {
          const otpAlerts = JSON.parse(e.data)
          console.log('[useDashboardData] otpInit:', otpAlerts.length, 'alerts')
          setData(prev => ({ ...prev, otpAlerts }))
        } catch (err) {
          console.error('[useDashboardData] otpInit parse error:', err)
        }
      })

      es.addEventListener('otpUpdate', (e: MessageEvent) => {
        try {
          const newAlerts = JSON.parse(e.data)
          console.log('[useDashboardData] otpUpdate:', newAlerts.length, 'new alerts')
          setData(prev => ({
            ...prev,
            otpAlerts: [...newAlerts, ...prev.otpAlerts].slice(0, 50),
          }))
        } catch (err) {
          console.error('[useDashboardData] otpUpdate parse error:', err)
        }
      })

      es.addEventListener('beamEvents', (e: MessageEvent) => {
        try {
          const events = JSON.parse(e.data)
          console.log('[useDashboardData] beamEvents:', events.length, 'events')
          setData(prev => ({ ...prev, beamEvents: events }))
        } catch (err) {
          console.error('[useDashboardData] beamEvents parse error:', err)
        }
      })

      es.addEventListener('caseEvents', (e: MessageEvent) => {
        try {
          const events = JSON.parse(e.data)
          console.log('[useDashboardData] caseEvents:', events.length, 'cases')
          setData(prev => ({ ...prev, caseEvents: events }))
        } catch (err) {
          console.error('[useDashboardData] caseEvents parse error:', err)
        }
      })

      es.onerror = () => {
        console.error('[useDashboardData] SSE error, reconnecting...')
        es?.close()
        es = null
        setData(prev => ({ ...prev, connected: false, error: 'Connection lost' }))

        reconnectTimer = setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 2, maxRetryDelay)
      }
    }

    connect()

    return () => {
      if (es) es.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [])

  return data
}
