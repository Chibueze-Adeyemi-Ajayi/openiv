/**
 * Thin wrapper — reads the activity slice from DashboardEventsContext.
 * The actual SSE connection lives in DashboardEventsProvider (DashboardLayout).
 */
import { useDashboardEvents } from '@/contexts/DashboardEventsContext'

// Re-exported so existing consumers (ActivityFeed.tsx) keep their import path.
export type { ActivityEventItem } from '@/contexts/DashboardEventsContext'

export function useActivityStream() {
  const { activity, connected } = useDashboardEvents()
  return { events: activity, connected }
}
