import { apiRequest } from './client'

export const otpAlertsApi = {
  updateStatus: (id: number, status: 'released' | 'declined' | 'held') =>
    apiRequest<{ ok: boolean }>(`/api/v1/otp-alerts/${id}/status`, {
      method: 'PATCH',
      body: { status },
    }),
}
