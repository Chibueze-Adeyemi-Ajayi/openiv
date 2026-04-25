import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '@/components/onboarding/AuthLayout'
import LoginForm from '@/components/onboarding/LoginForm'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/client'
import {
  clearInviteState,
  getInviteCode,
  getInviteEmail,
  hydrate,
  setLoginEmail,
  setSessionState,
} from '@/onboarding/state'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionExpired = searchParams.get('expired') === '1'
  const [inviteCode, setInviteCodeState] = useState<string | null>(null)
  const [inviteEmail, setInviteEmailState] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    hydrate().then(() => {
      setInviteCodeState(getInviteCode())
      setInviteEmailState(getInviteEmail())
    })
  }, [])

  const handleSubmit = useSubmitGuard(async (email: string, password: string, location?: { lat: number; lon: number; accuracy: number }) => {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const { state } = await authApi.login(
        email,
        password,
        inviteCode ?? undefined,
        location?.lat,
        location?.lon,
        location?.accuracy
      )
      await setSessionState(state)
      await setLoginEmail(email)
      clearInviteState()

      switch (state) {
        case 'pending_email_verification':
          navigate('/auth/verify-email')
          break
        case 'pending_totp_setup':
          navigate('/auth/setup-2fa')
          break
        case 'pending_totp_challenge':
          navigate('/auth/verify-otp')
          break
        case 'authenticated':
          navigate('/dashboard')
          break
      }
    } catch (err) {
      setErrorMessage(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <AuthLayout>
      <LoginForm
        onSubmit={handleSubmit}
        submitting={submitting}
        errorMessage={errorMessage}
        headerHint={
          sessionExpired
            ? 'Session expired — please sign in again to continue.'
            : inviteEmail
            ? `Completing your invitation for ${inviteEmail}. First login will claim the invite.`
            : null
        }
      />
    </AuthLayout>
  )
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 423) return 'Account temporarily locked. Try again in 15 minutes.'
    if (err.code === 'invalid' && err.detail === 'credentials') return 'Email or password is incorrect.'
    if (err.code === 'invalid' && err.detail === 'invite_code') return 'Invitation is no longer valid.'
    if (err.code === 'invalid' && err.detail === 'invite_email_mismatch') {
      return 'This invitation was issued to a different email address.'
    }
    return 'Sign-in failed. Please try again.'
  }
  return 'Network error. Please check your connection and try again.'
}
