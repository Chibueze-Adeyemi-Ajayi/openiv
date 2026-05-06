/**
 * DashboardEventsContext
 *
 * Manages a single SSE connection to GET /api/v1/dashboard/events and
 * distributes all three live streams (stats, activity, OTP alerts) via React
 * context. Every dashboard component that needs live data reads from this
 * context — never opens its own connection.
 *
 * Event protocol (server → client):
 *   stats          — DashboardStats snapshot, every 5 s
 *   activityInit   — ActivityEventItem[], last 30, on connect
 *   activityUpdate — ActivityEventItem[], incremental, every 5 s if new
 *   otpInit        — OtpAlertItem[], last 30, on connect
 *   otpUpdate      — OtpAlertItem[], incremental, every 5 s if new
 *   :\n\n          — heartbeat comment, every 20 s
 *
 * Reconnection: exponential back-off, capped at 30 s, resets on success.
 * The connection is torn down when the provider unmounts (page leave / logout).
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { DashboardStats } from '@/api/dashboard'
import type { NotificationItem } from '@/api/notifications'
import { getBaseUrl } from '@/api/client'

// ── Shared types ──────────────────────────────────────────────────────────────

export interface ActivityEventItem {
  id:         number
  source:     string
  severity:   'critical' | 'warning' | 'info' | 'resolved'
  title:      string
  detail:     string | null
  entityId:   string | null
  entityType: string | null
  actor:      string
  occurredAt: string
}

export interface OtpAlertItem {
  id:                 number
  rule:               'FAILED_CASCADE' | 'OTP_BOMBING' | 'VELOCITY_SPIKE' | 'NEW_DEVICE_SUSPICIOUS'
  severity:           'critical' | 'warning'
  customerId:         string | null
  deviceId:           string | null
  channel:            string | null
  otpType:            string | null
  eventCount:         number
  detail:             string
  firedAt:            string
  // enrichment fields (populated when the beam OTP stream carries them)
  customerName:       string | null
  msisdn:             string | null
  ip:                 string | null
  txnLat:             number | null
  txnLng:             number | null
  amount:             number | null
  beneficiaryAccount: string | null
  deviceModel:        string | null
  transactionId:      string | null
  riskScore:          number
  reasons:            string[]
  status:             'pending' | 'held' | 'released' | 'declined'
  expiresAt:          string | null
  customerLat:        number | null
  customerLng:        number | null
  distanceKm:         number | null
}

export interface SecurityEvent {
  type:        'login_attempt'
  userId:      number
  ip:          string | null
  userAgent:   string | null
  deviceId:    string | null
  at:          string
}

export interface GeoAccessRequestItem {
  id:           number
  userId:       number
  userEmail:    string
  userFullName: string | null
  rawLat:       number | null
  rawLng:       number | null
  ip:           string | null
  userAgent:    string | null
  deviceId:     string | null
  status:       'pending' | 'approved' | 'rejected'
  expiresAt:    string | null
  createdAt:    string
}

// ── Context shape ─────────────────────────────────────────────────────────────

export interface DashboardEventsState {
  stats:              DashboardStats | null
  activity:           ActivityEventItem[]
  otpAlerts:          OtpAlertItem[]
  securityEvents:     SecurityEvent[]
  geoAccessRequests:  GeoAccessRequestItem[]
  notifications:      NotificationItem[]
  connected:          boolean
  error:              boolean
}

const INITIAL: DashboardEventsState = {
  stats: null, activity: [], otpAlerts: [], securityEvents: [],
  geoAccessRequests: [], notifications: [], connected: false, error: false,
}

const DashboardEventsContext = createContext<DashboardEventsState>(INITIAL)

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ITEMS       = 50
const BASE_RETRY_MS   = 3_000
const MAX_RETRY_MS    = 30_000
const SSE_URL         = '/api/v1/dashboard/events'

// ── Provider ──────────────────────────────────────────────────────────────────

export function DashboardEventsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DashboardEventsState>(INITIAL)
  const esRef             = useRef<EventSource | null>(null)
  const retryRef          = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryDelayRef     = useRef(BASE_RETRY_MS)
  const cancelledRef      = useRef(false)

  // Debug: log state changes
  console.log('[DashboardEventsProvider] RENDER with state:', state)
  useEffect(() => {
    console.log('[DashboardEventsProvider] state updated:', state)
  }, [state])

  useEffect(() => {
    cancelledRef.current = false

    function connect() {
      if (cancelledRef.current) return

      const url = `${getBaseUrl()}${SSE_URL}`
      console.log('[Dashboard SSE] Connecting to:', url)
      const es = new EventSource(url, { withCredentials: true })
      esRef.current = es

      es.onopen = () => {
        console.log('[Dashboard SSE] Connection opened')
        if (cancelledRef.current) { es.close(); return }
        retryDelayRef.current = BASE_RETRY_MS           // reset back-off on success
        setState(s => ({ ...s, connected: true, error: false }))
      }

      // ── Stats ───────────────────────────────────────────────────────────
      console.log('[Dashboard SSE] Adding stats event listener')
      es.addEventListener('stats', (e: MessageEvent) => {
        console.log('[Dashboard SSE] stats event received, data:', e.data)
        if (cancelledRef.current) return
        try {
          const stats: DashboardStats = JSON.parse(e.data)
          console.log('[Dashboard SSE] stats parsed:', stats)
          setState(s => {
            console.log('[Dashboard SSE] setState called with stats:', stats)
            return { ...s, stats, connected: true, error: false }
          })
        } catch (err) {
          console.error('[Dashboard SSE] stats parse error:', err, 'data:', e.data)
        }
      })

      // ── Activity: full initial batch ────────────────────────────────────
      es.addEventListener('activityInit', (e: MessageEvent) => {
        if (cancelledRef.current) return
        try {
          const items: ActivityEventItem[] = JSON.parse(e.data)
          setState(s => ({ ...s, activity: items.slice(0, MAX_ITEMS) }))
        } catch { /* ignore */ }
      })

      // ── Activity: incremental (deduplicated by ID) ──────────────────────
      es.addEventListener('activityUpdate', (e: MessageEvent) => {
        if (cancelledRef.current) return
        try {
          const incoming: ActivityEventItem[] = JSON.parse(e.data)
          if (!incoming.length) return
          setState(s => {
            const seen  = new Set(s.activity.map(x => x.id))
            const fresh = incoming.filter(x => !seen.has(x.id))
            if (!fresh.length) return s
            return { ...s, activity: [...fresh, ...s.activity].slice(0, MAX_ITEMS) }
          })
        } catch { /* ignore */ }
      })

      // ── OTP alerts: full initial batch ──────────────────────────────────
      es.addEventListener('otpInit', (e: MessageEvent) => {
        if (cancelledRef.current) return
        try {
          const items: OtpAlertItem[] = JSON.parse(e.data)
          setState(s => ({ ...s, otpAlerts: items.slice(0, MAX_ITEMS) }))
        } catch { /* ignore */ }
      })

      // ── OTP alerts: incremental (deduplicated by ID) ────────────────────
      es.addEventListener('otpUpdate', (e: MessageEvent) => {
        if (cancelledRef.current) return
        try {
          const incoming: OtpAlertItem[] = JSON.parse(e.data)
          if (!incoming.length) return
          setState(s => {
            const seen  = new Set(s.otpAlerts.map(x => x.id))
            const fresh = incoming.filter(x => !seen.has(x.id))
            if (!fresh.length) return s
            return { ...s, otpAlerts: [...fresh, ...s.otpAlerts].slice(0, MAX_ITEMS) }
          })
        } catch { /* ignore */ }
      })

      // ── Security events (login attempts from other devices) ────────────
      es.addEventListener('securityEvent', (e: MessageEvent) => {
        if (cancelledRef.current) return
        try {
          const evt: SecurityEvent = JSON.parse(e.data)
          setState(s => ({ ...s, securityEvents: [evt, ...s.securityEvents].slice(0, 20) }))
        } catch { /* ignore */ }
      })

      // ── Geo-access requests: full initial batch (admin only) ────────────
      es.addEventListener('geoRequestInit', (e: MessageEvent) => {
        if (cancelledRef.current) return
        try {
          const items: GeoAccessRequestItem[] = JSON.parse(e.data)
          setState(s => ({ ...s, geoAccessRequests: items.slice(0, 20) }))
        } catch { /* ignore */ }
      })

      // ── Geo-access requests: new request pushed in real-time ───────────
      es.addEventListener('geoRequest', (e: MessageEvent) => {
        if (cancelledRef.current) return
        try {
          const req: GeoAccessRequestItem = JSON.parse(e.data)
          setState(s => {
            const seen = new Set(s.geoAccessRequests.map(x => x.id))
            if (seen.has(req.id)) return s
            return { ...s, geoAccessRequests: [req, ...s.geoAccessRequests].slice(0, 20) }
          })
        } catch { /* ignore */ }
      })

      // ── Notifications: full initial batch on connect ─────────────────
      es.addEventListener('notifInit', (e: MessageEvent) => {
        if (cancelledRef.current) return
        try {
          const items: NotificationItem[] = JSON.parse(e.data)
          setState(s => ({ ...s, notifications: items.slice(0, MAX_ITEMS) }))
        } catch { /* ignore */ }
      })

      // ── Notifications: new notification pushed in real-time ──────────
      es.addEventListener('notifUpdate', (e: MessageEvent) => {
        if (cancelledRef.current) return
        try {
          const incoming: NotificationItem[] = JSON.parse(e.data)
          if (!incoming.length) return
          setState(s => {
            const seen  = new Set(s.notifications.map(x => x.id))
            const fresh = incoming.filter(x => !seen.has(x.id))
            if (!fresh.length) return s
            return { ...s, notifications: [...fresh, ...s.notifications].slice(0, MAX_ITEMS) }
          })
        } catch { /* ignore */ }
      })

      // ── Error / reconnect ───────────────────────────────────────────────
      es.onerror = () => {
        es.close()
        esRef.current = null
        if (cancelledRef.current) return
        setState(s => ({ ...s, connected: false, error: true }))
        const delay = retryDelayRef.current
        retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_MS)
        retryRef.current = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      cancelledRef.current = true
      if (retryRef.current) clearTimeout(retryRef.current)
      esRef.current?.close()
      esRef.current = null
    }
  }, [])

  const markNotifRead = (id: number) =>
    setState(s => ({
      ...s,
      notifications: s.notifications.map(n => n.id === id ? { ...n, status: 'read' } : n),
    }))

  const markAllNotifsRead = () =>
    setState(s => ({
      ...s,
      notifications: s.notifications.map(n => ({ ...n, status: 'read' })),
    }))

  return (
    <DashboardEventsContext.Provider value={state}>
      <DashboardEventsMutContext.Provider value={{ markNotifRead, markAllNotifsRead }}>
        {children}
      </DashboardEventsMutContext.Provider>
    </DashboardEventsContext.Provider>
  )
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useDashboardEvents(): DashboardEventsState {
  return useContext(DashboardEventsContext)
}

const DashboardEventsMutContext = createContext<{
  markNotifRead: (id: number) => void
  markAllNotifsRead: () => void
}>({ markNotifRead: () => {}, markAllNotifsRead: () => {} })

export function useDashboardEventsMut() {
  return useContext(DashboardEventsMutContext)
}
