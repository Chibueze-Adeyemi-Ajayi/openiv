/**
 * Thin wrapper — reads the stats slice from DashboardEventsContext.
 * The actual SSE connection lives in DashboardEventsProvider (DashboardLayout).
 */
import { useDashboardEvents } from '@/contexts/DashboardEventsContext'
import type { DashboardStats } from '@/api/dashboard'

export type { DashboardStats }

export interface DashboardStreamState {
  stats:     DashboardStats | null
  connected: boolean
  error:     string | null
}

export function useDashboardStream(): DashboardStreamState {
  const { stats, connected, error } = useDashboardEvents()
  return { stats, connected, error: error ? 'Reconnecting…' : null }
}
