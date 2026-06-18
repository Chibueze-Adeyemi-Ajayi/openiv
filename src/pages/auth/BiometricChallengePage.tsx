import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import AuthLayout from '@/components/onboarding/AuthLayout'
import { loginChallenge } from '@/api/webauthn'
import { clearOnboardingState, getLoginAvatar, getLoginName, hydrate, setSessionState } from '@/onboarding/state'
import { colorPalette } from '@/theme'
import { ApiError } from '@/api/client'

type Phase = 'idle' | 'working' | 'success' | 'error' | 'expired'

// ── Expired session modal ─────────────────────────────────────────────────────
function ExpiredModal({ onGoToLogin }: { onGoToLogin: () => void }) {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const tick = setInterval(() => setCountdown(n => n - 1), 1000)
    const redirect = setTimeout(onGoToLogin, 5000)
    return () => { clearInterval(tick); clearTimeout(redirect) }
  }, [onGoToLogin])

  return (
    <>
      {/* Backdrop */}
      <Box sx={{
        position: 'fixed', inset: 0,
        bgcolor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', zIndex: 1290,
      }} />

      {/* Card */}
      <Box sx={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: 380,
        bgcolor: 'var(--card-bg)', zIndex: 1291,
        boxShadow: '0 24px 64px rgba(15,23,42,0.25)',
        animation: 'expFadeIn 0.2s cubic-bezier(0.4,0,0.2,1)',
        '@keyframes expFadeIn': {
          from: { opacity: 0, transform: 'translate(-50%, -47%) scale(0.95)' },
          to:   { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
        },
      }}>
        {/* Top stripe */}
        <Box sx={{ height: 4, bgcolor: '#f59e0b' }} />

        <Box sx={{ px: 3, pt: 3, pb: 3.5, textAlign: 'center' }}>
          {/* Icon */}
          <Box sx={{
            width: 52, height: 52, borderRadius: '50%',
            bgcolor: '#fef3c7', mx: 'auto', mb: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AccessTimeRoundedIcon sx={{ fontSize: '1.625rem', color: '#d97706' }} />
          </Box>

          <Typography sx={{
            fontFamily: 'Jost', fontWeight: 800, fontSize: '1.125rem',
            color: 'var(--heading-color)', mb: 0.75,
          }}>
            Session expired
          </Typography>
          <Typography sx={{
            fontSize: '0.875rem', color: 'var(--on-surface-variant)',
            lineHeight: 1.65, mb: 3, maxWidth: 300, mx: 'auto',
          }}>
            Your biometric challenge timed out. Please sign in again to get a fresh session.
          </Typography>

          <Button
            onClick={onGoToLogin}
            fullWidth
            sx={{
              bgcolor: colorPalette.primary, color: '#fff',
              py: 1.375, borderRadius: 0, fontFamily: 'Jost',
              fontWeight: 700, fontSize: '0.9375rem', textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { bgcolor: colorPalette.primary, opacity: 0.88, boxShadow: 'none' },
            }}
          >
            Back to login ({countdown})
          </Button>
        </Box>
      </Box>
    </>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

// Deterministic colour from name — same colour every visit.
const AVATAR_COLOURS = [
  '#0f4c81', '#1a6b4a', '#7c3aed', '#b45309', '#0e7490',
  '#be185d', '#15803d', '#1d4ed8', '#9a3412', '#065f46',
]

function avatarColor(name: string | null): string {
  if (!name) return AVATAR_COLOURS[0]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length]
}

function firstName(name: string | null): string {
  return name?.split(' ')[0] ?? 'there'
}

export default function BiometricChallengePage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [name, setName] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  const goToLogin = useRef(() => { clearOnboardingState(); navigate('/auth/login') })

  useEffect(() => {
    hydrate().then(() => {
      setName(getLoginName() ?? null)
      setAvatar(getLoginAvatar() ?? null)
    })
  }, [])

  const handleVerify = async () => {
    setPhase('working')
    setErrorMsg('')
    try {
      await loginChallenge()
      setPhase('success')
      await setSessionState('authenticated')
      setTimeout(() => navigate('/dashboard'), 900)
    } catch (err: unknown) {
      // Challenge or session expired → show modal + auto-redirect
      if (err instanceof ApiError &&
          (err.detail === 'webauthn_challenge_expired' || err.status === 401)) {
        setPhase('expired')
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(
        msg.includes('NotAllowedError') || msg.includes('AbortError') || msg.includes('cancelled')
          ? 'Verification was cancelled. Please try again.'
          : 'Biometric verification failed. Please try again.'
      )
      setPhase('error')
    }
  }

  const bgColor = avatarColor(name)
  const initText = initials(name)

  return (
    <>
    {phase === 'expired' && <ExpiredModal onGoToLogin={goToLogin.current} />}
    <AuthLayout>
      <Box sx={{ textAlign: 'center', pb: 1 }}>

        {/* Avatar */}
        <Box sx={{ mb: 2.5, position: 'relative', display: 'inline-block' }}>
          {avatar ? (
            <Box
              component="img"
              src={avatar}
              alt={name ?? ''}
              sx={{
                width: 88, height: 88, borderRadius: '50%', objectFit: 'cover',
                display: 'block', mx: 'auto',
                boxShadow: `0 0 0 4px var(--card-bg), 0 0 0 6px ${bgColor}40`,
              }}
            />
          ) : (
            <Box sx={{
              width: 88, height: 88, borderRadius: '50%',
              bgcolor: bgColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mx: 'auto',
              boxShadow: `0 0 0 4px var(--card-bg), 0 0 0 6px ${bgColor}40`,
            }}>
              <Typography sx={{
                fontFamily: 'Jost', fontWeight: 700,
                fontSize: '1.75rem', color: '#fff', letterSpacing: '0.02em',
                lineHeight: 1,
              }}>
                {initText}
              </Typography>
            </Box>
          )}

          {/* Shield badge */}
          <Box sx={{
            position: 'absolute', bottom: 2, right: -2,
            width: 26, height: 26, borderRadius: '50%',
            bgcolor: phase === 'success' ? '#10b981' : colorPalette.primary,
            border: '2px solid var(--card-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.3s',
          }}>
            {phase === 'success'
              ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: '0.875rem', color: '#fff' }} />
              : <FingerprintIcon sx={{ fontSize: '0.875rem', color: '#fff' }} />}
          </Box>
        </Box>

        {/* Greeting */}
        <Typography sx={{
          fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: '#94a3b8', mb: 0.5,
        }}>
          {greeting()}
        </Typography>
        <Typography sx={{
          fontFamily: 'Jost', fontWeight: 700, fontSize: '1.5rem',
          color: 'var(--heading-color)', mb: 0.75,
        }}>
          {phase === 'success' ? 'Verified!' : `Welcome back, ${firstName(name)}`}
        </Typography>
        <Typography sx={{
          fontSize: '0.875rem', color: 'var(--on-surface-variant)',
          lineHeight: 1.7, maxWidth: 320, mx: 'auto', mb: 3,
        }}>
          {phase === 'success'  && 'Taking you to your dashboard…'}
          {phase === 'idle'     && 'Confirm your identity to continue.'}
          {phase === 'working'  && 'Follow the prompt on your device…'}
          {phase === 'error'    && (errorMsg || 'Verification failed. Please try again.')}
        </Typography>

        {/* Verify button */}
        {(phase === 'idle' || phase === 'error') && (
          <Button
            onClick={handleVerify}
            fullWidth
            sx={{
              bgcolor: colorPalette.primary, color: '#fff',
              py: 1.5, fontSize: '0.9375rem', fontWeight: 700,
              fontFamily: 'Jost', borderRadius: 0, textTransform: 'none',
              boxShadow: 'none', gap: 1,
              '&:hover': { bgcolor: colorPalette.primary, opacity: 0.88, boxShadow: 'none' },
            }}
          >
            <FingerprintIcon sx={{ fontSize: '1.125rem' }} />
            {phase === 'error' ? 'Try again' : 'Verify with Face ID / Touch ID'}
          </Button>
        )}

        {/* Working pulse */}
        {phase === 'working' && (
          <Box sx={{
            width: 48, height: 48, borderRadius: '50%',
            bgcolor: `${colorPalette.primary}14`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto',
            animation: 'pulse 1.2s ease-in-out infinite',
            '@keyframes pulse': { '0%,100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.5, transform: 'scale(1.08)' } },
          }}>
            <FingerprintIcon sx={{ fontSize: '1.5rem', color: colorPalette.primary }} />
          </Box>
        )}

        {/* Back link */}
        {phase !== 'success' && phase !== 'working' && (
          <Typography
            onClick={() => { clearOnboardingState(); navigate('/auth/login') }}
            sx={{
              mt: 2.5, fontSize: '0.875rem', color: '#94a3b8',
              cursor: 'pointer',
              '&:hover': { color: colorPalette.primary, textDecoration: 'underline' },
            }}
          >
            Sign in as a different user
          </Typography>
        )}

      </Box>
    </AuthLayout>
    </>
  )
}
