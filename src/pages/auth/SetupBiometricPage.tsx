import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, Stack } from '@mui/material'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import AuthLayout from '@/components/onboarding/AuthLayout'
import { registerBiometric, webAuthnSupported } from '@/api/webauthn'
import { setSessionState, clearOnboardingState, hydrate, getLoginName, getLoginAvatar, getLoginEmail } from '@/onboarding/state'
import { colorPalette } from '@/theme'

// Avatar helpers (same palette as BiometricChallengePage)
const AVATAR_COLOURS = [
  '#0f4c81', '#1a6b4a', '#7c3aed', '#b45309', '#0e7490',
  '#be185d', '#15803d', '#1d4ed8', '#9a3412', '#065f46',
]
function avatarBg(name: string | null): string {
  if (!name) return AVATAR_COLOURS[0]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length]
}
function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

type Phase = 'idle' | 'working' | 'success' | 'error' | 'unsupported'

export default function SetupBiometricPage() {
  const navigate = useNavigate()
  const [phase, setPhase]   = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [name, setName]     = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)

  useEffect(() => {
    if (!webAuthnSupported()) setPhase('unsupported')
    hydrate().then(() => {
      setName(getLoginName() ?? null)
      setAvatar(getLoginAvatar() ?? null)
    })
  }, [])

  const handleSetup = async () => {
    setPhase('working')
    setErrorMsg('')
    try {
      await registerBiometric()
      setPhase('success')
      await setSessionState('authenticated')
      // Persist hint so LoginPage can show biometric button on next visit
      const email = getLoginEmail()
      if (email) localStorage.setItem('openiv.bioHint', JSON.stringify({ email }))
      setTimeout(() => navigate('/dashboard'), 1200)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('AbortError') || msg.includes('NotAllowedError') || msg.includes('cancelled')) {
        setErrorMsg('Setup was cancelled. Please try again.')
      } else {
        setErrorMsg('Setup failed. Make sure you are using a device with Face ID or Touch ID.')
      }
      setPhase('error')
    }
  }

  const bgColor  = avatarBg(name)
  const initText = initials(name)

  return (
    <AuthLayout>
      <Box sx={{ textAlign: 'center', py: 2 }}>

        {/* Avatar with fingerprint / status overlay */}
        <Box sx={{ mb: 2.5, position: 'relative', display: 'inline-block' }}>
          {avatar ? (
            <Box component="img" src={avatar} alt={name ?? ''} sx={{
              width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', display: 'block', mx: 'auto',
              boxShadow: `0 0 0 4px var(--card-bg), 0 0 0 6px ${bgColor}40`,
            }} />
          ) : (
            <Box sx={{
              width: 88, height: 88, borderRadius: '50%', bgcolor: bgColor, mx: 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 0 4px var(--card-bg), 0 0 0 6px ${bgColor}40`,
            }}>
              <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '1.75rem', color: '#fff', lineHeight: 1 }}>
                {initText}
              </Typography>
            </Box>
          )}

          {/* Badge: fingerprint / success / error */}
          <Box sx={{
            position: 'absolute', bottom: 2, right: -2,
            width: 28, height: 28, borderRadius: '50%',
            border: '2px solid var(--card-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: phase === 'success' ? '#10b981'
              : phase === 'error' || phase === 'unsupported' ? '#dc2626'
              : colorPalette.primary,
            transition: 'background 0.3s',
            animation: phase === 'working' ? 'pulse 1.2s ease-in-out infinite' : 'none',
            '@keyframes pulse': { '0%,100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.6, transform: 'scale(1.1)' } },
          }}>
            {phase === 'success'
              ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1rem', color: '#fff' }} />
              : phase === 'error' || phase === 'unsupported'
              ? <ErrorOutlineRoundedIcon sx={{ fontSize: '1rem', color: '#fff' }} />
              : <FingerprintIcon sx={{ fontSize: '1rem', color: '#fff' }} />}
          </Box>
        </Box>

        {/* Greeting + name (shown before success state) */}
        {name && phase !== 'success' && (
          <>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', mb: 0.25 }}>
              Welcome
            </Typography>
            <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '1.125rem', color: 'var(--heading-color)', mb: 0.5 }}>
              {name.split(' ')[0]}
            </Typography>
          </>
        )}

        {/* Heading */}
        <Typography sx={{ fontFamily: 'Jost', fontWeight: 700, fontSize: '1.25rem', color: 'var(--heading-color)', mb: 1 }}>
          {phase === 'success'
            ? 'You\'re all set!'
            : phase === 'unsupported'
            ? 'Biometrics not available'
            : 'Set up biometric login'}
        </Typography>

        {/* Body text */}
        <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.7, mb: 3, maxWidth: 360, mx: 'auto' }}>
          {phase === 'success' && 'Biometric login is set up. Redirecting to your dashboard…'}
          {phase === 'unsupported' && 'Your browser or device does not support biometric authentication. Please use a device with Face ID or Touch ID and a supported browser (Safari on iPhone/Mac, Chrome on Android).'}
          {phase === 'idle' && 'OpenIV requires biometric authentication to protect your account. Your fingerprint or face data never leaves your device.'}
          {phase === 'working' && 'Follow the prompt on your device to complete setup…'}
          {phase === 'error' && (errorMsg || 'Something went wrong. Please try again.')}
        </Typography>

        {/* Subtext for idle */}
        {phase === 'idle' && (
          <Stack direction="row" spacing={3} justifyContent="center" sx={{ mb: 3 }}>
            {['Face ID', 'Touch ID', 'Fingerprint'].map(label => (
              <Box key={label} sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}

        {/* Action button */}
        {(phase === 'idle' || phase === 'error') && (
          <Button
            onClick={handleSetup}
            fullWidth
            sx={{
              bgcolor: colorPalette.primary, color: '#fff',
              py: 1.5, fontSize: '0.9375rem', fontWeight: 700,
              fontFamily: 'Jost', borderRadius: 0, textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { bgcolor: colorPalette.primary, opacity: 0.88, boxShadow: 'none' },
            }}
          >
            {phase === 'error' ? 'Try again' : 'Set up Face ID / Touch ID'}
          </Button>
        )}

        {/* Back to login */}
        {phase !== 'success' && phase !== 'working' && (
          <Typography
            onClick={() => { clearOnboardingState(); navigate('/auth/login') }}
            sx={{
              mt: 2.5, fontSize: '0.875rem', color: '#64748b',
              cursor: 'pointer', textAlign: 'center',
              '&:hover': { color: colorPalette.primary, textDecoration: 'underline' },
            }}
          >
            Back to login
          </Typography>
        )}

      </Box>
    </AuthLayout>
  )
}
