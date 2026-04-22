import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '@/components/onboarding/AuthLayout'
import Setup2FAForm from '@/components/onboarding/Setup2FAForm'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/client'
import { clearOnboardingBreadcrumbs, setSessionState } from '@/onboarding/state'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'

export default function Setup2FAPage() {
  const navigate = useNavigate()
  const [secret, setSecret] = useState<string | undefined>(undefined)
  const [otpauthUri, setOtpauthUri] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleEnroll = async () => {
    setErrorMessage(null)
    try {
      const enrollment = await authApi.enrollTotp()
      setSecret(enrollment.secret)
      setOtpauthUri(enrollment.otpauthUri)
    } catch (err) {
      // If we're already past enrollment (e.g. re-login, state=pending_totp_challenge), the
      // backend returns 409 — that's fine; no secret to show and the code input still works.
      if (err instanceof ApiError && err.status === 409) return
      setErrorMessage(messageFor(err))
    }
  }

  const handleSubmit = useSubmitGuard(async (code: string) => {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const { state } = await authApi.verifyTotp(code)
      await setSessionState(state)
      if (state === 'authenticated') {
        clearOnboardingBreadcrumbs()
        navigate('/')
      }
    } catch (err) {
      setErrorMessage(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <AuthLayout>
      <Setup2FAForm
        secret={secret}
        otpauthUri={otpauthUri}
        onEnroll={handleEnroll}
        onSubmit={handleSubmit}
        submitting={submitting}
        errorMessage={errorMessage}
      />
    </AuthLayout>
  )
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Your session expired. Please sign in again.'
    if (err.code === 'invalid' && err.detail === 'code') return 'That code is incorrect. Try the next one from your app.'
    return 'Verification failed. Please try again.'
  }
  return 'Network error. Please check your connection and try again.'
}
