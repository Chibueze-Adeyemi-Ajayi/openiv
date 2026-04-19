import { Box, Button, Stack, TextField, Typography, Link, IconButton } from '@mui/material'
import { colorPalette } from '@/theme'
import { useState } from 'react'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'

interface LoginFormProps {
  onSubmit?: (email: string, password: string) => void
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#f5f3fb',
    borderRadius: 0,
    transition: 'all 0.2s ease',
    '& fieldset': {
      border: '1px solid transparent',
      transition: 'all 0.2s ease',
    },
    '&:hover fieldset': { borderColor: '#e4dff2' },
    '&.Mui-focused fieldset': {
      borderColor: colorPalette.primary,
      borderWidth: '1px',
    },
    '&.Mui-focused': {
      bgcolor: '#ffffff',
      boxShadow: `0 0 0 3px ${colorPalette.primary}14`,
    },
  },
  '& .MuiOutlinedInput-input': {
    fontSize: '1rem',
    fontFamily: 'Jost',
    py: '22px',
    px: '22px',
    color: '#0f172a',
    '&::placeholder': { color: '#9ca3af', opacity: 1 },
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
    bgcolor: '#1a3896',
    boxShadow: `0 8px 24px ${colorPalette.primary}35`,
    transform: 'translateY(-1px)',
  },
  '&:active:not(:disabled)': { transform: 'translateY(0)' },
  '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
}

export default function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(email, password)
  }

  const isFormValid = email && password

  return (
    <Stack sx={{ gap: 4, width: '100%' }}>
      <Box>
        <Typography
          sx={{
            fontSize: '1.625rem',
            fontWeight: 700,
            fontFamily: 'Jost',
            color: '#0f172a',
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
              sx={inputSx}
            />
          </Box>

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ ...labelSx, mb: 0 }}>Passcode</Typography>
              <Link
                href="/auth/reset-password"
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
              InputProps={{
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
              }}
              sx={inputSx}
            />
          </Box>

          <Button fullWidth type="submit" disabled={!isFormValid} sx={{ ...primaryButtonSx, mt: 1.5 }}>
            Access Dashboard
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
          sx={{
            color: '#475569',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'color 0.2s ease',
            '&:hover': { color: colorPalette.primary },
          }}
        >
          Security Protocols
        </Box>{' '}
        and{' '}
        <Box
          component="span"
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
    </Stack>
  )
}
