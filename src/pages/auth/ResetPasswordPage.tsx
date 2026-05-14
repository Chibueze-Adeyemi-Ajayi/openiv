import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '@/components/onboarding/AuthLayout'
import ResetPasswordForm from '@/components/onboarding/ResetPasswordForm'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/client'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'
import { Box, Typography } from '@mui/material'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Short-lived opaque token issued by step 2, needed for step 3. Lives in component state
  // only (not persisted) — if the user refreshes mid-flow they restart from step 1.
  const [resetToken, setResetToken] = useState<string | null>(null)

  const handleRequestEmail = useSubmitGuard(async (email: string) => {
    setErrorMessage(null)
    try {
      await authApi.requestPasswordReset(email)
    } catch {
      /* absorb — the backend always returns 200; any thrown error was a transport issue */
    }
  })

  const handleVerifyCode = useSubmitGuard(async (email: string, code: string) => {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const { resetToken } = await authApi.verifyPasswordResetCode(email, code)
      setResetToken(resetToken)
    } catch (err) {
      setErrorMessage(messageForVerify(err))
      throw err // rethrow so the form stays on step 2
    } finally {
      setSubmitting(false)
    }
  })

  const handleConfirm = useSubmitGuard(async (email: string, newPassword: string) => {
    if (!resetToken) {
      setErrorMessage('Reset session expired. Start over from step 1.')
      throw new Error('missing reset token')
    }
    setSubmitting(true)
    setErrorMessage(null)
    try {
      await authApi.confirmPasswordReset(email, resetToken, newPassword)
      navigate('/auth/login')
    } catch (err) {
      setErrorMessage(messageForConfirm(err))
      throw err
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <AuthLayout>
      <ResetPasswordForm
        onRequestEmail={handleRequestEmail}
        onVerifyCode={handleVerifyCode}
        onConfirm={handleConfirm}
        submitting={submitting}
        errorMessage={errorMessage}
      />
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography 
          onClick={() => navigate('/auth/login')}
          sx={{ 
            fontSize: '0.875rem', 
            color: '#64748b', 
            cursor: 'pointer',
            '&:hover': { color: '#00288e', textDecoration: 'underline' }
          }}
        >
          Return to login
        </Typography>
      </Box>
    </AuthLayout>
  )
}

function messageForVerify(err: unknown): string {
  if (err instanceof ApiError && err.code === 'invalid' && err.detail === 'code') {
    return 'That code is not valid or has expired. Request a new one if needed.'
  }
  if (err instanceof ApiError) return 'Verification failed. Please try again.'
  return 'Network error. Please check your connection and try again.'
}

function messageForConfirm(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'invalid' && err.detail === 'reset_token') {
      return 'Your reset session has expired. Start over from step 1.'
    }
    if (err.code === 'weak_password') {
      return err.detail === 'min_length'
        ? 'New password must be at least 8 characters.'
        : 'New password must contain letters and digits.'
    }
    return 'Reset failed. Please try again.'
  }
  return 'Network error. Please check your connection and try again.'
}
