/**
 * Thin wrapper — reads the OTP alerts slice from DashboardEventsContext.
 * The actual SSE connection lives in DashboardEventsProvider (DashboardLayout).
 */
import { useDashboardEvents } from '@/contexts/DashboardEventsContext'

// Re-exported so existing consumers (OtpAlertsPanel.tsx) keep their import path.
export type { OtpAlertItem } from '@/contexts/DashboardEventsContext'

export function useOtpAlerts() {
  const { otpAlerts, connected, error } = useDashboardEvents()
  return { alerts: otpAlerts, connected, error }
}
