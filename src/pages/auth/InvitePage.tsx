import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '@/components/onboarding/AuthLayout'
import InviteForm from '@/components/onboarding/InviteForm'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/client'
import { setInviteCode, setInviteEmail } from '@/onboarding/state'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'

export default function InvitePage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = useSubmitGuard(async (inviteCode: string) => {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const { email } = await authApi.verifyInvite(inviteCode)
      await setInviteCode(inviteCode)
      await setInviteEmail(email)
      navigate('/auth/login')
    } catch (err) {
      setErrorMessage(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <AuthLayout>
      <InviteForm
        onSubmit={handleSubmit}
        submitting={submitting}
        errorMessage={errorMessage}
      />
    </AuthLayout>
  )
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'invalid' && err.detail === 'invite_code') {
      return 'That invitation code is not valid or has expired.'
    }
    return "We couldn't verify the invitation. Please try again."
  }
  return 'Network error. Please check your connection and try again.'
}
