import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '@/components/onboarding/AuthLayout'
import ChangePasswordForm from '@/components/onboarding/ChangePasswordForm'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/client'
import { clearOnboardingState } from '@/onboarding/state'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = useSubmitGuard(async (currentPassword: string, newPassword: string) => {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      // Backend revokes all sessions on password change — our cookie is now invalid. Nuke
      // local state and bounce to login. (The stale cookie lingers in the browser but the
      // backend will reject it; next /login sets a fresh one.)
      clearOnboardingState()
      navigate('/auth/login')
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
      />
    </AuthLayout>
  )
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Please sign in first.'
    if (err.code === 'invalid' && err.detail === 'credentials') return 'Current password is incorrect.'
    if (err.code === 'weak_password') {
      return err.detail === 'min_length'
        ? 'New password must be at least 8 characters.'
        : 'New password must contain letters and digits.'
    }
    return 'Update failed. Please try again.'
  }
  return 'Network error. Please check your connection and try again.'
}
