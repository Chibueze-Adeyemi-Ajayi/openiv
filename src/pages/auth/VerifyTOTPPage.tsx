import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '@/components/onboarding/AuthLayout'
import VerifyTOTPForm from '@/components/onboarding/VerifyTOTPForm'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/client'
import { clearOnboardingBreadcrumbs, setSessionState, clearOnboardingState } from '@/onboarding/state'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'
import { Box, Typography } from '@mui/material'

export default function VerifyTOTPPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = useSubmitGuard(async (code: string) => {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const { state } = await authApi.verifyTotp(code)
      await setSessionState(state)
      if (state === 'authenticated') {
        clearOnboardingBreadcrumbs()
        navigate('/dashboard')
      }
    } catch (err) {
      setErrorMessage(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <AuthLayout>
      <VerifyTOTPForm
        onSubmit={handleSubmit}
        submitting={submitting}
        errorMessage={errorMessage}
      />
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography 
          onClick={() => { clearOnboardingState(); navigate('/auth/login'); }}
          sx={{ 
            fontSize: '0.875rem', 
            color: '#64748b', 
            cursor: 'pointer',
            '&:hover': { color: '#0f172a', textDecoration: 'underline' }
          }}
        >
          Sign in as a different user
        </Typography>
      </Box>
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
