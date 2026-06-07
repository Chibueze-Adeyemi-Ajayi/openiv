import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box, Typography, Dialog, TextField, Button, CircularProgress, Alert,
} from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import AuthLayout from '@/components/onboarding/AuthLayout'
import LoginForm from '@/components/onboarding/LoginForm'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/client'
import { colorPalette } from '@/theme'
import {
  clearInviteState,
  getInviteCode,
  getInviteEmail,
  hydrate,
  setLoginEmail,
  setLoginName,
  setSessionState,
} from '@/onboarding/state'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'

// ── Session-transfer dialog (same device, different tab/browser) ──────────────
function TransferDialog({
  transferRef,
  onSuccess,
  onCancel,
  location,
}: {
  transferRef: string
  onSuccess: () => void
  onCancel: () => void
  location?: { lat: number; lon: number; accuracy: number }
}) {
  const [code,       setCode]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const handleSubmit = async () => {
    if (code.length < 6 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await authApi.transferSession(
        transferRef, code, location?.lat, location?.lon, location?.accuracy,
      )
      await setSessionState(result.state)
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiError && err.detail === 'code'
        ? 'Invalid code — please try again.'
        : 'Transfer failed. Please try again.')
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open disableEscapeKeyDown PaperProps={{ sx: { borderRadius: 0, width: '100%', maxWidth: 420, bgcolor: 'var(--card-bg)', color: 'var(--on-surface)' } }}>
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid var(--border-col)' }}>
        <Box sx={{ width: 36, height: 36, bgcolor: `${colorPalette.primary}0f`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <LockOutlinedIcon sx={{ fontSize: '1.125rem', color: colorPalette.primary }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
            Active session detected
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
            A session is already open on this device.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ px: 3, py: 2.5 }}>
        <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.6, mb: 2.5 }}>
          To continue here, enter your authenticator code. Your existing session will be
          closed automatically.
        </Typography>

        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>
          Authenticator Code
        </Typography>
        <TextField
          fullWidth
          type="text"
          inputProps={{ maxLength: 6, inputMode: 'numeric', style: { letterSpacing: '0.4em',
            fontSize: '1.375rem', fontWeight: 600, textAlign: 'center' } }}
          value={code}
          onChange={(e) => { setError(null); setCode(e.target.value.replace(/\D/g, '').slice(0, 6)) }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          autoFocus
          sx={{
            mb: 1,
            '& .MuiOutlinedInput-root': {
              borderRadius: 0,
              bgcolor: 'var(--section-bg)',
              '& fieldset': { border: `1px solid ${error ? '#dc2626' : 'var(--border-col)'}` },
              '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
            },
          }}
        />
        {error && (
          <Alert severity="error" sx={{ borderRadius: 0, mb: 1.5, fontSize: '0.8125rem' }}>{error}</Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
          <Button
            onClick={handleSubmit}
            disabled={code.length < 6 || submitting}
            fullWidth
            sx={{ bgcolor: colorPalette.primary, color: '#fff', py: 1.25, borderRadius: 0,
              fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Jost', textTransform: 'none',
              boxShadow: 'none', '&:hover': { bgcolor: '#1e293b' }, '&:disabled': { bgcolor: '#e2e8f0' } }}
          >
            {submitting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Continue Here'}
          </Button>
          <Button
            onClick={onCancel}
            sx={{ color: '#64748b', py: 1.25, borderRadius: 0, fontSize: '0.875rem',
              fontWeight: 600, fontFamily: 'Jost', textTransform: 'none',
              '&:hover': { bgcolor: 'var(--section-bg)' } }}
          >
            Cancel
          </Button>
        </Box>
      </Box>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionExpired = searchParams.get('expired') === '1'
  const [inviteCode,      setInviteCodeState]  = useState<string | null>(null)
  const [inviteEmail,     setInviteEmailState] = useState<string | null>(null)
  const [submitting,      setSubmitting]        = useState(false)
  const [errorMessage,    setErrorMessage]      = useState<string | null>(null)
  const [transferRef,     setTransferRef]       = useState<string | null>(null)
  const [lastLocation,    setLastLocation]      = useState<{ lat: number; lon: number; accuracy: number } | undefined>()

  useEffect(() => {
    hydrate().then(() => {
      setInviteCodeState(getInviteCode())
      setInviteEmailState(getInviteEmail())
    })
  }, [])

  const afterLogin = async (state: string) => {
    switch (state) {
      case 'pending_email_verification': navigate('/auth/verify-email');     break
      case 'must_change_password':       navigate('/auth/change-password');  break
      case 'pending_totp_setup':         navigate('/auth/setup-2fa');        break
      case 'pending_totp_challenge':     navigate('/auth/verify-otp');       break
      case 'authenticated':              navigate('/dashboard');             break
    }
  }

  const handleSubmit = useSubmitGuard(async (
    email: string,
    password: string,
    location?: { lat: number; lon: number; accuracy: number },
  ) => {
    setSubmitting(true)
    setErrorMessage(null)
    setLastLocation(location)
    try {
      const { state, fullName } = await authApi.login(
        email, password, inviteCode ?? undefined,
        location?.lat, location?.lon, location?.accuracy,
      )
      await setSessionState(state)
      await setLoginEmail(email)
      if (fullName) await setLoginName(fullName)
      clearInviteState()
      await afterLogin(state)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === 'conflict') {
        if (err.detail === 'active_session_same_device') {
          setTransferRef((err.extra['transferRef'] as string | undefined) ?? null)
          return
        }
        // Different device: show message, notification already sent to other machine
        setErrorMessage(
          'Your account is already signed in on another device. An alert has been sent to ' +
          'that session. Please sign out there first, or wait for the device block confirmation.'
        )
        return
      }
      setErrorMessage(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  })

  const handleTransferSuccess = async () => {
    setTransferRef(null)
    navigate('/dashboard')
  }

  return (
    <>
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

      {transferRef && (
        <TransferDialog
          transferRef={transferRef}
          location={lastLocation}
          onSuccess={handleTransferSuccess}
          onCancel={() => setTransferRef(null)}
        />
      )}
    </>
  )
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 423 && err.detail === 'device_blocked')
      return 'Access from this device has been blocked by an administrator.'
    if (err.status === 423) return 'Account temporarily locked. Try again in 15 minutes.'
    if (err.code === 'invalid' && err.detail === 'credentials') return 'Email or password is incorrect.'
    if (err.code === 'invalid' && err.detail === 'invite_code') return 'Invitation is no longer valid.'
    if (err.code === 'invalid' && err.detail === 'invite_email_mismatch')
      return 'This invitation was issued to a different email address.'
    return 'Sign-in failed. Please try again.'
  }
  return 'Network error. Please check your connection and try again.'
}
