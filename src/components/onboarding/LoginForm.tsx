import { Alert, Box, Button, Stack, TextField, Typography, Link, IconButton } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { colorPalette } from '@/theme'
import { useState } from 'react'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import FormLoadingOverlay from './FormLoadingOverlay'
import LocationPermissionModal from './LocationPermissionModal'
import TermsModal from './TermsModal'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'

interface LoginFormProps {
  onSubmit?: (email: string, password: string, location?: { lat: number; lon: number; accuracy: number }) => void
  defaultEmail?: string
  submitting?: boolean
  errorMessage?: string | null
  /** Optional hint shown above the form (e.g. "Signing in with invitation for d***@openiv.local"). */
  headerHint?: string | null
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 0,
    fontFamily: 'Jost',
    fontSize: '0.9375rem',
    color: '#000000',
    '& fieldset': {
      borderColor: '#e2e8f0',
      transition: 'all 0.2s ease',
    },
    '&:hover fieldset': {
      borderColor: '#00288e',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#00288e',
      borderWidth: '1px',
    },
    '&.Mui-focused': {
      boxShadow: '0 0 0 4px rgba(0, 40, 142, 0.08)',
    },
    '& input::placeholder': {
      color: '#94a3b8',
      opacity: 1,
    },
  },
  '& .MuiOutlinedInput-input': {
    py: '22px',
    px: '22px',
  },
}

const labelSx = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#475569',
  mb: 1,
  fontFamily: 'Jost',
}

const primaryButtonSx = {
  bgcolor: colorPalette.primary,
  color: '#ffffff',
  py: '20px',
  fontSize: '0.9375rem',
  fontWeight: 600,
  fontFamily: 'Jost',
  borderRadius: 0,
  textTransform: 'none' as const,
  letterSpacing: '0.02em',
  boxShadow: 'none',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover:not(:disabled)': {
    bgcolor: '#1e40af',
    boxShadow: `0 8px 24px rgba(0, 40, 142, 0.25)`,
    transform: 'translateY(-1px)',
  },
  '&:active:not(:disabled)': { transform: 'translateY(0)' },
  '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
}

export default function LoginForm({
  onSubmit,
  defaultEmail = '',
  submitting = false,
  errorMessage = null,
  headerHint = null,
}: LoginFormProps) {
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [termsModalOpen, setTermsModalOpen] = useState(false)
  const [termsType, setTermsType] = useState<'security' | 'ip' | 'privacy'>('security')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [loadingLocation, setLoadingLocation] = useState(false)

  const LOCATION_SKIP_KEY = 'openiv_skip_location_modal'

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Skip the modal entirely if the user previously opted out
    if (localStorage.getItem(LOCATION_SKIP_KEY) === 'true') {
      handleLocationConfirm(false)
      return
    }
    setLocationModalOpen(true)
  }

  const handleLocationConfirm = (doNotShowAgain: boolean) => {
    if (doNotShowAgain) {
      localStorage.setItem(LOCATION_SKIP_KEY, 'true')
    }
    setLocationModalOpen(false)
    setLocationError(null)
    setLoadingLocation(true)

    if (!navigator.geolocation) {
      setLoadingLocation(false)
      setLocationError("Geolocation is not supported by your browser.")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLoadingLocation(false)
        const { latitude, longitude, accuracy } = position.coords
        onSubmit?.(email, password, { lat: latitude, lon: longitude, accuracy })
      },
      (error) => {
        setLoadingLocation(false)
        if (error.code === error.PERMISSION_DENIED) {
          // User explicitly blocked — hard stop. Check both browser and OS settings.
          console.error('Location Permission Denied:', error)
          setLocationError(
            "Location permission was denied. On macOS, go to System Settings → Privacy & Security → Location Services and enable access for your browser, then try again."
          )
        } else {
          // POSITION_UNAVAILABLE (2) or TIMEOUT (3) — hardware/service limitation (common on Mac desktops).
          // We don't log this as an error because it's expected behavior in many environments.
          // Proceed without coordinates; the backend will fall back to IP-based geolocation.
          onSubmit?.(email, password)
        }
      },
      { timeout: 15000, maximumAge: 0, enableHighAccuracy: false }
    )
  }

  const isFormValid = email && password

  return (
    <Stack sx={{ gap: 4, width: '100%', position: 'relative' }}>
      <Box>
        <Typography
          sx={{
            fontSize: '1.625rem',
            fontWeight: 700,
            fontFamily: 'Jost',
            color: '#00288e',
            letterSpacing: '-0.015em',
            mb: 0.75,
          }}
        >
          Initialize Terminal
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.6 }}>
          Secure authorization required for data access.
        </Typography>
      </Box>

      {headerHint && (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          {headerHint}
        </Alert>
      )}
      {errorMessage && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {errorMessage}
        </Alert>
      )}
      {locationError && (
        <Alert 
          severity="warning" 
          sx={{ borderRadius: 0 }}
          icon={<MapOutlinedIcon fontSize="inherit" />}
        >
          {locationError}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack sx={{ gap: 2.5 }}>
          <Box>
            <Typography sx={labelSx}>Institutional Email</Typography>
            <TextField
              fullWidth
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              sx={inputSx}
            />
          </Box>

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ ...labelSx, mb: 0 }}>Passcode</Typography>
              <Link
                component={RouterLink}
                to="/auth/reset-password"
                sx={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: colorPalette.primary,
                  textDecoration: 'none',
                  transition: 'opacity 0.2s ease',
                  '&:hover': { opacity: 0.75 },
                }}
              >
                Forgot?
              </Link>
            </Box>
            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter Your Passcode"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              slotProps={{
                input: {
                  endAdornment: (
                    <IconButton
                      edge="end"
                      onClick={() => setShowPassword(!showPassword)}
                      disableRipple
                      sx={{
                        color: '#94a3b8',
                        mr: 0.5,
                        transition: 'color 0.2s ease',
                        '&:hover': { color: colorPalette.primary, bgcolor: 'transparent' },
                      }}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <VisibilityOffOutlinedIcon sx={{ fontSize: '1.25rem' }} />
                      ) : (
                        <VisibilityOutlinedIcon sx={{ fontSize: '1.25rem' }} />
                      )}
                    </IconButton>
                  ),
                },
              }}
              sx={inputSx}
            />
          </Box>

          <Button
            fullWidth
            type="submit"
            disabled={!isFormValid || submitting}
            sx={{ ...primaryButtonSx, mt: 1.5 }}
          >
            {submitting ? 'Signing in…' : 'Access Dashboard'}
          </Button>
        </Stack>
      </form>

      <Typography
        sx={{
          fontSize: '0.8125rem',
          fontWeight: 400,
          color: '#94a3b8',
          textAlign: 'center',
          lineHeight: 1.7,
          mt: 0.5,
        }}
      >
        By proceeding, you agree to our{' '}
        <Box
          component="span"
          onClick={() => { setTermsType('security'); setTermsModalOpen(true); }}
          sx={{
            color: '#475569',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'color 0.2s ease',
            '&:hover': { color: colorPalette.primary },
          }}
        >
          Security Protocols
        </Box>,{' '}
        <Box
          component="span"
          onClick={() => { setTermsType('privacy'); setTermsModalOpen(true); }}
          sx={{
            color: '#475569',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'color 0.2s ease',
            '&:hover': { color: colorPalette.primary },
          }}
        >
          Data Privacy
        </Box>{' '}
        and{' '}
        <Box
          component="span"
          onClick={() => { setTermsType('ip'); setTermsModalOpen(true); }}
          sx={{
            color: '#475569',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'color 0.2s ease',
            '&:hover': { color: colorPalette.primary },
          }}
        >
          IP Terms
        </Box>
        .
      </Typography>

      <LocationPermissionModal 
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onConfirm={handleLocationConfirm}
      />

      <TermsModal 
        open={termsModalOpen}
        type={termsType}
        onClose={() => setTermsModalOpen(false)}
      />

      {(submitting || loadingLocation) && <FormLoadingOverlay />}
    </Stack>
  )
}
