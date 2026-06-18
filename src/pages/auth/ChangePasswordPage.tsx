import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '@/components/onboarding/AuthLayout'
import ChangePasswordForm from '@/components/onboarding/ChangePasswordForm'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/client'
import { clearOnboardingState, getSessionState, hydrate, setSessionState } from '@/onboarding/state'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isFirstLogin, setIsFirstLogin] = useState(false)

  useEffect(() => {
    hydrate().then(() => {
      setIsFirstLogin(getSessionState() === 'must_change_password')
    })
  }, [])

  const handleSubmit = useSubmitGuard(async (currentPassword: string, newPassword: string) => {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const result = await authApi.changePassword(currentPassword, newPassword)
      if (result.nextState === 'pending_biometric_setup') {
        await setSessionState('pending_biometric_setup')
        navigate('/auth/setup-biometric')
      } else if (result.nextState === 'authenticated') {
        await setSessionState('authenticated')
        navigate('/dashboard')
      } else {
        // Normal password change: backend revoked all sessions; return to login
        clearOnboardingState()
        navigate('/auth/login')
      }
    } catch (err) {
      setErrorMessage(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <AuthLayout>
      <ChangePasswordForm
        onSubmit={handleSubmit}
        submitting={submitting}
        errorMessage={errorMessage}
        isFirstLogin={isFirstLogin}
      />
    </AuthLayout>
  )
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Please sign in first.'
    if (err.code === 'invalid' && err.detail === 'credentials')
      return 'The password you entered is incorrect.'
    if (err.code === 'weak_password') {
      return err.detail === 'min_length'
        ? 'New password must be at least 8 characters.'
        : 'New password must contain both letters and numbers.'
    }
    return 'Update failed. Please try again.'
  }
  return 'Network error. Please check your connection and try again.'
}
