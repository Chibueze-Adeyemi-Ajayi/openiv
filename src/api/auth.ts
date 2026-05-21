/**
 * Typed wrappers over the /api/v1/auth endpoints.
 * Shapes mirror `backend/src/main/resources/openapi.yaml`.
 */

import { apiRequest } from './client'
import type { SessionState } from '@/onboarding/state'

export type AccountType = 'INDIVIDUAL' | 'COMPANY' | 'REGULATOR'

export interface InviteVerifyResponse {
  email: string // masked
  accountType: AccountType
}

export interface LoginResponse {
  state: SessionState
  accountType: AccountType
  fullName?: string
}

export interface SessionStateResponse {
  state: SessionState
  accountType?: AccountType
  email?: string
  role?: string
  fullName?: string
  timezone?: string
  userId?: number
}

export interface TotpEnrollment {
  secret: string
  otpauthUri: string
}

export interface ResetVerifyResponse {
  resetToken: string
}

const DEVICE_ID_KEY = 'openiv_device_id'

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export interface SessionConflictError {
  detail: 'active_session_same_device' | 'active_session_other_device'
  transferRef?: string
  existingIp?: string
  existingUserAgent?: string
}

export const authApi = {
  getDeviceId,

  verifyInvite: (inviteCode: string) =>
    apiRequest<InviteVerifyResponse>('/api/v1/auth/invite/verify', {
      body: { inviteCode },
    }),

  login: (email: string, password: string, inviteCode?: string, lat?: number, lon?: number, accuracy?: number) =>
    apiRequest<LoginResponse>('/api/v1/auth/login', {
      body: {
        email,
        password,
        inviteCode,
        lat,
        lon,
        accuracy,
        deviceId: getDeviceId(),
      },
    }),

  transferSession: (transferRef: string, totpCode: string, lat?: number, lon?: number, accuracy?: number) =>
    apiRequest<LoginResponse>('/api/v1/auth/session/transfer', {
      body: { transferRef, totpCode, deviceId: getDeviceId(), lat, lon, accuracy },
    }),

  blockDevice: (deviceId: string, ipAddress?: string | null, userAgent?: string | null) =>
    apiRequest<{ ok: boolean }>('/api/v1/auth/devices/block', {
      body: { deviceId, ipAddress, userAgent },
    }),

  resendEmailCode: () =>
    apiRequest<void>('/api/v1/auth/email/resend', { method: 'POST' }),

  verifyEmail: (code: string) =>
    apiRequest<SessionStateResponse>('/api/v1/auth/email/verify', {
      body: { code },
    }),

  enrollTotp: () =>
    apiRequest<TotpEnrollment>('/api/v1/auth/totp/enroll', { method: 'POST' }),

  verifyTotp: (code: string) =>
    apiRequest<SessionStateResponse>('/api/v1/auth/totp/verify', {
      body: { code },
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<{ ok: boolean; nextState?: string }>('/api/v1/auth/password/change', {
      body: { currentPassword, newPassword },
    }),

  requestPasswordReset: (email: string) =>
    apiRequest<{ ok: boolean }>('/api/v1/auth/password/reset/request', {
      body: { email },
    }),

  verifyPasswordResetCode: (email: string, code: string) =>
    apiRequest<ResetVerifyResponse>('/api/v1/auth/password/reset/verify', {
      body: { email, code },
    }),

  confirmPasswordReset: (email: string, resetToken: string, newPassword: string) =>
    apiRequest<{ ok: boolean }>('/api/v1/auth/password/reset/confirm', {
      body: { email, resetToken, newPassword },
    }),

  stepUpTotp: (code: string) =>
    apiRequest<{ ok: boolean }>('/api/v1/auth/totp/step-up', { body: { code } }),

  stepUpLockout: () =>
    apiRequest<{ ok: boolean }>('/api/v1/auth/totp/step-up-lockout', { method: 'POST' }),

  session: () => apiRequest<SessionStateResponse>('/api/v1/auth/session'),

  logout: () => apiRequest<void>('/api/v1/auth/logout', { method: 'POST' }),
}
