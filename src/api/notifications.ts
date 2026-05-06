import { apiRequest } from './client'

export interface NotificationItem {
  id:            number
  institutionId: number
  type:          string
  title:         string
  body:          string
  status:        'unread' | 'read'
  createdAt:     string
}

export type NotifSeverity = 'critical' | 'warning' | 'info' | 'success'

export function notifSeverity(type: string): NotifSeverity {
  if (type.startsWith('critical') || type === 'kyc_data_not_found' || type === 'cyber_breach_timestamp') return 'critical'
  if (type.startsWith('high') || type.startsWith('case_high') || type === 'kyc_webhook_missing') return 'warning'
  if (type.startsWith('case_') || type.startsWith('medium')) return 'info'
  return 'info'
}

export const notificationsApi = {
  list: (limit = 50) =>
    apiRequest<NotificationItem[]>(`/api/v1/notifications?limit=${limit}`),

  markRead: (id: number) =>
    apiRequest<{ ok: boolean }>(`/api/v1/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () =>
    apiRequest<{ marked: number }>('/api/v1/notifications/read-all', { method: 'PATCH' }),
}
