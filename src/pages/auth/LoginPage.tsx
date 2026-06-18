import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box, Typography, Dialog, TextField, Button, CircularProgress, Alert,
} from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import AuthLayout from '@/components/onboarding/AuthLayout'
import LoginForm from '@/components/onboarding/LoginForm'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/client'
import { colorPalette } from '@/theme'
import {
  clearInviteState,
  getInviteCode,
  getInviteEmail,
  getLoginEmail,
  hydrate,
  setLoginAvatar,
  setLoginEmail,
  setLoginName,
  setSessionState,
} from '@/onboarding/state'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'
import { webAuthnSupported, loginWithBiometric, registerBiometric, checkEnrolled, verifyBiometric } from '@/api/webauthn'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'

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

// ── Post-login biometric enrollment offer ────────────────────────────────────
function BiometricOfferModal({
  onSetup,
  onSkip,
  phase,
  errorMsg,
}: {
  onSetup: () => void
  onSkip?: () => void        // omit = mandatory (no skip button)
  phase: 'idle' | 'working' | 'done' | 'error'
  errorMsg?: string | null
}) {
  const iconBg =
    phase === 'done'  ? '#f0fdf4' :
    phase === 'error' ? '#fff1f2' :
    `${colorPalette.primary}12`

  const iconColor =
    phase === 'done'  ? '#16a34a' :
    phase === 'error' ? '#dc2626' :
    colorPalette.primary

  return (
    <>
      <Box sx={{
        position: 'fixed', inset: 0,
        bgcolor: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', zIndex: 1290,
      }} />
      <Box sx={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: 400,
        bgcolor: 'var(--card-bg)', zIndex: 1291,
        boxShadow: '0 32px 80px rgba(15,23,42,0.3)',
        animation: 'bioOfferIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        '@keyframes bioOfferIn': {
          from: { opacity: 0, transform: 'translate(-50%, -44%) scale(0.92)' },
          to:   { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
        },
      }}>
        {/* Accent bar — amber when mandatory (no skip), primary otherwise */}
        <Box sx={{
          height: 4,
          background: onSkip
            ? `linear-gradient(90deg, ${colorPalette.primary}, #7c3aed)`
            : 'linear-gradient(90deg, #f59e0b, #ef4444)',
        }} />

        <Box sx={{ px: 3.5, pt: 3.5, pb: 3.5, textAlign: 'center' }}>

          {/* Required badge — only when mandatory */}
          {!onSkip && phase === 'idle' && (
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
              px: 1.25, py: 0.35, mb: 2,
              bgcolor: '#fef9c3', border: '1px solid #fde047',
            }}>
              <Typography sx={{ fontSize: '0.5625rem', fontWeight: 800, color: '#854d0e',
                textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Required to access dashboard
              </Typography>
            </Box>
          )}

          {/* Icon */}
          <Box sx={{
            width: 72, height: 72, borderRadius: '50%', mx: 'auto', mb: 2.5,
            bgcolor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.3s',
            ...(phase === 'working' ? {
              animation: 'bioPulse 1.2s ease-in-out infinite',
              '@keyframes bioPulse': {
                '0%,100%': { opacity: 1, transform: 'scale(1)' },
                '50%':     { opacity: 0.6, transform: 'scale(1.08)' },
              },
            } : {}),
          }}>
            {phase === 'done'
              ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: '2rem', color: iconColor }} />
              : <FingerprintIcon sx={{ fontSize: '2rem', color: iconColor }} />
            }
          </Box>

          {/* Heading */}
          <Typography sx={{
            fontFamily: 'Jost', fontWeight: 800, fontSize: '1.1875rem',
            color: 'var(--heading-color)', mb: 0.875, lineHeight: 1.3,
          }}>
            {phase === 'done'    && "You're all set!"}
            {phase === 'working' && 'Setting up biometrics…'}
            {phase === 'error'   && 'Setup failed'}
            {phase === 'idle'    && 'Set up biometric login'}
          </Typography>

          {/* Body */}
          <Typography sx={{
            fontSize: '0.875rem', color: 'var(--on-surface-variant)',
            lineHeight: 1.7, mb: phase === 'idle' ? 2.5 : 3, maxWidth: 320, mx: 'auto',
          }}>
            {phase === 'done' && 'Biometric login is now active. Taking you to your dashboard…'}
            {phase === 'working' && 'Follow the prompt on your device…'}
            {phase === 'error' && (errorMsg || 'Something went wrong. Please try again.')}
            {phase === 'idle' && (
              <>
                Enable <strong>Face ID or Touch ID</strong> on this device.
                Your next sign-in will be instant — no password required.
                Your biometric data never leaves your device.
              </>
            )}
          </Typography>

          {/* Trust indicators — idle only */}
          {phase === 'idle' && (
            <Box sx={{
              display: 'flex', justifyContent: 'center', gap: 2.5,
              mb: 3, pb: 2.5, borderBottom: '1px solid var(--border-col)',
            }}>
              {[
                { icon: '🔒', label: 'On-device only' },
                { icon: '⚡', label: 'Instant login' },
                { icon: '🛡️', label: 'Phishing-proof' },
              ].map(({ icon, label }) => (
                <Box key={label} sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '1.125rem', mb: 0.25 }}>{icon}</Typography>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8',
                    textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Actions */}
          {(phase === 'idle' || phase === 'error') && (
            <>
              <Button
                onClick={onSetup}
                fullWidth
                startIcon={<FingerprintIcon sx={{ fontSize: '1.125rem !important' }} />}
                sx={{
                  bgcolor: phase === 'error' ? '#dc2626' : colorPalette.primary,
                  color: '#fff', py: 1.5, borderRadius: 0, fontFamily: 'Jost',
                  fontWeight: 700, fontSize: '0.9375rem', textTransform: 'none',
                  boxShadow: 'none', mb: onSkip ? 1.25 : 0,
                  '&:hover': {
                    bgcolor: phase === 'error' ? '#b91c1c' : colorPalette.primary,
                    opacity: 0.88, boxShadow: 'none',
                  },
                }}
              >
                {phase === 'error' ? 'Try again' : 'Set up Face ID / Touch ID'}
              </Button>

              {/* Skip link — only when not mandatory */}
              {onSkip && (
                <Typography
                  onClick={onSkip}
                  sx={{
                    fontSize: '0.875rem', color: '#94a3b8', cursor: 'pointer',
                    '&:hover': { color: colorPalette.primary, textDecoration: 'underline' },
                  }}
                >
                  Not now — go to dashboard
                </Typography>
              )}
            </>
          )}
        </Box>
      </Box>
    </>
  )
}

// ── Post-login biometric step-up verification ────────────────────────────────
function BiometricVerifyModal({
  onVerified,
  onFailed,
}: {
  onVerified: () => void
  onFailed: (msg: string) => void
}) {
  const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleVerify = async () => {
    setPhase('working')
    setErrorMsg(null)
    try {
      await verifyBiometric()
      setPhase('done')
      setTimeout(onVerified, 900)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const friendly =
        msg.includes('AbortError') || msg.includes('NotAllowedError') || msg.includes('cancelled')
          ? 'Verification was cancelled. Please try again.'
          : 'Biometric verification failed. Please try again.'
      setErrorMsg(friendly)
      setPhase('error')
      onFailed(friendly)
    }
  }

  const iconBg   = phase === 'done' ? '#f0fdf4' : phase === 'error' ? '#fff1f2' : `${colorPalette.primary}12`
  const iconColor = phase === 'done' ? '#16a34a' : phase === 'error' ? '#dc2626' : colorPalette.primary

  return (
    <>
      <Box sx={{
        position: 'fixed', inset: 0,
        bgcolor: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(4px)', zIndex: 1290,
      }} />
      <Box sx={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: 380,
        bgcolor: 'var(--card-bg)', zIndex: 1291,
        boxShadow: '0 32px 80px rgba(15,23,42,0.3)',
        animation: 'bioVerifyIn 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        '@keyframes bioVerifyIn': {
          from: { opacity: 0, transform: 'translate(-50%, -44%) scale(0.92)' },
          to:   { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
        },
      }}>
        {/* Accent — green when done, red on error, primary otherwise */}
        <Box sx={{
          height: 4,
          background: phase === 'done'
            ? '#16a34a'
            : phase === 'error'
            ? '#dc2626'
            : `linear-gradient(90deg, ${colorPalette.primary}, #7c3aed)`,
        }} />

        <Box sx={{ px: 3.5, pt: 3.5, pb: 3.5, textAlign: 'center' }}>
          {/* Icon */}
          <Box sx={{
            width: 68, height: 68, borderRadius: '50%', mx: 'auto', mb: 2.5,
            bgcolor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.3s',
            ...(phase === 'working' ? {
              animation: 'bioVPulse 1.2s ease-in-out infinite',
              '@keyframes bioVPulse': {
                '0%,100%': { opacity: 1, transform: 'scale(1)' },
                '50%':     { opacity: 0.6, transform: 'scale(1.08)' },
              },
            } : {}),
          }}>
            {phase === 'done'
              ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1.875rem', color: iconColor }} />
              : <FingerprintIcon sx={{ fontSize: '1.875rem', color: iconColor }} />
            }
          </Box>

          <Typography sx={{
            fontFamily: 'Jost', fontWeight: 800, fontSize: '1.125rem',
            color: 'var(--heading-color)', mb: 0.75,
          }}>
            {phase === 'done'    && 'Verified!'}
            {phase === 'working' && 'Verifying…'}
            {phase === 'error'   && 'Verification failed'}
            {phase === 'idle'    && 'Confirm your identity'}
          </Typography>
          <Typography sx={{
            fontSize: '0.875rem', color: 'var(--on-surface-variant)',
            lineHeight: 1.65, mb: phase === 'idle' ? 3 : 2.5, maxWidth: 300, mx: 'auto',
          }}>
            {phase === 'done'    && 'Taking you to your dashboard…'}
            {phase === 'working' && 'Follow the prompt on your device…'}
            {phase === 'error'   && (errorMsg ?? 'Something went wrong.')}
            {phase === 'idle'    && 'OpenIV requires biometric verification every time you sign in. Your data stays on your device.'}
          </Typography>

          {(phase === 'idle' || phase === 'error') && (
            <Button
              onClick={handleVerify}
              fullWidth
              startIcon={<FingerprintIcon sx={{ fontSize: '1.125rem !important' }} />}
              sx={{
                bgcolor: phase === 'error' ? '#dc2626' : colorPalette.primary,
                color: '#fff', py: 1.5, borderRadius: 0, fontFamily: 'Jost',
                fontWeight: 700, fontSize: '0.9375rem', textTransform: 'none',
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: phase === 'error' ? '#b91c1c' : colorPalette.primary,
                  opacity: 0.88, boxShadow: 'none',
                },
              }}
            >
              {phase === 'error' ? 'Try again' : 'Verify with Face ID / Touch ID'}
            </Button>
          )}
        </Box>
      </Box>
    </>
  )
}

// ── Biometric login prompt ────────────────────────────────────────────────────
function BiometricPrompt({
  email,
  userName,
  institutionName,
  institutionLogoUrl,
  onSuccess,
  onUsePassword,
  onExpired,
}: {
  email: string
  userName?: string | null
  institutionName?: string | null
  institutionLogoUrl?: string | null
  onSuccess: () => void
  onUsePassword: () => void
  onExpired: () => void
}) {
  const [phase, setPhase] = useState<'idle' | 'working' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const handleBio = async () => {
    setPhase('working')
    setErrMsg(null)
    try {
      const { nextState } = await loginWithBiometric(email)
      await setSessionState(nextState as import('@/onboarding/state').SessionState)
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError &&
          (err.detail === 'webauthn_challenge_expired' || err.status === 401)) {
        onExpired()
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('NotAllowedError') || msg.includes('AbortError') || msg.includes('cancelled')) {
        setErrMsg('Authentication was cancelled. Try again.')
      } else if (err instanceof ApiError && err.detail === 'biometric_login_unavailable') {
        setErrMsg('Biometric login is not set up. Use your password.')
      } else {
        setErrMsg('Biometric sign-in failed. Use your password instead.')
      }
      setPhase('error')
    }
  }

  const instInitials = institutionName
    ? institutionName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
    : '?'

  return (
    <Box sx={{ width: '100%' }}>
      {/* Institution logo / mark */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        {institutionLogoUrl ? (
          <Box component="img" src={institutionLogoUrl} alt={institutionName ?? ''}
            sx={{ height: 52, maxWidth: 180, objectFit: 'contain', display: 'block' }} />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ width: 40, height: 40, bgcolor: colorPalette.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '0.9375rem', color: '#fff', lineHeight: 1 }}>
                {instInitials}
              </Typography>
            </Box>
            {institutionName && (
              <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '1rem', color: 'var(--heading-color)' }}>
                {institutionName}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* User identity pill */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.375,
        bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', mb: 2.5 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: colorPalette.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
            {(userName ?? email).slice(0, 2).toUpperCase()}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)',
          fontFamily: 'Jost', fontWeight: 500, flex: 1, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {userName ?? email}
        </Typography>
      </Box>

      {errMsg && (
        <Alert severity="error" sx={{ borderRadius: 0, mb: 2, fontSize: '0.8125rem' }}>
          {errMsg}
        </Alert>
      )}

      {/* Biometric button */}
      <Button
        onClick={handleBio}
        disabled={phase === 'working'}
        fullWidth
        startIcon={phase === 'working'
          ? <CircularProgress size={16} sx={{ color: '#fff' }} />
          : <FingerprintIcon sx={{ fontSize: '1.125rem !important' }} />}
        sx={{
          bgcolor: colorPalette.primary, color: '#fff',
          py: 1.5, fontSize: '0.9375rem', fontWeight: 700,
          fontFamily: 'Jost', borderRadius: 0, textTransform: 'none',
          boxShadow: 'none', mb: 1.5,
          '&:hover': { bgcolor: colorPalette.primary, opacity: 0.88, boxShadow: 'none' },
          '&:disabled': { bgcolor: colorPalette.primary, opacity: 0.6, color: '#fff' },
        }}
      >
        {phase === 'working' ? 'Verifying…' : 'Sign in with Face ID / Touch ID'}
      </Button>

      {/* Password fallback */}
      <Typography
        onClick={onUsePassword}
        sx={{ fontSize: '0.875rem', color: '#64748b', textAlign: 'center',
          cursor: 'pointer', '&:hover': { color: colorPalette.primary, textDecoration: 'underline' } }}
      >
        Use password instead
      </Typography>
    </Box>
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

  // Biometric fast-path: shown when this device has a registered hint
  const [bioEmail,            setBioEmail]           = useState<string | null>(null)
  const [bioUserName,         setBioUserName]        = useState<string | null>(null)
  const [bioInstitutionName,  setBioInstitutionName] = useState<string | null>(null)
  const [bioInstitutionLogo,  setBioInstitutionLogo] = useState<string | null>(null)
  const [showPassword,    setShowPassword]      = useState(false)
  const [bioExpired,      setBioExpired]        = useState(false)

  // Post-login enrollment offer
  const [showBioOffer,    setShowBioOffer]      = useState(false)
  const [bioOfferPhase,   setBioOfferPhase]     = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [bioOfferError,   setBioOfferError]     = useState<string | null>(null)
  const [bioMandatory,    setBioMandatory]      = useState(false)
  const [showBioVerify,   setShowBioVerify]     = useState(false)
  const [showUnsupported, setShowUnsupported]   = useState(false)

  useEffect(() => {
    hydrate().then(() => {
      setInviteCodeState(getInviteCode())
      setInviteEmailState(getInviteEmail())
    })
    // Check if this browser has a registered biometric for a known email
    if (webAuthnSupported()) {
      try {
        const raw = localStorage.getItem('openiv.bioHint')
        if (raw) {
          const hint = JSON.parse(raw) as { email: string; userName?: string; institutionName?: string; institutionLogoUrl?: string }
          if (hint.email) {
            setBioEmail(hint.email)
            setBioUserName(hint.userName ?? null)
            setBioInstitutionName(hint.institutionName ?? null)
            setBioInstitutionLogo(hint.institutionLogoUrl ?? null)
          }
        }
      } catch { /* ignore corrupt hint */ }
    }
  }, [])

  const afterLogin = async (state: string) => {
    switch (state) {
      case 'pending_email_verification': navigate('/auth/verify-email');        break
      case 'must_change_password':       navigate('/auth/change-password');     break
      case 'pending_totp_setup':         navigate('/auth/setup-2fa');           break
      case 'pending_totp_challenge':     navigate('/auth/verify-otp');          break
      case 'pending_biometric_setup':    navigate('/auth/setup-biometric');     break
      case 'pending_biometric_challenge': navigate('/auth/verify-biometric');   break
      case 'authenticated': {
        // Hard wall: biometrics is mandatory on every device
        if (!webAuthnSupported()) {
          setShowUnsupported(true)
          break
        }
        const alreadySet = !!localStorage.getItem('openiv.bioHint')
        if (alreadySet) {
          // Enrolled on this device — require step-up verification before dashboard
          setShowBioVerify(true)
          break
        }
        // No local hint — check if user already has credentials in DB
        try {
          const enrolled = await checkEnrolled()
          if (enrolled) {
            // Restore hint silently, then require verification
            const email = getLoginEmail()
            if (email) {
              try {
                const raw = localStorage.getItem('openiv.bioHint')
                const existing = raw ? JSON.parse(raw) : {}
                localStorage.setItem('openiv.bioHint', JSON.stringify({ ...existing, email }))
              } catch { localStorage.setItem('openiv.bioHint', JSON.stringify({ email })) }
            }
            setShowBioVerify(true)
          } else {
            // Never enrolled — mandatory setup, no skip allowed
            setBioMandatory(true)
            setShowBioOffer(true)
          }
        } catch {
          // Network error on status check — still block; require biometrics
          setBioMandatory(true)
          setShowBioOffer(true)
        }
        break
      }
    }
  }

  const handleBioSetup = async () => {
    setBioOfferPhase('working')
    setBioOfferError(null)
    try {
      await registerBiometric()
      const email = getLoginEmail()
      if (email) {
        try {
          const raw = localStorage.getItem('openiv.bioHint')
          const existing = raw ? JSON.parse(raw) : {}
          localStorage.setItem('openiv.bioHint', JSON.stringify({ ...existing, email }))
        } catch { localStorage.setItem('openiv.bioHint', JSON.stringify({ email })) }
      }
      setBioOfferPhase('done')
      setTimeout(() => navigate('/dashboard'), 1400)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setBioOfferError(
        msg.includes('AbortError') || msg.includes('NotAllowedError') || msg.includes('cancelled')
          ? 'Setup was cancelled. Please try again.'
          : 'Setup failed. Make sure your device supports Face ID or Touch ID.'
      )
      setBioOfferPhase('error')
    }
  }

  const handleBioSkip = () => {
    localStorage.setItem('openiv.bioSkipped', '1')
    navigate('/dashboard')
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
      const { state, fullName, avatarUrl, institutionName, institutionLogoUrl } = await authApi.login(
        email, password, inviteCode ?? undefined,
        location?.lat, location?.lon, location?.accuracy,
      )
      await setSessionState(state)
      await setLoginEmail(email)
      if (fullName) await setLoginName(fullName)
      await setLoginAvatar(avatarUrl ?? null)
      // Pre-populate bioHint with rich data so subsequent hint writes preserve it
      try {
        const raw = localStorage.getItem('openiv.bioHint')
        const existing = raw ? JSON.parse(raw) : {}
        localStorage.setItem('openiv.bioHint', JSON.stringify({
          ...existing,
          email,
          userName: fullName ?? existing.userName ?? null,
          institutionName: institutionName ?? existing.institutionName ?? null,
          institutionLogoUrl: institutionLogoUrl ?? existing.institutionLogoUrl ?? null,
        }))
      } catch { /* ignore */ }
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

  // Show biometric prompt when: hint exists, not in invite flow, not explicitly showing password
  const showBiometric = !!bioEmail && !inviteEmail && !showPassword

  return (
    <>
      <AuthLayout>
        {showBiometric ? (
          <Box sx={{ width: '100%' }}>
            {/* Header */}
            <Box sx={{ mb: 3.5 }}>
              <Typography sx={{ fontFamily: 'Jost', fontWeight: 800, fontSize: '1.375rem',
                color: 'var(--heading-color)', mb: 0.5 }}>
                Welcome back
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
                Use your registered biometric to sign in securely.
              </Typography>
            </Box>
            {sessionExpired && (
              <Alert severity="warning" sx={{ borderRadius: 0, mb: 2, fontSize: '0.8125rem' }}>
                Session expired — please sign in again to continue.
              </Alert>
            )}
            <BiometricPrompt
              email={bioEmail}
              userName={bioUserName}
              institutionName={bioInstitutionName}
              institutionLogoUrl={bioInstitutionLogo}
              onSuccess={() => navigate('/dashboard')}
              onUsePassword={() => setShowPassword(true)}
              onExpired={() => setBioExpired(true)}
            />
          </Box>
        ) : (
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
        )}
      </AuthLayout>

      {transferRef && (
        <TransferDialog
          transferRef={transferRef}
          location={lastLocation}
          onSuccess={handleTransferSuccess}
          onCancel={() => setTransferRef(null)}
        />
      )}

      {showUnsupported && (
        <>
          <Box sx={{
            position: 'fixed', inset: 0,
            bgcolor: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(4px)', zIndex: 1290,
          }} />
          <Box sx={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%', maxWidth: 400,
            bgcolor: 'var(--card-bg)', zIndex: 1291,
            boxShadow: '0 32px 80px rgba(15,23,42,0.35)',
          }}>
            <Box sx={{ height: 4, bgcolor: '#dc2626' }} />
            <Box sx={{ px: 3.5, pt: 3.5, pb: 3.5, textAlign: 'center' }}>
              <Box sx={{
                width: 64, height: 64, borderRadius: '50%', mx: 'auto', mb: 2.5,
                bgcolor: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FingerprintIcon sx={{ fontSize: '1.75rem', color: '#dc2626' }} />
              </Box>
              <Typography sx={{
                fontFamily: 'Jost', fontWeight: 800, fontSize: '1.125rem',
                color: 'var(--heading-color)', mb: 0.875,
              }}>
                Device not supported
              </Typography>
              <Typography sx={{
                fontSize: '0.875rem', color: 'var(--on-surface-variant)',
                lineHeight: 1.7, mb: 0, maxWidth: 320, mx: 'auto',
              }}>
                OpenIV requires biometric authentication (Face ID or Touch ID) on every device.
                Your current browser does not support biometrics. Please switch to Safari on
                iPhone / Mac, or Chrome on Android.
              </Typography>
            </Box>
          </Box>
        </>
      )}

      {showBioVerify && (
        <BiometricVerifyModal
          onVerified={() => navigate('/dashboard')}
          onFailed={() => { /* stay on modal — retry button shown */ }}
        />
      )}

      {showBioOffer && (
        <BiometricOfferModal
          phase={bioOfferPhase}
          onSetup={handleBioSetup}
          onSkip={bioMandatory ? undefined : handleBioSkip}
          errorMsg={bioOfferError}
        />
      )}

      {bioExpired && (
        <>
          <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', zIndex: 1290 }} />
          <Box sx={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '100%', maxWidth: 380, bgcolor: 'var(--card-bg)', zIndex: 1291,
            boxShadow: '0 24px 64px rgba(15,23,42,0.25)',
            animation: 'bioExpFade 0.2s cubic-bezier(0.4,0,0.2,1)',
            '@keyframes bioExpFade': {
              from: { opacity: 0, transform: 'translate(-50%, -47%) scale(0.95)' },
              to:   { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
            },
          }}>
            <Box sx={{ height: 4, bgcolor: '#f59e0b' }} />
            <Box sx={{ px: 3, pt: 3, pb: 3.5, textAlign: 'center' }}>
              <Box sx={{ width: 52, height: 52, borderRadius: '50%', bgcolor: '#fef3c7',
                mx: 'auto', mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LockOutlinedIcon sx={{ fontSize: '1.5rem', color: '#d97706' }} />
              </Box>
              <Typography sx={{ fontFamily: 'Jost', fontWeight: 800, fontSize: '1.125rem',
                color: 'var(--heading-color)', mb: 0.75 }}>
                Session expired
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)',
                lineHeight: 1.65, mb: 3, maxWidth: 300, mx: 'auto' }}>
                Your biometric challenge timed out. Click below to try again.
              </Typography>
              <Button
                onClick={() => setBioExpired(false)}
                fullWidth
                sx={{
                  bgcolor: colorPalette.primary, color: '#fff',
                  py: 1.375, borderRadius: 0, fontFamily: 'Jost',
                  fontWeight: 700, fontSize: '0.9375rem', textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: colorPalette.primary, opacity: 0.88, boxShadow: 'none' },
                }}
              >
                Try again
              </Button>
            </Box>
          </Box>
        </>
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
