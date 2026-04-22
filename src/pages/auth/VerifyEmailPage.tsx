import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '@/components/onboarding/AuthLayout'
import VerifyEmailForm from '@/components/onboarding/VerifyEmailForm'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/client'
import { getLoginEmail, hydrate, setSessionState } from '@/onboarding/state'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    hydrate().then(() => setEmail(getLoginEmail() ?? undefined))
  }, [])

  const handleSubmit = useSubmitGuard(async (code: string) => {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const { state } = await authApi.verifyEmail(code)
      await setSessionState(state)
      if (state === 'pending_totp_setup' || state === 'pending_totp_challenge') {
        navigate('/auth/setup-2fa')
      } else if (state === 'authenticated') {
        navigate('/')
      }
    } catch (err) {
      setErrorMessage(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  })

  const handleResend = async () => {
    try {
      await authApi.resendEmailCode()
    } catch {
      /* silent — UI shows "Code Sent" optimistically; user retry is always possible */
    }
  }

  return (
    <AuthLayout>
      <VerifyEmailForm
        email={email}
        onSubmit={handleSubmit}
        onResend={handleResend}
        submitting={submitting}
        errorMessage={errorMessage}
      />
    </AuthLayout>
  )
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Your session expired. Please sign in again.'
    if (err.code === 'invalid' && err.detail === 'code') return 'That code is incorrect or has expired.'
    return 'Verification failed. Please try again.'
  }
  return 'Network error. Please check your connection and try again.'
}
