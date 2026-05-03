/**
 * SessionSocketContext
 *
 * Opens a single WebSocket to /api/v1/ws/session and keeps it alive for the
 * duration of the authenticated dashboard session. The sole purpose of this
 * socket is to signal liveness to the backend: as long as the socket is open,
 * the backend considers this session active and will block concurrent logins
 * from other devices.
 *
 * Reconnection: exponential back-off, capped at 30 s, resets on success.
 * Torn down on unmount (logout / navigation away from dashboard).
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export interface SessionSocketState {
  connected: boolean
}

const INITIAL: SessionSocketState = { connected: false }
const SessionSocketContext = createContext<SessionSocketState>(INITIAL)

const BASE_RETRY_MS = 3_000
const MAX_RETRY_MS = 30_000
const WS_PATH = '/api/v1/ws/session'

export function SessionSocketProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionSocketState>(INITIAL)
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryDelayRef = useRef(BASE_RETRY_MS)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false

    function connect() {
      if (cancelledRef.current) return

      // Derive ws:// or wss:// from the current location.
      // In dev: browser is at localhost:5173, Vite proxy forwards ws:// to localhost:8081
      // In prod: same host as the app
      const protocol =
        window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const url = `${protocol}//${window.location.host}${WS_PATH}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelledRef.current) {
          ws.close()
          return
        }
        retryDelayRef.current = BASE_RETRY_MS // reset back-off on success
        setState({ connected: true })
      }

      ws.onmessage = () => {
        // Server may send a session_socket_ack or ping/pong frames.
        // No application-level action needed; connection staying alive is the signal.
      }

      ws.onclose = () => {
        wsRef.current = null
        if (cancelledRef.current) return
        setState({ connected: false })
        scheduleReconnect()
      }

      ws.onerror = () => {
        // onerror always precedes onclose; onclose handles the actual reconnect.
        // Log only in dev.
        if (import.meta.env.DEV) {
          console.debug('[SessionSocket] connection error')
        }
      }
    }

    function scheduleReconnect() {
      if (cancelledRef.current) return
      const delay = retryDelayRef.current
      retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_MS)
      retryRef.current = setTimeout(connect, delay)
    }

    connect()

    return () => {
      cancelledRef.current = true
      if (retryRef.current) clearTimeout(retryRef.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  return (
    <SessionSocketContext.Provider value={state}>
      {children}
    </SessionSocketContext.Provider>
  )
}

export function useSessionSocket(): SessionSocketState {
  return useContext(SessionSocketContext)
}
